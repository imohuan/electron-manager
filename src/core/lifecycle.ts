import { Result } from "../helper/result";
import { defaultsDeep, isFunction, get } from "lodash-es";
import { PluginConfig } from "../typings/plugin";
import { isString } from "lodash-es";

/** 检查插件详情内容是否符合标准 */
export function checkLifecycle(config: PluginConfig): Result<PluginConfig | null> {
  if (!/^[a-zA-Z]{1}[a-zA-Z0-9_]+$/.test(config.name)) return Result.error("插件名称出现意外字符");
  if (!config.version.trim()) return Result.error("版本号有误");
  config = defaultsDeep(config, { debug: false, hot: false } as PluginConfig);
  return Result.ok(config);
}

export class Lifecycle {
  /** 插件地址 */
  path: string;
  /** 脚本 */
  script: string;
  /** 插件启用状态 */
  status: "enable" | "disable";
  /** 配置数据 */
  option: PluginConfig;
  /** 脚本 */
  pluginScripts: any;

  constructor(path: string, option: PluginConfig) {
    this.path = path;
    this.option = option;
    this.status = "enable";

    const key = manager.isMain ? "main" : "renderer";
    if (isString(this.option.script)) {
      this.script = this.option.script;
    } else if (manager.name === key) {
      this.script = this.option.script[key];
    } else {
      this.script = "";
    }

    this.pluginScripts = {};
  }

  async call(name: string, ...args: any[]) {
    if (this.status !== "enable" || !this.script.trim()) return null;

    if (this.option.hot) {
      delete require.cache[this.script];
      await this.loadScript();
    }

    const cb = get(this.pluginScripts, name);
    if (!cb) return null;

    try {
      return await cb(...args);
    } catch (e) {
      manager.logger.error(
        "执行插件方法失败: ",
        JSON.stringify({ path: this.path, name: name, args }, null, 2)
      );
      return null;
    }
  }

  private async loadScript() {
    if (!this.script.trim()) return;
    try {
      const pluginScripts = require(this.script);
      if (isFunction(pluginScripts)) {
        this.pluginScripts = await pluginScripts(manager, require("electron"));
      } else {
        this.pluginScripts = pluginScripts;
      }
    } catch (e: any) {
      manager.logger.error(`加载插件 出现异常:`, e.message);
    }
  }

  async mounted() {
    this.loadScript();
  }

  async unmounted() {
    if (this.pluginScripts?.destroy) await this.pluginScripts?.destroy();
    this.pluginScripts = {};
  }
}

// Plugin 返回一个对象绑定在 Lifecycle 中
// 同时插件提供一些声明周期监听
