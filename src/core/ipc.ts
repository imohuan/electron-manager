import { BrowserWindow, ipcMain, IpcMain, ipcRenderer, IpcRenderer } from "electron";
import { get, isArray, isFunction, set } from "lodash-es";

import { cloneData, md5 } from "../helper/utils";
import { IpcRaw } from "../typings/ipc";
import { Context } from "./context";

class IpcInit {
  protected ipcMap: Map<string, IpcRaw[]>;
  protected ipcInstance: IpcMain | IpcRenderer;
  protected context: Context;

  constructor(context: Context) {
    this.context = context;
    this.ipcMap = new Map();
    this.ipcInstance = ipcMain || ipcRenderer;
    this.context.isMain ? this.initMain() : this.initRenderer();
  }

  private initMain() {
    set(global, "ipc", new Map());
    ipcMain.on("get-ipc", (event) => {
      event.returnValue = cloneData(this.onGet());
    });

    ipcMain.on("add-ipc", (event, name, ipcRaw) => {
      this.onAdd(this.context.get("ipc")!, name, ipcRaw);
      event.returnValue = "ok";
    });

    ipcMain.on("remove-ipc", (event, name, id) => {
      this.onRemove(name, id);
      event.returnValue = "ok";
    });

    ipcMain.on("clear-ipc", () => this.onClear());
  }

  private initRenderer() {
    ipcRenderer.on("clear-ipc", () => this.onClear());
  }

  private eq(obj1: any, obj2: any): boolean {
    return obj1.id === obj2.id;
  }

  protected getIpcMap(): Map<string, IpcRaw[]> {
    return get(global, "ipc", new Map());
  }

  private onGet() {
    const ipcMap = this.getIpcMap();
    return Array.from(ipcMap.entries()).reduce((pre, [key, value]) => {
      return Object.assign(pre, { [key]: value });
    }, {});
  }

  private onAdd(ipcMap: Map<string, IpcRaw[]>, name: string, ipcRaw: IpcRaw) {
    if (!ipcMap.has(name)) {
      ipcMap.set(name, [ipcRaw]);
      return;
    }
    const target = ipcMap.get(name)!;
    const isExists = target.find((f) => this.eq(f, ipcRaw));
    if (isExists) {
      this.context.logger.error("ipc 监听已经存在");
      return;
    }
    target.push(ipcRaw);
  }

  private onBaseRemove(ipcMap: Map<string, IpcRaw[]>, name: string, id: number) {
    if (ipcMap.has(name)) {
      const target = ipcMap.get(name)!;
      const index = target.findIndex((f) => this.eq(f, { id }));
      if (index === -1) return;
      target.splice(index, 1);
      if (target.length === 0) ipcMap.delete(name);
    }
  }

  private onRemove(name: string, id: number) {
    this.onBaseRemove(this.context.get("ipc")!, name, id);
    this.onBaseRemove(this.ipcMap, name, id);
  }

  /** 清空按当前线程的IPC绑定 */
  protected onClear() {
    Array.from(this.ipcMap.entries()).forEach(([name, ipcRaws]) => {
      ipcRaws.forEach((ipcRaw) => this.off(name, ipcRaw));
    });
    this.ipcMap = new Map();
  }

  protected call(name: "get-ipc" | "add-ipc" | "remove-ipc", ...args: any[]): any {
    if (this.context.isMain) {
      if (name === "get-ipc") return this.onGet();
      if (name === "add-ipc") {
        this.onAdd(this.context.get("ipc")!, args[0], args[1]);
        this.onAdd(this.ipcMap, args[0], args[1]);
        return;
      }
      if (name === "remove-ipc") return this.onRemove(args[0], args[1]);
    } else {
      if (name === "add-ipc") {
        this.onAdd(this.ipcMap, args[0], args[1]);
        args = cloneData(args);
      }
      return ipcRenderer.sendSync(name, ...args);
    }
  }

  off(name: string, ipcRaw: IpcRaw) {
    if (ipcRaw?.callback && isFunction(ipcRaw.callback)) {
      this.ipcInstance.off(name, ipcRaw.callback);
      this.call("remove-ipc", name, ipcRaw.id);
    }
  }
}

interface InvokeOption {
  /** 指定 invoke 那个窗口的程序 */
  name: string | string[];
  /** 指定 当前 invoke 超时时间 */
  timeout: number;
  /** handle 执行 event.emit 的稍后进行的一个回调， 用于持续返回数据 */
  callback: (data: any) => any;
}

type Item<T extends (...args: any) => any> = {
  ipcRaw: IpcRaw;
  result: ReturnType<T> | null;
  time: number;
};

export class IpcResult<T extends (...args: any) => any> {
  private list: Item<T>[];

  constructor(list: Item<T>[]) {
    this.list = list || [];
  }

