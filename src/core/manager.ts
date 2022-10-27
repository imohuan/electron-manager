import { app, BrowserWindow } from "electron";
import { set } from "lodash-es";
import { resolve } from "path";

import { Logger } from "@imohuan/log";

import { ConfigStore, JsonStore } from "../helper/store";
import { WindowFactory } from "../logic/window";
import { IpcRouter } from "../typings/ipc";
import { ManagerData } from "../typings/manager";
import { WindowOption } from "../typings/window";
import { Global } from "./global";
import { Ipc } from "./ipc";
import { Plugin } from "./plugin";
import { checkUpdate } from "./update";

/**
 * Electron 集中管理器
 * 泛型 T: 全局变量声明
 * 泛型 R: 全局Ipc路由声明
 */
export class Manager<
  T extends ManagerData<Record<string, any>> = ManagerData<Record<string, any>>,
  R extends Record<string, (...args: any) => any> = IpcRouter
> extends Global<T> {
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
  /** 插件服务 */
  plugin: Plugin;
  /** ipc 路由 */
  ipc: Ipc<R>;

  constructor() {
    super();
    this.hot();
    this.init();

    const { config, base, project, log } = this.getPath();
    this.name = this.currentOption?.name || "unknown";
    this.config = new ConfigStore(config);

    if (this.isMain) {
      this.window = new WindowFactory();
      this.store = new JsonStore(resolve(base, "store.json"));
      this.logger = new Logger({ dirname: log, label: "Main" });
    } else {
      this.store = new JsonStore(resolve(project, this.name, "store.json"));
      this.logger = new Logger({
        dirname: resolve(project, this.name, "log"),
        label: `Server-${this.name}`
      });
    }

    this.ipc = new Ipc();
    this.plugin = new Plugin();
    this.initPlugin();
  }

  /** 检查软件的更新 */
  update() {
    checkUpdate();
  }

  initPlugin() {
    if (!this.isMain) return;
    app.whenReady().then(() => {
      this.window!.createPlugin({
        devtool: "bottom",
        path: "G:\\level-2\\Project\\electron-manager\\src-electron\\index.html",
        webPreferences: {
          preload: "G:\\level-2\\Project\\electron-manager\\dist\\preloads\\plugin.js"
        }
      });
    });
  }

  private init() {
    if (this.isMain) {
      require("@electron/remote/main").initialize();
      set(global, "manager", this);
    } else {
      set(window, "manager", this);
    }
  }

  get currentWindow() {
    if (this.isMain) return null;
    return require("@electron/remote").getCurrentWindow() as BrowserWindow;
  }

  /** 获取当前 */
  get currentOption(): WindowOption | null {
    if (!this.currentWindow) {
      if (this.isMain) return { id: -1, webContentId: -1, name: "main", option: {} };
      return this.currentWindow;
    }
    const windowOptionMap = this.get("windows" as any) as ManagerData<void>["windows"];
    const id = this.currentWindow.id;
    const webContentId = this.currentWindow.webContents.id;
    return (
      Array.from(Object.values(windowOptionMap)).find(
        (f) => f.id === id && f.webContentId === webContentId
      ) || null
    );
  }

  override set<K extends keyof T>(name: K, value: T[K]): void {
    super.set(name, value);
    this.ipc?.publisher(`UPDATE_STORE:${name as string}`, value as any);
  }

  private hot() {
    if (this.isMain || !this.get("isDev")) return;
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
