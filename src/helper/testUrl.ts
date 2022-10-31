import axios from "axios";
import { createWriteStream, ensureFileSync, existsSync, removeSync, statSync } from "fs-extra";
import got, { Progress } from "got";
import https from "https";
import { extname, resolve } from "path";
import stream from "stream";
import { promisify } from "util";

import { SamplePool } from "./pool";
import { md5 } from "./utils";

const pipeline = promisify(stream.pipeline);
const pool = new SamplePool(5);

type TestResult = { url: string; progress: Progress; timeout: number };

export async function testDownloadUrl(
  url: string,
  timeout: number = 3000
): Promise<TestResult | null> {
  const name = md5(url).slice(0, 10) + "_" + Math.random().toString().slice(3, 10) + extname(url);
  const filepath = resolve(__dirname, "cache", name);
  ensureFileSync(filepath);
  return new Promise((_resolve) => {
    const steam = got.stream(url, {
      retry: { limit: 0 },
      throwHttpErrors: false,
      agent: { https: new https.Agent({ rejectUnauthorized: false }) }
    });
    pipeline(steam, new stream.PassThrough());
    steam.on("error", () => _resolve(null));
    setTimeout(() => {
      steam.pause();
      steam.end();
      removeSync(filepath);
      _resolve({ url, progress: steam.downloadProgress, timeout });
    }, timeout);
  });
}

/**
 * 测试多个url那个速度最快
 * @param urls 测试url列表
 * @param time 测试时间
 * @returns
 */
export async function testNetworkSpeed(urls: string[], timeout: number = 3000): Promise<string> {
  const results = await Promise.all(
    urls.map((url) => pool.run(() => testDownloadUrl(url, timeout)))
  );
  return results
    .filter((f) => f)
    .sort((a, b) => b?.progress.transferred - a?.progress.transferred)
    .shift()!.url;
}

/** 获取多个URL最快返回数据，并且数据不会空的返回值 */
export async function testFastestNetwork(urls: string[]): Promise<any> {
  return new Promise(async (_resolve) => {
    const cancels: Function[] = [];
    const cancel = () => cancels.forEach((c) => c());

    const testItem = async (url: string): Promise<any> => {
      const controller = new AbortController();
      cancels.push(() => controller.abort());
      return await axios
        .get(url, {
          signal: controller.signal,
          httpsAgent: new https.Agent({ rejectUnauthorized: false })
        })
        .then((res) => res.data)
        .catch((_) => {});
    };

    await Promise.all(
      urls.map((url) =>
        pool.run(() =>
          testItem(url).then((result) => {
            if (!result) return;
            cancel();
            _resolve({ url, result });
          })
        )
      )
    );
    _resolve(null);
  });
}
