import { execa } from "execa";
import { Progress } from "got";
import { get } from "lodash-es";

import mirror from "../config";
import { testFastestNetwork, testNetworkSpeed } from "./testUrl";
import { Result } from "./result";
import { resolve } from "path";

export function getGitUrlInfo(url: string) {
  const repo = /(https:\/\/github\.com\/[^\/]+\/[^\/]+)/.exec(url)?.[1] || url;
  const name = repo.replace("https://github.com/", "");
  return { repo, name };
}

/**
 * 获取git仓库镜像下载地址
 * @param gitUrl 仓库地址 `https://github.com/midwayjs/midway`
 * @param branch 分支 默认: main
 * @param timeout 测试速度的事件 默认: 3000/3秒
 * @returns 下载速度最快的地址
 */
export async function getGitZipFastUrl(
  gitUrl: string,
  branch: string = "main",
  timeout: number = 3000
): Promise<string> {
  const { name } = getGitUrlInfo(gitUrl);
  const urls = mirror.github.map((url) =>
    url.replace(/\{([_a-zA-Z0-9]+)}/g, (_: any, key: any) => get({ name, branch }, key, ""))
  );
  return await testNetworkSpeed(urls, timeout);
}

/**
 * 获取git仓库中配置文件的信息
 * @param url 文件地址 `https://github.com/midwayjs/midway/blob/main/lerna.json`
 */
export async function getGitRawFile(
  gitUrl: string,
  filePath: string,
  branch: string = "main"
): Promise<{ url: string; result: any } | null> {
  const { name } = getGitUrlInfo(gitUrl);
  const urls = mirror.githubRaw.map((url) =>
    url.replace(/\{([_a-zA-Z0-9]+)}/g, (_: any, key: any) =>
      get({ name, branch, filePath }, key, "")
    )
  );
  return await testFastestNetwork(urls);
}

/**
 * git clone
 * @param url `.git`地址
 * @param name 本地存储名称
 * @param dir 本地存储目录
 * @returns
 */
export async function gitClone(
  url: string,
  name: string,
  dir: string,
  onProgress: (progress: Progress) => any = () => {}
): Promise<Result> {
  return new Promise(async (_resolve) => {
    const isOk = await checkGit();
    if (!isOk) return _resolve(Result.error("未安装git"));
    const _process = execa("git", ["clone", url, name, "--progress"], { cwd: dir });
    const onData = (data: any) => {
      const value = /Receiving objects:\s+(\d+)%\s+\((\d+)\/(\d+)\)/.exec(data.toString());
      if (!value) return;
      const progress: Progress = {
        percent: parseInt(value[1]),
        transferred: parseInt(value[2]),
        total: parseInt(value[3])
      };
      onProgress(progress);
    };
    _process.stdout?.on("data", onData);
    _process.stderr?.on("data", onData);
    _process.on("exit", () => _resolve(Result.ok(resolve(dir, name))));
  });
}

export function checkGit(): Promise<boolean> {
  return new Promise((_resolve) => {
    execa("git", ["-v"])
      .then(() => _resolve(true))
      .catch(() => _resolve(false));
  });
}
