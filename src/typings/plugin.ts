import { PluginDownload } from "../core/download";
import { Result } from "../helper/result";
import { Context } from "../core/context";

export type DownloadInstance = new (
  context: Context,
  url: string,
  pluginDir: string
) => PluginDownload;

export interface PluginConfig {
  /** 名称 */
  name: string;
  /** 图标 */
  icon: string;
  /** 版本号 */
  version: string;
  /** 说明 */
  description: string;
  /** 热重载 */
  hot: boolean;
  /** 仅限本地调试，其他模式均为 false */
  debug: boolean;
  /** 脚本地址 */
  script: string | { main: string; renderer: string };
}

export interface PluginCallOption {
  /** 指定插件名称 */
  name: string;
}

export interface PluginEvent {
  // call(name: string, args: any[], option: Partial<PluginCallOption>): Promise<any>;
  install(urlOrName: string, pluginName: string): Promise<Result | null>;
  uninstall(pluginName: string): Promise<Result | null>;
  update(): any;
}
