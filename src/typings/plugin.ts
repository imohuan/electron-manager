import { Manager } from "../core/manager";
import Electron from "electron";

import { Result } from "../helper/result";
import { IpcRouter } from "./ipc";
import { ManagerData } from "./manager";

export type PluginInstallType = "npm" | "local" | "url" | "github" | "gitee";
export type UpdateItem = { url: string; type: PluginInstallType };

export type UserPlugin =
  | { [key: string]: Function }
  | ((
      manager: Manager<ManagerData<Record<string, any>>, IpcRouter>,
      electron: typeof Electron
    ) => Promise<any>);

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

// onAppStart?(): any;
// onAppEnd?(): any;
// onWindowCreate?(): any;
// onWindowClose?(): any;
// onWebContentLoad?(): any;

export interface UpdateOption {
  /** 已经检查了的插件 */
  hasCheck: PluginConfig[];
  /** 已经检查了的插件 */
  noCheck: string[];
  /** 检查的状态 */
  type: "start" | "cron";
  /** 定时检查时间 */
  cron: string;
}

export interface PluginCallOption {
  /** 指定插件名称 */
  name: string;
}

export interface PluginBase {
  call(name: string, args: any[], option: Partial<PluginCallOption>): Promise<any>;
  install(urlOrName: string, pluginName: string): Promise<Result | null>;
  uninstall(pluginName: string): Promise<Result | null>;
  update(): any;
}
