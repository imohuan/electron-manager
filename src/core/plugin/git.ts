import { execa } from "execa";
import { existsSync, readdirSync, removeSync } from "fs-extra";
import got from "got";
import { Agent } from "https";
import { isArray } from "lodash-es";
import { basename, resolve } from "path";
import { loadJson } from "src/helper/utils";

import { downloadZip } from "../../helper/download";
import { getGitRawFile, getGitZipFastUrl } from "../../helper/github";
import { AdapterBase, AdapterBaseOption, AdapterInfo, ExecCommandOption } from "./base";

export interface AdapterGitOption extends AdapterBaseOption {
  //
}

export class AdapterGit extends AdapterBase {
  private cachePath: string;

  constructor(options: AdapterGitOption) {
    super(options.baseDir);
    this.cachePath = resolve(options.baseDir, "node_cache");
  }

  async info(gitUrl: string): Promise<AdapterInfo | null> {
    const repo = /(https:\/\/github\.com\/[^\/]+\/[^\/]+)/.exec(gitUrl)?.[1] || gitUrl;
    const name = repo.replace("https://github.com/", "");
    return await got
      .get(`https://raw.githubusercontent.com/${name}/main/${this.fileName}`, {
        agent: { https: new Agent({ rejectUnauthorized: false }) }
      })
      .json<any>()
      .catch(() => null);
  }

  async list(): Promise<AdapterInfo[]> {
    const result = await Promise.all(
      readdirSync(this.baseDir).map((name) => {
        return loadJson(resolve(this.baseDir, name, this.fileName));
      })
    );
    return result.filter((f) => f);
  }

  private getUrlName(gitUrl: string) {
    return basename(gitUrl).replace(".git", "");
  }

  private checkGit() {
    return new Promise((_resolve) => {
      execa("git", ["-v"])
        .then(() => _resolve(true))
        .catch(() => _resolve(false));
    });
  }

  async install(gitUrl: string, update: boolean = false): Promise<any> {
    if (await this.checkGit()) {
      return await this.execCommand("clone", gitUrl);
    } else if (gitUrl.startsWith("https://github.com/")) {
      const fastUrl = await getGitZipFastUrl(gitUrl);
      const out = resolve(this.baseDir, update ? "_" : "" + this.getUrlName(gitUrl));
      return await downloadZip({ url: fastUrl, cache: this.cachePath, out }).then(
        (res) => res?.data
      );
    } else return null;
  }

  async update(gitUrl: string): Promise<any> {
    const cwd = resolve(this.baseDir, this.getUrlName(gitUrl));
    if (existsSync(resolve(cwd, ".git"))) {
      await this.execCommand("fetch", ["--all"], { cwd });
      await this.execCommand("reset", ["--hard", "origin/main"], { cwd });
      return await this.execCommand("pull", ["origin", "main", "--progress"], { cwd });
    } else return await this.install(gitUrl, true);
  }

  async uninstall(gitUrl: string): Promise<any> {
    removeSync(resolve(this.baseDir, this.getUrlName(gitUrl)));
  }

  private async execCommand(
    cmd: string,
    args: string | string[] = [],
    option: Partial<ExecCommandOption> = {}
  ): Promise<string> {
    return await this.execCommandBase("git", [cmd, ...(isArray(args) ? args : [args])], {
      onMessage: (_, msg) => {
        const values = /Receiving objects:\s+(\d+)%\s+\((\d+)\/(\d+)\)/.exec(msg);
        if (!values) return;
        const progress = {
          percent: parseInt(values[1]),
          transferred: parseInt(values[2]),
          total: parseInt(values[3])
        };
        console.log(progress);
      },
      ...option
    });
  }
}
