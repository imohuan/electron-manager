import { BrowserWindow, webContents } from "electron";
import { defaultsDeep, get, set } from "lodash-es";

import { isMain } from "../helper/electron";
import { Context } from "./context";

import type { Window } from "../typings";
export class WindowFactory {
  context: Context;
  private winMap: Map<string, any>;

  constructor(context: Context) {
    this.context = context;
    this.winMap = new Map();
    this.init();
  }

  private init() {
    const remoteInitName = "remote-init";
    if (isMain() && !get(global, remoteInitName, false)) {
      require("@electron/remote/main").initialize();
      set(global, remoteInitName, true);
    }
  }

  create(name: string, opts: Window): BrowserWindow {
    const { enable } = require("@electron/remote/main");
    if (this.winMap.has(name)) {
      const win: BrowserWindow = this.winMap.get(name);
      if (!win.isDestroyed()) return win;
    }

    const option: Window = defaultsDeep(opts, {
      webPreferences: {
        webSecurity: false,
        contextIsolation: false,
        nodeIntegration: true,
        nodeIntegrationInWorker: true,
        nodeIntegrationInSubFrames: true,
        allowRunningInsecureContent: true
      }
    } as Window);
    if (option.webview) option.webPreferences!.webviewTag = true;
    const window = new BrowserWindow(option);
    enable(window.webContents);

    if (option.url) window.loadURL(option.url);
    else if (option.file) window.loadFile(option.file);
    else if (option.path)
      option.path.startsWith("http") ? window.loadURL(option.path) : window.loadFile(option.path);

    if (option.devtool) window.webContents.openDevTools({ mode: option.devtool });
    if (option.webview) {
      window.webContents.on("will-attach-webview", () => {
        webContents.getAllWebContents().forEach((item) => enable(item));
      });
    }

    this.winMap.set(name, window);
    this.context
      .get("windows")!
      .set(name, { name, id: window.id, webContentId: window.webContents.id, option });

    window.on("close", () => {
      const webContentId = window.webContents.id;
      this.context.ipc.clear(webContentId);
      this.delete(name);
      if (option?.reload) this.create(name, option);
    });

    return window;
  }

  /** 删除并且销毁对应名称的窗口 */
  delete(name: string) {
    if (this.winMap.has(name)) {
      const win: BrowserWindow = this.winMap.get(name);
      !win.isDestroyed() && win.destroy();
      this.winMap.delete(name);
      this.context.get("windows")!.delete(name);
    }
  }

  /** 销毁所有创建的窗口 */
  destroy() {
    this.winMap.forEach((_: BrowserWindow, name: string) => this.delete(name));
  }

  /** 获取对应名称的窗口实例 */
  get(name: string): any {
    return this.winMap.get(name);
  }
}
