import { execa } from "execa";
import { get } from "lodash-es";

import { testFastestNetwork, testNetworkSpeed } from "./testUrl";

export const githubMirror = [
  "https://github.com/{name}/archive/refs/heads/{branch}.zip",
  "https://gh.flyinbug.top/gh/https://github.com/{name}/archive/refs/heads/{branch}.zip",
  "https://github.91chi.fun/https://github.com/{name}/archive/refs/heads/{branch}.zip",
  "https://proxy.zyun.vip/https://github.com/{name}/archive/refs/heads/{branch}.zip",
  "https://archive.fastgit.org/https://github.com/{name}/archive/refs/heads/{branch}.zip",
  "https://gh.ddlc.top/https://github.com/{name}/archive/refs/heads/{branch}.zip",
  "https://ghproxy.com/https://github.com/{name}/archive/refs/heads/{branch}.zip"
];

export const githubRawMirror = [
  "https://raw.githubusercontent.com/{name}/{branch}/{filePath}",
  "https://sourcegraph.com/github.com/{name}@{branch}/-/blob/{filePath}",
  "https://github.com/{name}/raw/{branch}/{filePath}",
  "https://jsd.eagleyao.com/gh/{name}@{branch}/{filePath}",
  "https://raw.iqiq.io/{name}/{branch}/{filePath}",
  "https://raw.kgithub.com/{name}/{branch}/{filePath}",
  "https://fastly.jsdelivr.net/gh/{name}@{branch}/{filePath}",
  "https://cdn.staticaly.com/gh/{name}/{branch}/{filePath}",
  "https://raw.fastgit.org/{name}/{branch}/{filePath}",
  "https://ghproxy.net/https://raw.githubusercontent.com/{name}/{branch}/{filePath}",
  "https://gcore.jsdelivr.net/gh/{name}@{branch}/{filePath}",
  "https://raw.githubusercontents.com/{name}/{branch}/{filePath}",
  "https://github.moeyy.xyz/https://raw.githubusercontent.com/{name}/{branch}/{filePath}",
  "https://github.com/{name}/blame/{branch}/{filePath}"
];

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
  const urls = githubMirror.map((url) =>
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
  const urls = githubRawMirror.map((url) =>
    url.replace(/\{([_a-zA-Z0-9]+)}/g, (_: any, key: any) =>
      get({ name, branch, filePath }, key, "")
    )
  );
  return await testFastestNetwork(urls);
}

/** 检查是否支持命令 Git */
export function checkGit(): Promise<boolean> {
  return new Promise((_resolve) => {
    execa("git", ["-v"])
      .then(() => _resolve(true))
      .catch(() => _resolve(false));
  });
}
