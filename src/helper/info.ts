import axios, { AxiosRequestConfig, AxiosResponse } from "axios";
import decompress from "decompress";
import { execa } from "execa";
import {
  ensureDirSync,
  existsSync,
  moveSync,
  readdirSync,
  removeSync,
  writeFileSync
} from "fs-extra";
import https from "https";
import { defaultsDeep } from "lodash-es";
import { basename, dirname, resolve } from "path";

import { getSelector } from "@imohuan/selector";

import { PluginConfig } from "../typings";
import { Result } from "./result";
import { testFastestNetwork, testNetworkSpeed } from "./testUrl";
import { md5 } from "./utils";

export abstract class Info {
  /** 下载 */
  abstract download(downloadPath: string): Promise<Result>;

  /** 获取信息 */
  abstract getInfo(): Promise<any>;

  /** 请求封装，新增自定义重试次数，并且支持多个urls进行顺序测试 */
  protected async request(
    option: AxiosRequestConfig & { retry?: number; delay?: number; urls?: string[] },
    callback: (response: AxiosResponse) => Promise<any>
  ): Promise<any> {
    return new Promise((_resolve) => {
      defaultsDeep(option, { retry: 3, delay: 1000 });
      if (option?.urls) {
        option.url = option.urls.shift();
        if (option.urls.length === 0) delete option.urls;
      }
      axios(option)
        .then(callback)
        .then((data) => {
          if (data) return _resolve(data);
          if (option.retry! <= 0) return _resolve(false);
          setTimeout(async () => {
            const result = await this.request(
              defaultsDeep({ retry: option.retry! - 1 }, option),
              callback
            );
            _resolve(result);
          }, option.delay);
        });
    });
  }

  /** 下载指定的 zip，并且解压在outDir（当前的解压方法会自动创建一个文件夹进行解压） */
  protected async downloadBase(url: string, outDir: string): Promise<Result> {
    const { cache } = manager.get("path");
    ensureDirSync(cache);
    ensureDirSync(outDir);
    const name = md5(url).slice(0, 10);
    const zipPath = resolve(cache, `${name}.zip`);
    return new Promise(async (_resolve) => {
      try {
        // 1. 下载文件
        await axios({
          url,
          responseType: "arraybuffer",
          httpsAgent: new https.Agent({ rejectUnauthorized: false })
        })
          .then((res) => writeFileSync(zipPath, res.data))
          .catch((e) => {
            console.log("[Download Error]", url);
            _resolve(Result.error("下载文件失败: " + e.message));
          });

        // 2. 解压文件
        const destDir = resolve(cache, name);
        await decompress(zipPath, destDir);
        removeSync(zipPath);

        const decompressPath = readdirSync(destDir)
          .map((name) => resolve(destDir, name))
          .shift();

        if (!decompressPath || !existsSync(decompressPath)) {
          const errorMsg = "文件解压错误, 请稍后重试";
          manager.logger.error(errorMsg);
          return _resolve(Result.error(errorMsg));
        }

        // 3. 转移文件
        removeSync(outDir);
        moveSync(decompressPath, outDir);
        removeSync(destDir);
        _resolve(Result.ok(true));
      } catch (e: any) {
        _resolve(Result.error(e.message));
      }
    });
  }
}

export class GithubInfo<T = PluginConfig> extends Info {
  private repo: string;
  private info: T | null;
  private infoFile: string;
  private name: string;

  /**
   * 初始化
   * @param repo github地址
   * @param infoFile 配置文件路径 如 `plugin.json` | `src/index.ts`
   */
  constructor(repo: string, infoFile: string) {
    super();
    this.repo = /(https:\/\/github\.com\/[^\/]+\/[^\/]+)/.exec(repo)?.[1] || repo;
    this.infoFile = infoFile;
    this.info = null;
    this.name = this.repo.replace("https://github.com/", "");
  }

  async download(downloadPath: string): Promise<Result> {
    const suffix = "/archive/refs/heads/main.zip";
    const urls = [
      `${this.repo}${suffix}`,
      `https://gh.flyinbug.top/gh/${this.repo}${suffix}`,
      `https://github.91chi.fun/${this.repo}${suffix}`,
      `https://proxy.zyun.vip/${this.repo}${suffix}`,
      `https://archive.fastgit.org/${this.name}${suffix}`,
      `https://gh.ddlc.top/${this.repo}${suffix}`,
      `https://ghproxy.com/${this.repo}${suffix}`
    ];
    const url = await testNetworkSpeed(urls, 3000);
    return await this.downloadBase(url, downloadPath);
  }

