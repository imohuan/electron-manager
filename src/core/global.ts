import { app, ipcMain, ipcRenderer } from "electron";
import { defaultsDeep, get, set } from "lodash-es";
import { dirname, resolve } from "path";

import { isDev, isMain } from "../helper/electron";
import { cloneData } from "../helper/utils";
import { MergeGlobal } from "../typings";

export class Global<
  VT extends Record<string, any> = {},
  T extends MergeGlobal<VT> = MergeGlobal<VT>
> {
  isDev: boolean;
  isMain: boolean;
  protected option: Partial<T>;

  constructor(option: Partial<T> = {}) {
    this.option = option;
    this.isMain = isMain();
    this.isDev = isDev();

    if (this.isMain) {
      this.initMain();
      this.initGlobal(this.option);
    }
  }

  private serializationMap(value: Map<string, any>) {
    return Array.from(value.entries()).reduce((pre, [k, v]) => {
      return Object.assign(pre, { [k]: v });
    }, {});
  }

  private serializationData(value: any) {
    if (!value) return value;
    let result: any = value;
    if (result instanceof Map) {
      result = this.serializationMap(result);
    }
    return cloneData(result);
  }

  private initMain() {
    ipcMain.on("get-global-data", (event, name) => {
      event.returnValue = this.serializationData(get(global, name, null));
    });

    ipcMain.on("set-global-data", (event, name, value) => {
      set(global, name, value);
    });
  }

  private initGlobal(option: Partial<T>) {
    const base = this.isDev
      ? resolve(process.cwd(), "dist/datas")
      : resolve(dirname(app.getPath("exe")), "project");

    defaultsDeep(global, option, {
      isDev: this.isDev,
      windows: new Map(),
      path: {
        base,
        home: app.getPath("home"),
        log: resolve(base, "log"),
        config: resolve(base, "config.json"),
        store: resolve(base, "store"),
        cache: resolve(base, "cache"),
        plugin: resolve(base, "plugin"),
        project: resolve(base, "project")
      }
    } as Partial<T>);
  }

  get(): T;
  get<K extends keyof T>(name: K): T[K] | null;
  get<K extends keyof T>(name: K, defaults: T[K] | null): T[K] | null;
  get<K extends keyof T>(name?: K, defaults: T[K] | null = null): T | T[K] | null {
    if (this.isMain) {
      if (name) return get(global, name, defaults) as T[K];
      return global as any as T;
    } else {
      if (name) return ipcRenderer.sendSync("get-global-data", name) ?? defaults;
      else return defaults;
    }
  }

  set<K extends keyof T>(name: K, value: T[K]) {
    if (this.isMain) set(global, name, value);
    else ipcRenderer.send("set-global-data", name, this.serializationData(value));
  }
}
