import axios from "axios";
import { createWriteStream, removeSync } from "fs-extra";
import got, { Progress } from "got";
import https from "https";
import { resolve } from "path";
import stream from "stream";
import { promisify } from "util";

import { md5 } from "./utils";

const pipeline = promisify(stream.pipeline);

/**
 * 测试多个url那个速度最快
 * @param urls 测试url列表
 * @param time 测试时间
 * @returns
 */
export async function testNetworkSpeed(urls: string[], time: number = 3000): Promise<string> {
  let index = 0;
  const testItem = (url: string): Promise<{ url: string; progress: Progress }> => {
    const name = md5(url).slice(0, 10);
    const filepath = resolve(__dirname, `${name}_${index++}`);
    return new Promise((_resolve) => {
      const readStream = createWriteStream(filepath);
      const steam = got.stream(url, {
        retry: { limit: 2 },
        throwHttpErrors: false,
        agent: { https: new https.Agent({ rejectUnauthorized: false }) }
      });
      pipeline(steam, readStream);
      setTimeout(() => {
        steam.pause();
        readStream.destroy();
        removeSync(filepath);
        _resolve({ url, progress: steam.downloadProgress });
      }, time);
    });
  };
  const results = await Promise.all(urls.map((url) => testItem(url)));
  return results.sort((a, b) => a.progress.transferred - b.progress.transferred).shift()!.url;
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

    urls.forEach((url) =>
      testItem(url)
        .then((result) => {
          if (!result) return;
          cancel();
          _resolve(result);
        })
        .catch((e: any) => {
          // console.log(e.message);
        })
    );
  });
}