  async getInfo(): Promise<T> {
    if (!this.info) {
      const filename = this.infoFile;
      const urls = [
        `https://raw.githubusercontent.com/${this.name}/main/${filename}`,
        `https://sourcegraph.com/github.com/${this.name}@main/-/blob/${filename}`,
        `https://github.com/${this.name}/raw/main/${filename}`,
        `https://jsd.eagleyao.com/gh/${this.name}@main/${filename}`,
        `https://raw.iqiq.io/${this.name}/main/${filename}`,
        `https://raw.kgithub.com/${this.name}/main/${filename}`,
        `https://fastly.jsdelivr.net/gh/${this.name}@main/${filename}`,
        `https://cdn.staticaly.com/gh/${this.name}/main/${filename}`,
        `https://raw.fastgit.org/${this.name}/main/${filename}`,
        `https://ghproxy.net/https://raw.githubusercontent.com/${this.name}/main/${filename}`,
        `https://gcore.jsdelivr.net/gh/${this.name}@main/${filename}`,
        `https://raw.githubusercontents.com/${this.name}/main/${filename}`,
        `https://github.moeyy.xyz/https://raw.githubusercontent.com/${this.name}/main/${filename}`,
        `https://github.com/${this.name}/blame/main/${filename}`
      ];
      const info = await testFastestNetwork(urls);
      this.info = info;
    }
    return this.info as T;
  }
}

export class GitInfo<T = PluginConfig> extends Info {
  private repo: string;
  private infoFile: string;
  private isGithub: boolean;
  private githubInstance: GithubInfo<T>;

  constructor(repo: string, infoFile: string) {
    super();
    this.repo = /(https:\/\/(gitee|github)\.com\/[^\/]+\/[^\/]+)/.exec(repo)?.[1] || repo;
    this.infoFile = infoFile;
    this.isGithub = this.repo.indexOf("https://github.com") !== -1;
    this.githubInstance = new GithubInfo<T>(this.repo, this.infoFile);
    this.checkGit();
  }

  private async checkGit(): Promise<boolean> {
    return new Promise((_resolve) => {
      execa("git", ["-v"])
        .then(() => _resolve(true))
        .catch(() => {
          manager.logger.error("Git 未安装，请安装Git环境");
          _resolve(false);
        });
    });
  }

  async download(downloadPath: string): Promise<Result> {
    if (!(await this.checkGit())) return Result.error("");
    const { stderr } = await execa("git", ["clone", this.repo, basename(downloadPath)], {
      cwd: dirname(downloadPath)
    });
    return existsSync(downloadPath) ? Result.ok(true) : Result.error(stderr);
  }

  private async getGiteeInfo(): Promise<any> {
    const url = `${this.repo}/blob/master/${this.infoFile}`;
    return await this.request({ url }, (res) => {
      const selector = getSelector(res.data, {});
      const json = selector.query({ cls: "textarea#blob_raw::html", rules: ["json"] });
      console.log("json", json);
      console.log({ json });
      if (!json) return false;
      return json || {};
    });
  }

  async getInfo(): Promise<T> {
    if (this.isGithub) {
      return this.githubInstance.getInfo();
    } else {
      return this.getGiteeInfo();
    }
  }

  update() {}
}

export function downloadNpm(name: string, outDir: string): Promise<Result> {
  const { cache } = manager.get("path");
  const npmCachePath = resolve(cache, name);
  ensureDirSync(npmCachePath);
  const npm = process.platform === "win32" ? "npm.cmd" : "npm";
  return new Promise(async (_resolve) => {
    await execa(npm, ["-v"]).catch((_) => _resolve(Result.error("NPM 未安装，请安装node环境")));
    await execa(npm, ["init", "-y"], { cwd: npmCachePath });
    await execa(npm, ["i", name, "-D", "--registry=https://registry.npm.taobao.org"], {
      cwd: npmCachePath
    });
    removeSync(outDir);
    moveSync(resolve(npmCachePath, "node_modules", name), outDir);
    removeSync(npmCachePath);
    _resolve(Result.ok(true));
  });
}

export async function downloadUrl(url: string, outDir: string): Promise<Result> {
  const git = new GitInfo(url, "");
  return await git.download(outDir);
}
