import { existsSync, readdirSync, readFileSync, removeSync } from "fs-extra";
import { defaultsDeep, difference } from "lodash-es";
import { basename, resolve } from "path";
import semver from "semver";

import { Result } from "../helper/result";
import { DownloadInstance, PluginCallOption, PluginConfig } from "../typings";
import { Context } from "./context";
import { checkLifecycle, Lifecycle } from "./lifecycle";
import { PluginManager } from "./download";
import { md5 } from "../helper/utils";

export class Plugin {
  private context: Context;
  /** 默认的配置文件名称 */
  private defaultConfigName: string = "plugin.json";
  /** 默认的更新配置文件名称 */
  private defaultUpdateConfigName: string = "update.json";
  /** 生命周期函数 */
  private lifecycleMap: Map<string, Lifecycle>;
  /** 插件安装的地址 */
  private pluginDir: string;
  /** 下载插件的实例 */
  private downloadPluginManager: PluginManager;

  constructor(context: Context) {
    this.context = context;
    this.lifecycleMap = new Map();
    this.pluginDir = this.context.get("path")!.plugin;
    this.downloadPluginManager = new PluginManager(this.context, this.pluginDir);
    this.init();
  }

  private init() {}

  /** 初始化插件 */
  async initialize() {
    await Promise.all(
      readdirSync(this.pluginDir).map(async (name) => {
        const pluginItemPath = resolve(this.pluginDir, name);
        return await this.load(pluginItemPath);
      })
    );
  }

  private getPluginLocalName(config: PluginConfig) {
    const name = md5(config.name);
    return name;
  }

  /** 插件更新 */
  async update() {
    readdirSync(this.pluginDir).forEach(async (pluginName: string) => {
      const pluginItemDir = resolve(this.pluginDir, pluginName);
      const config = this.loadConfig(pluginItemDir);
      const updateConfigPath = resolve(this.pluginDir, pluginName, this.defaultUpdateConfigName);
      if (!config) return this.context.logger.error("加载插件配置文件失败: ", pluginItemDir);
      if (!existsSync(updateConfigPath))
        return this.context.logger.error("加载插件更新配置文件失败: ", updateConfigPath);

      try {
        const { url } = JSON.parse(readFileSync(updateConfigPath).toString());
        const lastConfig = await this.downloadPluginManager.getConfig(url, this.pluginDir);
        if (lastConfig.status !== 200 || !lastConfig.data?.version) return config;
        const lastVersion = lastConfig.data.version;
        if (semver.gte(config.version, lastVersion)) return;
        const name = "";
        const result = await this.downloadPluginManager.download(url, "");
        if (result.status !== 200) return result;
        await this.unload(pluginItemDir);
        await this.load(result.data);
      } catch (e: any) {
        this.context.logger.error("插件更新遇到报错: " + e.message);
      }
    });
  }

  async install(url: string) {
    const config = await this.downloadPluginManager.getConfig(url, this.defaultConfigName);
    if (config.status !== 200) return config;
    const name = md5(config.data.name);
    const result = await this.downloadPluginManager.download(url, name);
    if (result.status !== 200) return result;
    return await this.load(result.data);
  }

  async uninstall(pluginDir: string) {
    await this.unload(pluginDir);
    existsSync(pluginDir) && removeSync(pluginDir);
    return Result.ok(existsSync(pluginDir));
  }

  /** 加载对应地址(目录)的插件 */
  private async load(pluginDir: string) {
    const config = this.loadConfig(pluginDir);
    if (!config) return Result.error("加载插件失败: " + basename(pluginDir));

    const lackArgs = difference(["name", "version"], Object.keys(config));
    if (lackArgs.length > 0) return Result.error("该插件缺少必须字段: " + lackArgs.join(", "));
    if (this.lifecycleMap.has(config.name)) return Result.error("该插件已经存在");

    const result = checkLifecycle(config);
    if (result.status !== 200) return result;

    const lifecycle = new Lifecycle(this.context, pluginDir, result.data!);
    await lifecycle.mounted();
    this.lifecycleMap.set(config.name, lifecycle);
    return Result.ok(true);
  }

  /** 卸载对应地址的插件 */
  private async unload(pluginDir: string) {
    try {
      const config = this.loadConfig(pluginDir);
      if (!config) return Result.error("加载插件失败: " + basename(pluginDir));
      if (!this.lifecycleMap.has(config.name)) return Result.error("插件不存在");
      const lifecycle = this.lifecycleMap.get(config.name)!;
      await lifecycle.unmounted();
      this.lifecycleMap.delete(config.name);
      return Result.ok("ok");
    } catch (e: any) {
      return Result.error("卸载失败: " + e.message);
    }
  }

  /** 加载配置文件 */
  private loadConfig(pluginDir: string): PluginConfig | null {
    try {
      const configPath = resolve(pluginDir, this.defaultConfigName);
      const content = readFileSync(configPath).toString();
      const result = defaultsDeep(JSON.parse(content), {});
      return result;
    } catch {
      return null;
    }
  }

  async call(name: string, args: any[] = [], option: Partial<PluginCallOption> = {}): Promise<any> {
    return await Promise.all(
      Array.from(this.lifecycleMap.values()).map(async (lifecycle) => {
        if (option?.name && lifecycle.option.name !== option.name) return null;
        return await lifecycle.call(name, ...args);
      })
    );
  }
}
