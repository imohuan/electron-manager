import { ensureDirSync, existsSync, writeFileSync } from "fs-extra";
import { defaultsDeep, get, isNumber, set } from "lodash-es";
import { JSONFileSync, LowSync } from "lowdb";
import moment from "moment";
import { dirname } from "path";
import { v4 } from "uuid";

interface StoreBase {
  has(name: string): boolean;
  set(name: string, value: any): void;
  get(name: string, defaults: any): any;
  remove(name: string): boolean;
}

export class JsonStore implements StoreBase {
  public file: string;
  private unique: string;
  private db: LowSync;

  /**
   * JSON对象保存 (使用需要执行onInit方法)
   * @param file 保存地址 json
   * @param unique put方法唯一名称
   * @default unique title
   */
  constructor(file: string, unique = "title") {
    if (!existsSync(file)) {
      ensureDirSync(dirname(file));
      writeFileSync(file, "{}");
    }
    this.unique = unique;
    this.file = file;
    this.db = new LowSync<any>(new JSONFileSync(this.file));
  }

  /**
   * 设置唯一Key
   * @param unique 唯一Key名称
   */
  public setUnique(unique: string) {
    this.unique = unique;
  }

  /**
   * 判断对应key是否存在
   * @param name 名称
   * @returns `boolean`
   */
  public has(name: string): boolean {
    this.db.read();
    const data: any = this.db.data;
    return !!data[name];
  }

  /**
   * 设置本地JSON文件对象
   * @param name 对象名称
   * @param value 内容
   */
  public set(name: string, value: any): void {
    this.db.read();
    const data: any = this.db.data;
    set(data, name, value);
    this.db.write();
  }

  /**
   * 获取本地JSON文件对象
   * @param name 名称
   * @param defaults 默认值
   * @default defaults null
   * @returns
   */
  public get(name?: string, defaults?: any) {
    this.db.read();
    const data: any = this.db.data;
    if (!name) return data;
    return get(data, name, defaults || null);
  }

  /**
   * 删除对象名称
   * @param name 对象名称
   * @returns
   */
  public remove(name: string): boolean {
    this.db.read();
    const data: any = this.db.data;
    delete data[name];
    this.db.write();
    return !this.has(name);
  }

  /**
   * 清空对象
   */
  public clear(): void {
    this.db.read();
    this.db.data = {};
    this.db.write();
  }

  /**
   * 向list中添加数据
   * @param putData 任意数据
   */
  public put(putData: any) {
    this.db.read();
    const data: any = defaultsDeep(this.db.data, { list: [] });
    const id = v4();
    const updateTime = moment().format("YYYY-HH-MM hh:mm:ss");
    const pushData: any = { _id: id, data: putData, updateTime };

    const unique = this.unique;
    const current = get(putData, unique, false);

    if (isNumber(current) || current) {
      const index = data.list.findIndex((f: any) => get(f.data, unique, false) === current);
      if (index !== -1) return;
    }

    data.list.push(pushData);
    this.db.write();
  }

  /**
   * 获取List数据
   * @returns List数据
   */
  public getList() {
    return this.get("list", []);
  }

  /**
   * 获取List对应数据
   * @param key 唯一名称
   * @returns 对象 或者 `null`
   */
  public getListItem(key: any) {
    this.db.read();
    const data: any = this.db.data;
    const index = data.list.findIndex((f: any) => get(f.data, this.unique, false) === key);
    return index !== -1 ? data.list[index] : null;
  }

  /**
   * 删除List对应数据
   * @param key 唯一名称
   * @returns `boolean`
   */
  public removeList(key: any) {
    this.db.read();
    const data: any = this.db.data;
    const index = data.list.findIndex((f: any) => get(f.data, this.unique, false) === key);
    if (index !== -1) {
      data.list.splice(index, 1);
      this.db.write();
      return !this.getListItem(key);
    }
    return false;
  }

  /**
   * 排除不符合规则的数据
   * @param unique 唯一Key
   */
  public uniqList(unique: string = this.unique) {
    this.db.read();
    const map = new Map();
    const data: any = this.db.data;

    for (const item of data?.list) {
      const key = get(item?.data, unique, false);
      if (!key) continue;
      if (!map.has(key)) map.set(key, item);
    }

    data.list = [...map.values()];
    this.db.write();
  }

  /**
   * 事务
   * @param cb 回调函数 `(data: any) => void`
   */
  public async transaction(cb: (data: any) => Promise<void>) {
    this.db.read();
    const data: any = this.db.data;
    await cb(data);
    this.db.write();
  }
}

export class ConfigStore {
  store: JsonStore;

  constructor(file: string) {
    this.store = new JsonStore(file);
  }

  get file() {
    return this.store.file;
  }

  set(name: string, value: any): void {
    this.store.set(name, value);
  }

  get(name?: string, defaults?: any) {
    return this.store.get(name, defaults ?? null);
  }
}