  /** 获取第一个数据 */
  first(): Item<T> | null {
    return this.list?.[0] || null;
  }

  /** 获取第一个有效数据 */
  one(): Item<T> | null {
    return this.list.filter((item) => item)?.[0] || null;
  }

  /** 获取最后一个数据 */
  last(): Item<T> | null {
    const length = this.list.length;
    if (length === 0) return null;
    return this.list[length - 1];
  }

  /** 获取对应名称的返回数据 */
  getByName(name: string): Item<T> | null {
    return this.list.find((f) => f.ipcRaw.option?.name === name) || null;
  }

  /** 获取对应id的返回数据 */
  getById(id: number): Item<T> | null {
    return this.list.find((f) => f.ipcRaw.id === id) || null;
  }

  /** 获取列表 */
  getList() {
    return this.list;
  }
}

export class Ipc<T extends Record<string, (...args: any) => any> = any> extends IpcInit {
  /** 设置 `invoke` 超时时间 */
  private timeout: number;

  constructor(context: Context) {
    super(context);
    this.timeout = 60000;
  }

  /** 获取对应的返回值 */
  private sendResult(rid: string, name: string): Promise<any> {
    // 针对 send 发送消息之后返回的数据 监听  1. webContent.send, 2. ipcRenderer.sendTo
    return new Promise((resolve) => {
      const resultName = `r-${name}`;

      const ok = (data: any) => {
        this.ipcInstance.off(resultName, resultCallback);
        resolve(data);
      };

      const resultCallback = (_: any, reps: { id: string; result: any }) => {
        if (reps.id === rid) ok(reps.result);
      };

      this.ipcInstance.on(resultName, resultCallback);
    });
  }

  /**
   * 发送 Ipc 请求基础版
   * @param key ipc名称
   * @param rid 随机字符串或者其他 （用于标识唯一 id）
   * @param args handle的参数
   * @returns handle的返回或者为 null
   */
  private async invokeBase<K extends keyof T>(
    key: K,
    ipcRaw: IpcRaw,
    args: Parameters<T[K]>,
    option: Partial<InvokeOption> = {}
  ): Promise<ReturnType<T[K]> | null> {
    const name: any = key;
    const sendValue = { id: md5(), isMain: this.context.isMain };

    let close = () => {};
    const cb = (name: string, sendValue: { id: string }) => {
      const cbName = `r-cb-${name}`;
      const resultCallback = (_: any, reps: { id: string; result: any }) => {
        if (reps.id === sendValue.id) option.callback!(reps.result);
      };
      const off = () => this.ipcInstance.off(cbName, resultCallback);
      this.ipcInstance.on(cbName, resultCallback);
      return off;
    };

    if (option?.callback) close = cb(name, sendValue);

    return new Promise(async (_resolve) => {
      // console.log("[invoke]", { key, ipcRaw, args });
      if (this.context.isMain) {
        // 主进程 向其他进程 发送信息
        if (ipcRaw.isMain) {
          // 主进程 -> 主进程
          if (isFunction(ipcRaw.callback)) {
            _resolve(await ipcRaw.callback(null, args));
          } else _resolve(null);
        } else {
          // 主进程 -> 渲染进程
          const win = BrowserWindow.getAllWindows().find((f) => f.webContents.id === ipcRaw.id);
          if (!win) return _resolve(null);
          win.webContents.send(name, sendValue, args);
          _resolve(await this.sendResult(sendValue.id, name));
        }
      } else {
        // 渲染 向其他进程 发送信息
        if (ipcRaw.isMain) {
          // 渲染进程 -> 主进程
          _resolve(await ipcRenderer.invoke(name, sendValue, args));
        } else {
          // 渲染进程 -> 渲染进程
          ipcRenderer.sendTo(ipcRaw.id, name, sendValue, args);
          _resolve(await this.sendResult(sendValue.id, name));
        }
      }
    })
      .then((res: any) => res)
      .finally(() => close());
  }

  /** 设置 `invoke` 超时时间，默认为 60000 (60s) */
  setTimeout(timeout: number) {
    this.timeout = timeout;
  }

