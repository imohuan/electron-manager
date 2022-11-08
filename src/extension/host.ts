import { writeFileSync } from "fs-extra";
import { defaultsDeep, get, lt } from "lodash-es";
import { dirname, resolve } from "path";
import { Result } from "src/helper/result";
import { loadJson } from "src/helper/utils";
import { Hooks } from "./hooks";
import { ExtensionStrategy } from "./strategy";
import { ExtensionStrategyOption } from "./strategy/abstract";
import { ExtensionInfo } from "./typings";

export interface ExtensionHostOption extends ExtensionStrategyOption {
  strategy?: ExtensionStrategy;
}

export class ExtensionHost {
  private option: ExtensionHostOption;
  private strategy: ExtensionStrategy;
  private plugins: Map<string, any>;
  private hooks: Hooks;
  private hookMap: Map<string, { name: string; func: Function }> = new Map();

  constructor(ops: Partial<ExtensionHostOption> = {}) {
    this.option = defaultsDeep(ops, {
      fileName: "plugin.json",
      baseDir: resolve(__dirname, "plugin")
    } as ExtensionHostOption);

    this.plugins = new Map();
    this.hooks = new Hooks();

    this.strategy =
      this.option?.strategy ||
      new ExtensionStrategy({
        baseDir: this.option.baseDir,
        fileName: this.option.fileName,
        hooks: this.hooks
      });
  }

  async init() {
    const list: (ExtensionInfo & { repo: string; path: string })[][] = await this.strategy.callList(
      "list",
      { local: true }
    );
    return Promise.all(list.flat(1).map((item) => this.load(item.repo, item.path, item)));
  }

  private urlInfo(url: string) {
    const [name, ...uris] = url.split("+");
    return { name, uri: uris.join("+") };
  }

  /**
   * 安装插件
   * @param url npm+axios | git+https://github.com/imohuan/electron-manager-demo.git
   */
  async install(url: string): Promise<Result<boolean>> {
    const { name, uri } = this.urlInfo(url);
    const result = await this.strategy.call(name, "install", uri, {
      isDev: false
    });
    if (!result) return Result.error("安装失败 未找到对应的安装策略");
    if (!result.isOk()) return result as Result;
    const optionFile = resolve(result.data.path, this.option.fileName);
    const extensionOption: ExtensionInfo = loadJson(optionFile);
    if (!extensionOption) return Result.error("安装失败 解析插件配置失败: " + result.data.name);
    return await this.load(url, optionFile, extensionOption);
  }

  private async load(
    url: string,
    optionFile: string,
    extensionOption: ExtensionInfo
  ): Promise<Result<boolean>> {
    const result = await require(resolve(dirname(optionFile), extensionOption.main))?.apply(
      this.hooks
    );
    if (!result) return Result.error("安装失败 插件初始化失败: " + extensionOption.main);
    if (this.plugins.has(extensionOption.name))
      return Result.error("安装失败 插件名称已经存在: " + extensionOption.main);
    this.plugins.set(extensionOption.name, result);
    await this.hooks.invokePromise("extension-init", { url, info: extensionOption });
    writeFileSync(
      optionFile,
      JSON.stringify(defaultsDeep({ repo: url }, extensionOption), null, 2)
    );
    this.hookMap.set(extensionOption.name, "");
    return Result.ok(true);
  }

  async update(url: string) {
    const { name, uri } = this.urlInfo(url);
    await this.strategy.call(name, "update", uri, { isDev: false });
    const info = await this.strategy.call(name, "info", uri, { local: true });
    await this.hooks.invokePromise("extension-update", { url, name, info });
    if (!info) return null;
    this.plugins.delete(info.name);
    await this.hooks.invokePromise("extension-destroy", { url, name, info });
    return await this.load(url, get(info, "path", ""), info);
  }

  async uninstall(url: string) {
    const { name, uri } = this.urlInfo(url);
    const info = await this.strategy.call(name, "info", uri, { local: true });
    await this.hooks.invokePromise("extension-destroy", { url, name, info });
    return await this.strategy.call(name, "uninstall", uri, { isDev: false });
  }

  async call(pluginName: string, funName: string, ...args: any[]) {
    if (!this.plugins.has(pluginName)) return Result.error("未找到对应插件: " + pluginName);
    const obj = this.plugins.get(pluginName);
    if (!obj?.[funName]) return Result.error(`未找到对应方法: ${pluginName}-${funName}`);
    try {
      return await obj[funName](...args);
    } catch (e: any) {
      return Result.error(`执行命令错误: ${pluginName}-${funName}-${e.message}`);
    }
  }

  async autoUpdate(option: { force?: boolean }) {
    const list: (ExtensionInfo & { repo: string })[][] = await this.strategy.callList("list", {
      local: true
    });

    await Promise.all(
      list.flat(1).map(async (item) => {
        const oldVersion = item.version;
        const { name, uri } = this.urlInfo(item.repo);
        const info = await this.strategy.call(name, "info", uri, {});
        const laseVersion = get(info, "version", "0.0.0");
        if (lt(oldVersion, laseVersion)) {
          if (option?.force) {
            return await this.update(item.repo);
          } else {
            await this.hooks.invokePromise("extension-update-msg", { url: item.repo, name, info });
            return true;
          }
        } else return false;
      })
    );
  }
}
