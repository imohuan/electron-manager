import { app, ipcMain, ipcRenderer } from "electron";
import { get, isEmpty, set, defaultsDeep } from "lodash-es";
import { resolve, dirname } from "path";

import { ManagerData } from "../typings/manager";
import { cloneData } from "../helper/utils";

export class Global<T extends ManagerData<any> = ManagerData<any>> {
  /** 是否是主进程 */
  isMain: boolean;

  constructor() {
    this.isMain = !!ipcMain;
    if (this.isMain) {
      const isDev = require("electron-is-dev");
      const base = isDev ? resolve(process.cwd(), "dist/datas") : dirname(app.getPath("exe"));
      console.log("[Base]", base);
      defaultsDeep(global, {
        isDev,
        windows: new Map(),
        path: {
          base,
          log: resolve(base, "log"),
          config: resolve(base, "config.json"),
          cache: resolve(base, "cache"),
          home: app.getPath("home"),
          store: resolve(base, "store"),
          plugin: resolve(base, "plugin"),
          project: resolve(base, "project")
        }
      } as ManagerData<any>);

      ipcMain.on("get-global-data", (event, name) => {
        let value = get(global, name, null);
        if (value instanceof Map) {
          value = Array.from(value.entries()).reduce((pre, [k, v]) => {
            return Object.assign(pre, { [k]: v });
          }, {});
        }
        event.returnValue = cloneData(value);
      });
    }
  }

  /** 获取全局变量 */
  get(): T;
  get<K extends keyof T>(name: K): T[K];
  get<K extends keyof T>(name?: K): T | T[K] | null {
    if (this.isMain) {
      if (name) return get(global, name, null) as T[K];
      return global as any as T;
    } else {
      if (name) return ipcRenderer.sendSync("get-global-data", name);
      else return null;
    }
  }

  /** 获取地址 */
  getPath(): ManagerData<void>["path"];
  getPath<K extends keyof ManagerData<void>["path"]>(key: K): ManagerData<void>["path"][K];
  getPath<K extends keyof ManagerData<void>["path"]>(key?: K): ManagerData<void>["path"][K] {
    const path = this.get("path" as any) as ManagerData<void>["path"];
    return isEmpty(key) ? path : get(path, key as any, null);
  }

  /** 设置全局变量 */
  set<K extends keyof T>(name: K, value: T[K]): void {
    set(global, name, value);
  }
}
