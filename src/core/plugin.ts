import {
  copySync,
  ensureDirSync,
  existsSync,
  readdirSync,
  readFileSync,
  removeSync,
  writeFileSync
} from "fs-extra";
import getLatestVersion from "latest-version";
import { difference } from "lodash-es";
import { basename, resolve } from "path";
import semver from "semver";

import { downloadNpm, GithubInfo, GitInfo } from "../helper/info";
import { Result } from "../helper/result";
import { PluginCallOption, PluginConfig, PluginInstallType, UpdateItem } from "../typings/plugin";
import { checkLifecycle, Lifecycle } from "./lifecycle";

class PluginBase {
  private defaultConfigName: string = "plugin.json";
  private lifecycleMap: Map<string, Lifecycle>;

  constructor() {
    this.lifecycleMap = new Map();
    this.init();
  }

  /** 插件初始化 */
  private async init() {
    const path = manager.getPath("plugin");
    ensureDirSync(path);
    await Promise.all(
      readdirSync(path).map(async (name) => {
        const result = await this.load(resolve(path, name));
        if (result.status !== 200) manager.logger.error(result.message);
      })
    );

    manager.ipc.handle("plugin-install", async (_, urlOrName, pluginName) => {
      return await this.installBase(urlOrName, pluginName);
    });

    manager.ipc.handle("plugin-uninstall", async (_, pluginName) => {
      return await this.uninstallBase(pluginName);
    });

    manager.ipc.handle("plugin-call", async (_, name, args, option) => {
      return await this.callBase(name, args, option || {});
    });
  }

  /** 根据插件名称获取插件本地目录 */
  private getPlugin(name: string) {
    const { plugin } = manager.get("path");
    return resolve(plugin, name);
  }

  /** 下载插件，并且保存到本地插件目录之下 */
  protected async installBase(urlOrName: string, pluginName: string): Promise<Result> {
    try {
      const gitInstance = new GitInfo(urlOrName, this.defaultConfigName);
      const githubInstance = new GithubInfo(urlOrName, this.defaultConfigName);

      let pluginPath = this.getPlugin(pluginName);
      // 1. 插件存在则直接删除重新安装
      if (existsSync(pluginPath)) removeSync(pluginPath);
      // 2. 插件只支持2个进程，主进程和渲染进程
      let result: Result;
      let type: PluginInstallType = "url";
      if (urlOrName.startsWith("https://gitee.com/")) {
        if (!pluginName.trim()) {
          pluginName = (await gitInstance.getInfo()).name;
          pluginPath = this.getPlugin(pluginName);
        }
        result = await gitInstance.download(pluginPath);
        type = "gitee";
      } else if (urlOrName.startsWith("https://github.com/")) {
        if (!pluginName.trim()) {
          pluginName = (await githubInstance.getInfo()).name;
          pluginPath = this.getPlugin(pluginName);
        }
        result = await githubInstance.download(pluginPath);
        type = "github";
      } else if (urlOrName.startsWith("http")) {
        result = Result.error("----");
        type = "url";
      } else if (existsSync(urlOrName)) {
        const config = this.loadConfig(urlOrName);
        if (!config) return (result = Result.error("获取配置失败"));
        if (!pluginName.trim()) pluginPath = this.getPlugin(config.name);
        if (config.debug === false) copySync(urlOrName, pluginPath);
        else pluginPath = urlOrName;
        result = Result.ok("ok");
        type = "local";
      } else {
        result = await downloadNpm(urlOrName, pluginPath);
        type = "npm";
      }

      if (result.status !== 200) {
        manager.logger.error(result.message);
        return result;
      }

      const update: UpdateItem = { url: urlOrName, type };
      writeFileSync(resolve(pluginPath, "update.json"), JSON.stringify(update, null, 2));

      const loadResult = await this.load(pluginPath);
      if (loadResult.status !== 200) manager.logger.error(loadResult.message);
      return loadResult;
    } catch (e: any) {
      return Result.error("安装出错： " + e.message);
    }
  }

  /** 卸载本地插件 */
  protected async uninstallBase(pluginNameOrPath: string): Promise<Result> {
    const pluginPath = this.getPlugin(pluginNameOrPath);
    !existsSync(pluginNameOrPath) && existsSync(pluginPath) && removeSync(pluginPath);
    return await this.unload(pluginNameOrPath);
  }

