import { execa } from "execa";
import { ensureDirSync, existsSync, mkdirSync, writeFileSync } from "fs-extra";
import got from "got";
import { get, isArray } from "lodash-es";
import { resolve } from "path";

import { loadJson } from "../../helper/utils";
import { AdapterBase, AdapterBaseOption, AdapterInfo } from "./base";

export const npmMirror = {
  npm: "https://registry.npmjs.org/",
  yarn: "https://registry.yarnpkg.com/",
  tencent: "https://mirrors.cloud.tencent.com/npm/",
  cnpm: "https://r.cnpmjs.org/",
  taobao: "https://registry.npmmirror.com/",
  npmMirror: "https://skimdb.npmjs.com/registry/"
};

export interface AdapterNpmOption extends AdapterBaseOption {
  registry?: keyof typeof npmMirror;
}

export class AdapterNpm extends AdapterBase {
  private registry: string;
  constructor(options: AdapterNpmOption) {
    super(options.baseDir);
    this.registry = get(npmMirror, options?.registry || "taobao", npmMirror["taobao"]);
    /** 初始化插件安装目录 */
    const path = resolve(this.baseDir, "package.json");
    writeFileSync(path, JSON.stringify({ dependencies: {} }, null, 2));
  }

  async info(module: string): Promise<AdapterInfo | null> {
    return await got
      .get(`https://cdn.jsdelivr.net/npm/${module}/${this.fileName}`)
      .json<any>()
      .catch(() => null);
  }

  async list(): Promise<AdapterInfo[]> {
    const json = loadJson(resolve(this.baseDir, "package.json"));
    const modules = Object.keys(get(json, "dependencies", []));
    const result = await Promise.all(
      modules.map((m) => loadJson(resolve(this.baseDir, "node_modules", m, this.fileName)))
    );
    return result.filter((f) => f);
  }

  async install(module: string, option: { isDev: boolean } = { isDev: false }): Promise<any> {
    const cmd = option.isDev ? "link" : "install";
    return await this.execCommand(cmd, module);
  }

  async update(module: string): Promise<any> {
    return await this.execCommand("install", `${module}@latest`);
  }

  async uninstall(module: string, option: { isDev: boolean } = { isDev: false }): Promise<any> {
    const cmd = option.isDev ? "unlink" : "uninstall";
    return await this.execCommand(cmd, module);
  }

  private async execCommand(cmd: string, args: string | string[]): Promise<string> {
    const _args = [
      cmd,
      ...(isArray(args) ? args : [args]),
      "--color=always",
      "--save",
      `--registry=${this.registry}`
    ];
    return await this.execCommandBase("npm", _args);
  }
}
