import { createHash } from "crypto";
import { upperFirst, defaultsDeep, get } from "lodash-es";
import { readFileSync, existsSync } from "fs-extra";

/** 延迟时间 */
export function delay(timeout = 3000): Promise<void> {
  return new Promise((_resolve) => {
    setTimeout(() => {
      _resolve();
    }, timeout);
  });
}

/**
 * 文本转Md5
 * @param content 需要转换的内容(默认为随机值)
 */
export function md5(content: string = Math.random().toString()) {
  return createHash("md5").update(content).digest("hex");
}

export function cloneData(data: any) {
  return JSON.parse(JSON.stringify(data));
}

/** 格式化文件大小 */
export function formatSize(fileSize: number) {
  const unitArr = new Array("bytes", "kib", "mb", "gb", "tb", "pb", "eb", "zb", "yz");
  if (!fileSize) return `0 ${upperFirst(unitArr[0])}`;
  const index = Math.floor(Math.log(fileSize) / Math.log(1024));
  const size = fileSize / Math.pow(1024, index);
  return size.toFixed(2) + " " + upperFirst(unitArr[index]);
}

/** 加载JSON文件 */
export function loadJson(path: string) {
  try {
    if (!existsSync(path)) return null;
    return defaultsDeep(JSON.parse(readFileSync(path).toString()), { path });
  } catch {
    return null;
  }
}

export function varReplace(str: string, vars: any, defaults: any = "") {
  return str.replace(/\{([_a-zA-Z0-9]+)}/g, (_: any, key: any) => get(vars, key, defaults));
}