  private async updateItem(
    name: string,
    version: string,
    url: string,
    type: UpdateItem["type"]
  ): Promise<null | Result> {
    let latestVersion = "";
    const gitInstance = new GitInfo(url, this.defaultConfigName);
    if (type === "gitee" || type === "github")
      latestVersion = (await gitInstance.getInfo()).version;
    // TODO 自定义网页插件
    // if (type === "url") latestVersion = await getUrlVersion(url, this.defaultConfigName);
    if (type === "npm") latestVersion = await getLatestVersion(url);
    if (!latestVersion.trim()) return null;
    if (semver.lt(version, latestVersion)) {
      // 存在最新版本
      // TODO 测试阶段直接进行更新
      console.log("存在最新版本: ", latestVersion);
      manager.ipc.invoke("plugin-update", [name]);
      // 1. 卸载之前版本的插件
      await this.uninstallBase(name);
      // 2. 重新安装最新版本
      return await this.installBase(url, name);
    } else return null;
  }

  /** 更新当前存在的插件 */
  protected async updateBase() {
    const path = manager.getPath("plugin");
    readdirSync(path).forEach((name) => {
      const updatePath = resolve(path, name, "update.json");
      if (!existsSync(updatePath)) return;
      try {
        const { url, type } = JSON.parse(readFileSync(updatePath).toString()) as UpdateItem;
        if (!url || !type) return manager.logger.error("解析更新配置失败: ", updatePath);
        const config = this.loadConfig(resolve(path, name));
        if (!config) return manager.logger.error("解析更新配置失败: ", updatePath);
        this.updateItem(name, config.version, url, type);
      } catch (e: any) {}
    });
  }

  /** 加载配置 */
  private loadConfig(pluginDir: string): PluginConfig | null {
    try {
      const configPath = resolve(pluginDir, this.defaultConfigName);
      const content = readFileSync(configPath).toString();
      return JSON.parse(content);
    } catch {
      return null;
    }
  }

  /**
   * 加载本地插件
   * @param pluginPath 插件目录
   */
  private async load(pluginPath: string): Promise<Result> {
    const pluginName = basename(pluginPath);
    const config = this.loadConfig(pluginPath);
    if (!config) return Result.error("加载插件失败: " + pluginName);
    const lackArgs = difference(["name", "version"], Object.keys(config));
    if (lackArgs.length > 0) return Result.error("该插件缺少必须字段: " + lackArgs.join(", "));
    if (this.lifecycleMap.has(pluginName)) return Result.error("该插件已经存在");
    const result = checkLifecycle(config);
    if (result.status !== 200) return result;
    const lifecycle = new Lifecycle(pluginPath, result.data!);
    await lifecycle.mounted();
    this.lifecycleMap.set(pluginName, lifecycle);
    return Result.ok(true);
  }

  /** 取消已经再程序中加载的插件 */
  private async unload(pluginName: string) {
    if (!this.lifecycleMap.has(pluginName)) return Result.error("插件不存在");
    const lifecycle = this.lifecycleMap.get(pluginName)!;
    await lifecycle.unmounted();
    this.lifecycleMap.delete(pluginName);
    return Result.ok("ok");
  }

  /** 调用命令 */
  protected async callBase(
    name: string,
    args: any[] = [],
    option: Partial<PluginCallOption> = {}
  ): Promise<any> {
    // TODO 这里的插件绑定都在同一个进程中， 如果在不同的进程调用插件会获取不到数据
    return await Promise.all(
      Array.from(this.lifecycleMap.values()).map(async (lifecycle) => {
        if (option?.name && lifecycle.option.name !== option.name) return null;
        return await lifecycle.call(name, ...args);
      })
    );
  }
}

export class Plugin extends PluginBase {
  controller() {}

  async call(name: string, args: any[] = [], option: Partial<PluginCallOption> = {}): Promise<any> {
    const result = await manager.ipc.invoke("plugin-call", [name, args, option], {
      name: ["main", "plugin"]
    });
    return result.nonEmptyFirst();
  }

  async install(urlOrName: string, pluginName: string): Promise<Result | null> {
    const result = await manager.ipc.invoke("plugin-install", [urlOrName, pluginName], {
      name: ["main", "plugin"]
    });
    return result.nonEmptyFirst()?.result || null;
  }

  async uninstall(pluginName: string): Promise<Result | null> {
    const result = await manager.ipc.invoke("plugin-uninstall", [pluginName], {
      name: ["main", "plugin"]
    });
    return result.nonEmptyFirst()?.result || null;
  }

  update() {}
}
