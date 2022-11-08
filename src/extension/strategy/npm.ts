import { existsSync, statSync, writeFileSync } from "fs-extra";
import got from "got";
import { get } from "lodash-es";
import { resolve } from "path";
import { Result } from "../../helper/result";
import { loadJson } from "../../helper/utils";

import { ExtensionInfo } from "../typings";
import {
  AbstractStrategy,
  ExtensionCallInfoOption,
  ExtensionCallListOption,
  ExtensionCallOption,
  ExtensionCallResult,
  ExtensionStrategyOption
} from "./abstract";

export const npmMirror = {
  npm: "https://registry.npmjs.org/",
  yarn: "https://registry.yarnpkg.com/",
  tencent: "https://mirrors.cloud.tencent.com/npm/",
  cnpm: "https://r.cnpmjs.org/",
  taobao: "https://registry.npmmirror.com/",
  npmMirror: "https://skimdb.npmjs.com/registry/"
};

interface StrategyNpmOption {
  registry?: keyof typeof npmMirror;
}

export class StrategyNpm extends AbstractStrategy {
  private registry: string;

  constructor(option: ExtensionStrategyOption & StrategyNpmOption) {
    super(option);
    this.registry = get(npmMirror, option?.registry || "taobao", npmMirror["taobao"]);
    /** 初始化插件安装目录 */
    const path = resolve(this.option.baseDir, "package.json");
    if (!existsSync(path)) {
      writeFileSync(path, JSON.stringify({ dependencies: {} }, null, 2));
    }
  }

  async info(
    module: string,
    option: Partial<ExtensionCallInfoOption>
  ): Promise<ExtensionInfo | null> {
    if (option?.local) {
      return loadJson(resolve(this.option.baseDir, "node_modules", module, this.option.fileName));
    } else {
      return await got
        .get(`https://cdn.jsdelivr.net/npm/${module}/${this.option.fileName}`)
        .json<any>()
        .catch(() => null);
    }
  }

  async list(option: Partial<ExtensionCallListOption>): Promise<ExtensionInfo[]> {
    const json = loadJson(resolve(this.option.baseDir, "package.json"));
    const modules = Object.keys(get(json, "dependencies", []));
    const result = await Promise.all(
      modules.map((m) =>
        loadJson(resolve(this.option.baseDir, "node_modules", m, this.option.fileName))
      )
    );
    return result.filter((f) => f);
  }

  async install(
    module: string,
    option: Partial<ExtensionCallOption>
  ): Promise<Result<ExtensionCallResult>> {
    return await this.execCommand("install", module);
  }

  async update(
    module: string,
    option: Partial<ExtensionCallOption>
  ): Promise<Result<ExtensionCallResult>> {
    return await this.execCommand("install", `${module}@latest`);
  }

  async uninstall(
    module: string,
    option: Partial<ExtensionCallOption>
  ): Promise<Result<ExtensionCallResult>> {
    return await this.execCommand("uninstall", module);
  }

  private async execCommand(cmd: string, module: string): Promise<any> {
    const _args = [cmd, module, "--color=always", "--save", `--registry=${this.registry}`];
    const start = new Date().getTime();
    const path = resolve(this.option.baseDir, "node_modules", module);
    const _process = await this.execCommandBase("npm", _args, {
      onMessage: (_, msg) => {
        this.option.hooks.invoke("extension-progress", { type: "loading" });
      }
    });
    _process.process.on("error", (err) => Result.error(`操作失败: ${err.message}`));
    return Result.ok({
      time: new Date().getTime() - start,
      path,
      size: existsSync(path) ? statSync(path).size : 0,
      name: module
    });
  }
}
