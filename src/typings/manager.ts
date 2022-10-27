import { IpcRaw } from "./ipc";
import { WindowOption } from "./window";

export type ManagerData<T> = {
  isDev: boolean;
  ipc: Map<string, Omit<IpcRaw, "callback">[]>;
  windows: Map<string, WindowOption>;
  path: {
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
  };
} & T;
