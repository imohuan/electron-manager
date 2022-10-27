import { BrowserWindow, webContents } from "electron";
import { defaultsDeep, random } from "lodash-es";
import type { Window } from "../typings/index";

export class WindowFactory {
  private winMap: Map<string, any>;

  constructor() {
    this.winMap = new Map();
  }

  createMain(opts: Window): BrowserWindow {
    return this.create("renderer", opts);
  }

  createPlugin(opts: Window): BrowserWindow {
    return this.create("plugin", opts);
  }

  create(name: string, opts: Window): BrowserWindow {
    // if (name === "renderer" || name === "plugin") name = name + "_" + random(10000, 99999);
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
    this.setWindowOption(name, window, option);

    window.on("close", () => {
      const webContentId = window.webContents.id;
      manager.ipc.clear(webContentId);
      this.delete(name);
      if (option?.reload) this.create(name, option);
    });

    return window;
  }

  private setWindowOption(name: string, window: BrowserWindow, option: Window) {
    manager
      .get("windows")
      .set(name, { name, id: window.id, webContentId: window.webContents.id, option });
  }

  private deleteWindowOption(name: string) {
    manager.get("windows").delete(name);
  }

  /** 删除并且销毁对应名称的窗口 */
  delete(name: string) {
    if (this.winMap.has(name)) {
      const win: BrowserWindow = this.winMap.get(name);
      !win.isDestroyed() && win.destroy();
      this.winMap.delete(name);
      this.deleteWindowOption(name);
    }
  }

  /** 销毁所有创建的窗口 */
  destroy() {
    this.winMap.forEach((win: BrowserWindow, name: string) => {
      !win.isDestroyed() && win.destroy();
      this.winMap.delete(name);
      this.deleteWindowOption(name);
    });
  }

  /** 获取对应名称的窗口实例 */
  get(name: string): any {
    return this.winMap.get(name);
  }
}
