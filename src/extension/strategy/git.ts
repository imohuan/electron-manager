import { existsSync, readdirSync, removeSync, statSync } from "fs-extra";
import got from "got";
import { Agent } from "https";
import { isArray } from "lodash-es";
import { basename, resolve } from "path";
import { downloadZip } from "../../helper/download";
import { checkGit, getGitZipFastUrl } from "../../helper/github";
import { Result } from "../../helper/result";
import { loadJson } from "../../helper/utils";

import { getSelector } from "@imohuan/selector";

import { ExtensionInfo } from "../typings";
import axios from 'axios';
import {
  AbstractStrategy,
  ExecCommandOption,
  ExtensionCallInfoOption,
  ExtensionCallListOption,
  ExtensionCallOption,
  ExtensionCallResult,
  ExtensionStrategyOption
} from "./abstract";

export class StrategyGit extends AbstractStrategy {
  private cachePath: string;
  constructor(option: ExtensionStrategyOption) {
    super(option);
    this.cachePath = resolve(this.option.baseDir, "node_cache");
  }

  private getUrlName(gitUrl: string) {
    return basename(gitUrl).replace(".git", "");
  }

  private async giteeInfo(gitUrl: string): Promise<ExtensionInfo | null> {
    const repo = /https\:\/\/gitee\.com\/[^\/]+\/[^\/]+/.exec(gitUrl)?.[0];
    const fileUrl = `${repo}/blob/master/${this.option.fileName}`;
    const html = await axios.get(fileUrl).then(res => res.data)
    const selector = getSelector(html, {});
    return selector.query({ cls: "textarea#blob_raw::html", rules: ["json"] }) || null;
  }

  /** 支持 github, gitee */
  async info(
    gitUrl: string,
    option: Partial<ExtensionCallInfoOption>
  ): Promise<ExtensionInfo | null> {
    if (option?.local) {
      return loadJson(resolve(this.option.baseDir, this.getUrlName(gitUrl), this.option.fileName));
    } else if (gitUrl.startsWith("https://gitee.com/")) {
      return await this.giteeInfo(gitUrl);
    } else {
      const repo = /https:\/\/github\.com\/([^\/]+\/[^\/]+)/.exec(gitUrl)?.[1] || gitUrl;
      const name = repo.replace("https://github.com/", "").replace(".git", "");
      const url = `https://raw.githubusercontent.com/${name}/main/${this.option.fileName}`;
      return await got
        .get(url, { agent: { https: new Agent({ rejectUnauthorized: false }) } })
        .json<any>()
        .catch(() => null);
    }
  }

  async list(option: Partial<ExtensionCallListOption>): Promise<ExtensionInfo[]> {
    const result = await Promise.all(
      readdirSync(this.option.baseDir).map((name) => {
        return loadJson(resolve(this.option.baseDir, name, this.option.fileName));
      })
    );
    return result.filter((f) => f);
  }

  async install(
    gitUrl: string,
    option: Partial<ExtensionCallOption & { update?: boolean }>
  ): Promise<Result<ExtensionCallResult>> {
    const name = this.getUrlName(gitUrl);
    if (await checkGit()) {
      return await this.execCommand("clone", [gitUrl, name, "--progress"]);
    } else if (gitUrl.startsWith("https://github.com/")) {
      const fastUrl = await getGitZipFastUrl(gitUrl);
      const out = resolve(this.option.baseDir, option?.update ? "_" : "" + name);
      if (existsSync(out)) removeSync(out);
      return await downloadZip({ url: fastUrl, cache: this.cachePath, out }).then(
        (res) => res?.data
      );
    } else return Result.error("请安装Git");
  }

  async update(
    gitUrl: string,
    option: Partial<ExtensionCallOption>
  ): Promise<Result<ExtensionCallResult>> {
    const cwd = resolve(this.option.baseDir, this.getUrlName(gitUrl));
    if (existsSync(resolve(cwd, ".git"))) {
      await this.execCommand("fetch", ["--all"], { cwd });
      await this.execCommand("reset", ["--hard", "origin/main"], { cwd });
      return await this.execCommand("pull", ["origin", "main", "--progress"], { cwd });
    } else return await this.install(gitUrl, { update: true });
  }

  async uninstall(
    gitUrl: string,
    option: Partial<ExtensionCallOption>
  ): Promise<Result<ExtensionCallResult>> {
    const start = new Date().getTime();
    const name = this.getUrlName(gitUrl);
    const targetDir = resolve(this.option.baseDir, name);
    removeSync(targetDir);
    if (existsSync(targetDir)) return Result.error("卸载失败: " + name);
    else {
      const time = new Date().getTime() - start;
      return Result.ok({ name, path: targetDir, size: 0, time });
    }
  }

  private async execCommand(
    cmd: string,
    args: string | string[] = [],
    option: Partial<ExecCommandOption> = {}
  ): Promise<Result<ExtensionCallResult>> {
    const start = new Date().getTime();
    const _args = isArray(args) ? args : [args];
    const name = this.getUrlName(_args[0]);
    const path = resolve(this.option.baseDir, name);
    const _process = await this.execCommandBase("git", [cmd, ..._args], {
      onMessage: (_, msg) => {
        const values = /Receiving objects:\s+(\d+)%\s+\((\d+)\/(\d+)\)/.exec(msg);
        if (!values) return;
        const progress = {
          percent: parseInt(values[1]),
          transferred: parseInt(values[2]),
          total: parseInt(values[3])
        };
        this.option.hooks.invoke("extension-progress", { type: "progress", name, progress });
      },
      ...option
    });
    _process.process.on("error", (err) => Result.error(`操作失败: ${err.message}`));
    return Result.ok({
      time: new Date().getTime() - start,
      path,
      size: existsSync(path) ? statSync(path).size : 0,
      name
    });
  }
}