  /**
   * 调用 ipc 并且异步获取返回值
   * @param key ipc监听的名称
   * @param args 调用的参数列表
   * @param option 配置参数 `callback` 为 `handle`中函数执行了 `emit`进行调用
   */
  invoke<K extends keyof T>(
    key: K,
    args: Parameters<T[K]> = [] as any,
    option: Partial<InvokeOption> = {}
  ): Promise<IpcResult<T[K]>> {
    return new Promise((_resolve) => {
      const ipcObject = this.call("get-ipc");
      let ipcRaws: IpcRaw[] = ipcObject?.[key];
      if (option?.name) {
        option.name = isArray(option.name) ? option.name : [option.name];
        ipcRaws = ipcRaws.filter(
          (ipcRaw) => ipcRaw.option?.name && option.name!.includes(ipcRaw.option!.name)
        );
      }

      const list: Item<T[K]>[] = [];
      const resultData = (list: Item<T[K]>[]) => {
        const ipcResult = new IpcResult(list);
        _resolve(ipcResult);
      };

      if (!ipcRaws || (isArray(ipcRaws) && ipcRaws.length === 0)) return resultData(list);
      Promise.all(
        ipcRaws.map(async (ipcRaw) => {
          const startTime = new Date().getTime();
          const result = await this.invokeBase(key, ipcRaw, args, option);
          const item = { ipcRaw, result, time: new Date().getTime() - startTime };
          list.push(item);
          return item;
        })
      ).then((res) => resultData(res));
      setTimeout(() => resultData(list), option?.timeout || this.timeout);
    });
  }

  /**
   * 监听 ipc
   * @param key ipc监听的名称
   * @param callback ipc监听的回调函数
   * @returns 无
   */
  handle<K extends keyof T>(
    key: K,
    callback: (
      event: (IpcMain & IpcRenderer) & { emit: (data: any) => any },
      ...args: Parameters<T[K]>
    ) => ReturnType<T[K]> | null | Promise<ReturnType<T[K]> | null>
  ): { name: string; ipcRaw: IpcRaw } | null {
    const name: any = key;
    const ipcRaw: IpcRaw = {
      id: -1,
      name,
      isMain: this.context.isMain,
      option: this.context.getCurrentOption(),
      callback
    };

    // 1. 设置 id （如果是渲染进程的话需要重新设置当前的id）
    if (!ipcRaw.isMain) ipcRaw.id = require("@electron/remote").getCurrentWindow().webContents.id;
    // 2. 判断当前进程是否重复注册
    if (
      this.ipcMap.has(name) &&
      this.ipcMap.get(name)!.findIndex((_ipcRaw) => _ipcRaw.id === ipcRaw.id) !== -1
    ) {
      this.context.logger.error("重复注册ipc: ", ipcRaw);
      return null;
    }

    // 3. 设置自定义回调函数
    const cb = (event: any, ops: { id: string; isMain: any }) => {
      return async (data: any) => {
        const sendValue = { id: ops.id, result: data };
        const nName = `r-cb-${name}`;
        if (this.context.isMain) {
          const id = event.frameId;
          const win = BrowserWindow.getAllWindows().find((f) => f.webContents.id === id);
          win?.webContents.send(nName, sendValue);
        } else {
          if (ops.isMain) ipcRenderer.send(nName, sendValue);
          else ipcRenderer.sendTo(event.senderId, nName, sendValue);
        }
      };
    };

    // 4. 监听
    const _callback: Function = callback;
    this.call("add-ipc", name, ipcRaw);

    if (this.context.isMain) {
      ipcMain.handle(name, async (e, { id, isMain }, args: any[]) => {
        set(e, "emit", cb(e, { id, isMain }));
        // console.log("[args]", args);
        return cloneData(await _callback(e, ...args));
      });
    } else {
      ipcRenderer.on(name, async (e, { id, isMain }, args: any[]) => {
        set(e, "emit", cb(e, { id, isMain }));
        // console.log("[args]", args);
        const result = await _callback(e, ...args);
        const sendValue = cloneData({ id, result });
        if (isMain) ipcRenderer.send(`r-${name}`, sendValue);
        else ipcRenderer.sendTo(e.senderId, `r-${name}`, sendValue);
      });
    }

    return { name, ipcRaw };
  }

  /**
   * 清除对应线程的`Ipc`
   * 主进程可以清除其他进程， 其他渲染进程只能清理本地进程
   * @param id `webContentId` 或者 为 -1(主进程)
   */
  clear(id: number = -1) {
    if (this.context.isMain) {
      if (id === -1) this.onClear();
      const window = BrowserWindow.getAllWindows().find((f) => f.webContents.id === id);
      !window?.isDestroyed() && window?.webContents.send("clear-ipc");
    } else this.onClear();
  }

  private getWatchName(name: string) {
    const updateName = "UPDATE_STORE:";
    return name.startsWith(updateName) ? name : `${updateName}${name}`;
  }

  /** 发布 */
  publisher(name: string, ...args: any) {
    this.invoke(name, args);
  }

  /** 订阅 */
  subscribe(name: string, cb: Function) {
    name = this.getWatchName(name);
    this.handle(name, (...args: any[]) => cb(...args));
    return () => this.unsubscribe(name);
  }

  /** 取消订阅 */
  unsubscribe(name: string) {
    name = this.getWatchName(name);
    let id = -1;
    if (!this.context.isMain) id = require("@electron/remote").getCurrentWindow().webContents.id;
    this.call("remove-ipc", name, id);
  }
}
