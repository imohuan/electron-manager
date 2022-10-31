import decompress from "decompress";
import {
  createWriteStream,
  ensureDirSync,
  moveSync,
  readdirSync,
  removeSync,
  ensureFileSync
} from "fs-extra";
import got, { Progress } from "got";
import { Agent } from "https";
import { defaultsDeep } from "lodash-es";
import { resolve, dirname } from "path";
import { pipeline } from "stream/promises";

import { Result } from "./result";
import { md5 } from "./utils";
import { existsSync } from "fs-extra";

interface DownloadOption {
  /** 下载地址 */
  url: string;
  /** 本地保存地址 */
  out: string;
  /** 进度条 */
  onProgress?: (option: Progress) => any;
}

type DownloadZipOption = { cache: string } & DownloadOption;

export async function download(option: DownloadOption): Promise<Result> {
  return new Promise(async (_resolve) => {
    try {
      ensureDirSync(dirname(option.out));
      const readSteam = createWriteStream(option.out);
      const steam = got.stream(option.url, {
        retry: { limit: 2 },
        throwHttpErrors: false,
        agent: { https: new Agent({ rejectUnauthorized: false }) }
      });
      pipeline(steam, readSteam);
      steam.on("downloadProgress", (progress: Progress) => {
        if (!(progress.transferred === 0 && progress.percent === 1) && option?.onProgress) {
          option.onProgress(progress);
        }
      });
      steam.on("error", (err) => _resolve(Result.error(err.message)));
      steam.on("close", () => _resolve(Result.error("下载出现错误，请稍候重试")));
      steam.on("end", async () => _resolve(Result.ok(true)));
    } catch (e: any) {
      _resolve(Result.error(e.message));
    }
  });
}

export async function downloadZip(
  option: DownloadZipOption,
  isDecompress: boolean = true
): Promise<Result> {
  const name = md5(option.url);
  const zipPath = isDecompress ? resolve(option.cache, name + ".zip") : option.out;
  const result = await download(defaultsDeep({ out: zipPath }, option));
  if (result.status !== 200) return result;
  if (!isDecompress) return Result.ok(zipPath);
  const destCacheDir = resolve(option.cache, name);
  await decompress(zipPath, destCacheDir);
  if (!existsSync(destCacheDir)) {
    removeSync(zipPath);
    return Result.error("文件解压出现异常");
  }
  const destChildren = readdirSync(destCacheDir);
  const targetName = destChildren.length === 1 ? destChildren.shift()! : "";
  moveSync(resolve(destCacheDir, targetName), option.out, { overwrite: true });
  removeSync(destCacheDir);
  removeSync(zipPath);
  return Result.ok(option.out);
}
