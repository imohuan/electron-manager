import { createHash } from "crypto";
import { upperFirst } from "lodash-es";

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
