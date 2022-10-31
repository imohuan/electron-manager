import { IpcRaw } from "./ipc";
import { WindowOption } from "./window";

export interface PathOption {
  base: string;
  /** 日志地址 */
  log: string;
  /** 用户主机地址 */
  home: string;
  /** 缓存地址 */
  cache: string;
  /** 配置地址 */
  config: string;
  /** 存储地址 */
  store: string;
  /** 插件目录 */
  plugin: string;
  /** 项目地址 */
  project: string;
}

export interface GlobalData {
  /** 是否是开发环境 */
  isDev: boolean;
  /** ipc全局路由配置信息 */
  ipc: Map<string, Omit<IpcRaw, "callback">[]>;
  /** 窗口全局配置信息 */
  windows: Map<string, WindowOption>;
  /** 软件的配置地址 */
  path: PathOption;
}

export type MergeGlobal<T = {}> = T & GlobalData;
