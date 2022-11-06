import axios from "axios";
import { copySync, existsSync } from "fs-extra";
import { Progress } from "got";
import { basename, dirname, resolve } from "path";
import { loadJson } from "src/helper/utils";
import { PluginConfig } from "src/typings";
import { EventEmitter } from "stream";

import { getSelector } from "@imohuan/selector";

import config from "../config/mirror";
import { downloadZip } from "../helper/download";
import { getGitRawFile, getGitZipFastUrl, gitClone } from "../helper/github";
import { request } from "../helper/request";
import { Result } from "../helper/result";
import { Context } from "./context";

export abstract class PluginDownload {
  emitter: EventEmitter;
  constructor(emitter: EventEmitter) {
    this.emitter = emitter;
  }
  protected downloadProgress(data: Progress) {
    console.log(data);
  }
  abstract download(url: string, out: string, cache: string): Promise<Result>;
  abstract getConfig(url: string, filePath: string): Promise<PluginConfig | null>;
}

class GithubDownload extends PluginDownload {
  async download(url: string, out: string, cache: string) {
    const mirrorUrl = await getGitZipFastUrl(url);
    return await downloadZip({
      url: mirrorUrl,
      out,
      cache,
      onProgress: this.downloadProgress
    });
  }

  async getConfig(url: string, filePath: string): Promise<PluginConfig | null> {
    return await getGitRawFile(url, filePath).then((res) => res?.result);
  }
}

class GiteeDownload extends PluginDownload {
  async download(url: string, out: string, cache: string): Promise<Result<any>> {
    return await gitClone(url, basename(out), dirname(out), this.downloadProgress);
  }

  async getConfig(url: string, filePath: string): Promise<PluginConfig | null> {
    const repo = /https\:\/\/gitee\.com\/[^\/]+\/[^\/]+\//.exec(url)?.[0];
    const fileUrl = `${repo}/blob/master/${filePath}`;
    return await request({ url: fileUrl }, (res) => {
      const selector = getSelector(res.data, {});
      const json = selector.query({ cls: "textarea#blob_raw::html", rules: ["json"] });
      if (!json) return false;
      return json || {};
    });
  }
}

class NpmDownload extends PluginDownload {
  private async npmInfo(
    packageName: string,
    mirror: keyof typeof config.npm = "taobao"
  ): Promise<any> {
    const url = config.npm[mirror];
    const info = await axios.get(url + packageName).then((res) => res.data);
    if (info?.error) return null;
    const lastVersionInfo = info?.versions[Object.keys(info?.versions)[0]];
    const downloadUrl = `${url}${packageName}/download/${packageName}-${lastVersionInfo.version}.tgz`;
    return { download: downloadUrl, ...lastVersionInfo };
  }

  async download(url: string, out: string, cache: string): Promise<Result<any>> {
    const info = await this.npmInfo(url);
    if (!info) return Result.error("未找到对应的NPM包");
    return await downloadZip({
      url: info.download,
      out,
      cache,
      onProgress: this.downloadProgress
    });
  }

  async getConfig(url: string, filePath: string): Promise<PluginConfig | null> {
    return await this.npmInfo(url);
  }
}

class UrlDownload extends PluginDownload {
  async download(url: string, out: string, cache: string): Promise<Result<any>> {
    return await downloadZip({ url, out, cache, onProgress: this.downloadProgress });
  }

  async getConfig(url: string, filePath: string): Promise<PluginConfig | null> {
    if (!url.endsWith("/")) url = url + "/";
    return await axios.get(url + filePath).then((res) => res.data || null);
  }
}

class LocalDownload extends PluginDownload {
  async download(url: string, out: string, cache: string): Promise<Result<any>> {
    const config = await this.getConfig(dirname(url), basename(url));
    if (!config) return Result.error("地址出现错误");
    if (config.debug === false) {
      copySync(url, out);
      return Result.ok(out);
    }
    return Result.ok(url);
  }

  getConfig(dir: string, filePath: string): Promise<PluginConfig | null> {
    return loadJson(resolve(dir, filePath));
  }
}

export class PluginManager {
  protected context: Context;
  protected emitter: EventEmitter;
  protected pluginDir: string;
  protected downloadMap: Map<string, GithubDownload>;
  protected downloading: any[] = [];

  constructor(context: Context, pluginDir: string) {
    this.context = context;
    this.pluginDir = pluginDir;
    this.emitter = new EventEmitter();
    this.downloadMap = new Map();
    this.downloadMap.set("github", new GithubDownload(this.emitter));
    this.downloadMap.set("gitee", new GiteeDownload(this.emitter));
    this.downloadMap.set("url", new UrlDownload(this.emitter));
    this.downloadMap.set("local", new LocalDownload(this.emitter));
    this.downloadMap.set("npm", new NpmDownload(this.emitter));
  }

  addCustomDownload(name: string, pluginDownload: new (emitter: EventEmitter) => PluginDownload) {
    this.downloadMap.set(name, new pluginDownload(this.emitter));
  }

  downloadProgress(data: Progress) {
    this.emitter.emit("download-progress", data);
  }

  private getUrlDefaultType(url: string): PluginDownload {
    if (url.startsWith("https://github.com/")) return this.downloadMap.get("github")!;
    if (url.startsWith("https://gitee.com/")) return this.downloadMap.get("gitee")!;
    if (/^http?s:\/\//.test(url)) return this.downloadMap.get("url")!;
    if (existsSync(url)) return this.downloadMap.get("local")!;
    return this.downloadMap.get("npm")!;
  }

  private getUrlType(url: string): Result<{ instance: PluginDownload; url: string }> {
    const regexp = /^([a-zA-Z][a-zA-Z0-9]+)\+(.+)/;
    if (regexp.test(url)) {
      const [_, type, newUrl] = regexp.exec(url) || [];
      if (!this.downloadMap.has(type)) return Result.error("未找到对应的下载器");
      return Result.ok({ instance: this.downloadMap.get(type)!, url: newUrl });
    } else {
      const instance = this.getUrlDefaultType(url);
      return Result.ok({ instance, url });
    }
  }

  async download(url: string, name: string): Promise<Result<any>> {
    const result = this.getUrlType(url);
    if (result.status !== 200) return result;
    const out = resolve(this.pluginDir, name);
    const cache = this.context.get("path")!.cache;
    return await result.data.instance.download(result.data.url, out, cache);
  }

  async getConfig(url: string, filePath: string = ""): Promise<Result<any>> {
    const result = this.getUrlType(url);
    if (result.status !== 200) return result;
    const config = await result.data.instance.getConfig(result.data.url, filePath);
    if (!config) return Result.error("获取配置失败: " + url);
    return Result.ok(config);
  }
}
