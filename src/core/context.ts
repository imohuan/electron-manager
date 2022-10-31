import { BrowserWindow } from "electron";
import { set } from "lodash-es";
import { resolve } from "path";

import { Logger } from "@imohuan/log";

import { ConfigStore, JsonStore } from "../helper/store";
import { WindowFactory } from "../logic/window";
import { ContextEvent, GlobalData, IpcRouter, MergeGlobal, WindowOption } from "../typings";
import { PluginDownload, PluginManager } from "./download";
import { Global } from "./global";
import { Ipc } from "./ipc";
import { Plugin } from "./plugin";

export type ObjFunc = Record<string, (...args: any[]) => any>;
export type MergeContext<T = {}> = T & ContextEvent;
export type MergeIpc<T = {}> = T & IpcRouter;

export class Context<
  G extends Record<string, any> = {},
  UserEvent extends ObjFunc = {},
  Router extends ObjFunc = {}
> extends Global<G> {
  /** 当前进程的名称 */
  name: string;
  /** 数据存储 */
  store: JsonStore;
  /** 项目配置 */
  config: ConfigStore;
  /** 日志功能 */
  logger: Logger;
  /** 窗口创建 */
  window: WindowFactory | null = null;
  /** ipc 路由 */
  ipc: Ipc<MergeIpc<Router>>;
  /** 插件服务 */
  plugin: Plugin;

  constructor(global: Partial<MergeGlobal<G>> = {}) {
    super(global);
    this.hot();
    this.init();

    const { config, base, project, log } = this.get("path")! as MergeGlobal["path"];
    this.name = this.getCurrentOption()?.name || "unknown";
    this.config = new ConfigStore(config!);

    if (this.isMain) {
      this.window = new WindowFactory();
      this.store = new JsonStore(resolve(base!, "store.json"));
      this.logger = new Logger({ dirname: log, label: "Main" });
    } else {
      this.store = new JsonStore(resolve(project!, this.name, "store.json"));
      this.logger = new Logger({
        dirname: resolve(project!, this.name, "log"),
        label: `Server-${this.name}`
      });
    }

    this.ipc = new Ipc(this);
    this.plugin = new Plugin(this);
  }

  private init() {
    set(this.isMain ? global : window, "ctx", this);
  }

  /** 获取当前窗口 */
  getCurrentWindow(): BrowserWindow | null {
    if (this.isMain) return null;
    return require("@electron/remote").getCurrentWindow() as BrowserWindow;
  }

  /** 获取当前的窗口配置 */
  getCurrentOption(): WindowOption | null {
    const currentWindow = this.getCurrentWindow();
    if (!currentWindow) {
      if (this.isMain) return { id: -1, webContentId: -1, name: "main", option: {} };
      return currentWindow;
    }
    const id = currentWindow.id;
    const webContentId = currentWindow.webContents.id;
    const windowOptionMap = this.get("windows")!;
    return (
      Array.from(Object.values(windowOptionMap)).find(
        (f: WindowOption) => f.id === id && f.webContentId === webContentId
      ) || null
    );
  }

  /**
   * 监听事件
   * @param name 事件名称
   * @param callback 事件回调
   */
  on<K extends keyof MergeContext<UserEvent>, F extends MergeContext<UserEvent>[K]>(
    name: K,
    callback: F
  ) {}

  /**
   * 发送事件
   * @param name 事件名称
   * @param args 事件回调的参数
   */
  emit<K extends keyof MergeContext<UserEvent>, P extends Parameters<MergeContext<UserEvent>[K]>>(
    name: K,
    ...args: P
  ) {}

  /**
   * 取消监听事件
   * @param name 事件名称
   * @param callback 事件回调
   */
  off<K extends keyof MergeContext<UserEvent>, F extends MergeContext<UserEvent>[K]>(
    name: K,
    callback: F
  ) {}

  override set<K extends keyof G | keyof GlobalData>(name: K, value: MergeGlobal<G>[K]): void {
    super.set(name, value);
    // this.ipc?.publisher(`UPDATE_STORE:${name as string}`, value as any);
  }

  /** 渲染进程热重载 */
  private hot() {
    if (this.isMain || !this.isDev) return;
    const socket = new WebSocket("ws://127.0.0.1:36600");
    socket.addEventListener("open", () => {
      socket.addEventListener("message", (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === "refresh") location.reload();
        } catch (e) {}
      });
    });
  }
}

export type CustomEvent = {
  unload: () => void;
};

// export const ctx = new Context({}, PluginDownload);
