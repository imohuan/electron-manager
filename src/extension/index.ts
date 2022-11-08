import { execa, Options as ExecaOptions } from "execa";
import {
  ensureDirSync,
  existsSync,
  readdirSync,
  removeSync,
  statSync,
  writeFileSync
} from "fs-extra";
import got from "got";
import { Agent } from "https";
import { defaultsDeep, get, isArray } from "lodash-es";
import { basename, resolve, dirname } from "path";
import { lt } from "semver";
import { downloadZip } from "../helper/download";
import { execCommand } from "../helper/exec";
import { getGitZipFastUrl } from "../helper/github";
import { Result } from "../helper/result";
import { loadJson } from "../helper/utils";

/**
 * 创建插件进程
 *  LocalProcessExtensionHost（本地插件，如个人插件）
 *  RemoteExtensionHost（远程插件，如WSL Remote）
 *  WebWorkerExtensionHost（web worker进程）
 */

export interface ExtensionInfo {
  /** 插件类型 */
  type: "adapter";
  /** 插件名称 */
  name: string;
  /** 可读插件名称 */
  pluginName: string;
  /** 作者 */
  author: string;
  /** 描述 */
  description: string;
  /** 入口文件 */
  main: string;
  /** 版本 */
  version: string;
  /** logo地址 */
  logo: string;
}

export interface StrategyOption {
  baseDir: string;
}

export interface ExecCommandOption extends ExecaOptions {
  onMessage: (status: "stdout" | "stderr", msg: string) => void;
}

export interface ExtensionCallResult {
  /** 耗时 */
  time: number;
  /** 安装的地址 */
  path: string;
  /** 大小 */
  size: number;
  /** 插件名称 (文件夹名称) */
  name: string;
}

export interface ExtensionCallOption {
  isDev: boolean;
}

export interface ExtensionCallInfoOption {
  /** 是否获取本地的info信息 */
  local: boolean;
}

export interface ExtensionStrategyOption {
  baseDir: string;
  fileName: string;
  hooks: Hooks;
}

export abstract class AbstractStrategy {
  constructor(protected option: ExtensionStrategyOption) {
    ensureDirSync(this.option.baseDir);
  }

  abstract info(
    module: string,
    option: Partial<ExtensionCallInfoOption>
  ): Promise<ExtensionInfo | null>;
  abstract list(option: Partial<ExtensionCallInfoOption>): Promise<ExtensionInfo[]>;
  abstract install(
    module: string,
    option: Partial<ExtensionCallOption>
  ): Promise<Result<ExtensionCallResult>>;
  abstract update(
    module: string,
    option: Partial<ExtensionCallOption>
  ): Promise<Result<ExtensionCallResult>>;
  abstract uninstall(
    module: string,
    option: Partial<ExtensionCallOption>
  ): Promise<Result<ExtensionCallResult>>;

  protected async execCommandBase(
    program: string,
    args: string[],
    ops: Partial<ExecCommandOption> = {}
  ): Promise<any> {
    return execCommand(program, args, {
      cwd: this.option.baseDir,
      ...ops
    });
  }
}

export interface ExtensionHostOption extends ExtensionStrategyOption {
  strategy?: ExtensionStrategy;
}

export class ExtensionHost {
  private option: ExtensionHostOption;
  private strategy: ExtensionStrategy;
  private plugins: Map<string, any>;
  private hooks: Hooks;
  private hookMap: Map<string, { name: string; func: Function }> = new Map();

  constructor(ops: Partial<ExtensionHostOption> = {}) {
    this.option = defaultsDeep(ops, {
      fileName: "plugin.json",
      baseDir: resolve(__dirname, "plugin")
    } as ExtensionHostOption);

    this.plugins = new Map();
    this.hooks = new Hooks();

    this.strategy =
      this.option?.strategy ||
      new ExtensionStrategy({
        baseDir: this.option.baseDir,
        fileName: this.option.fileName,
        hooks: this.hooks
      });
  }

  async init() {
    const list: (ExtensionInfo & { repo: string; path: string })[][] = await this.strategy.callList(
      "list",
      { local: true }
    );
    return Promise.all(list.flat(1).map((item) => this.load(item.repo, item.path, item)));
  }

  private urlInfo(url: string) {
    const [name, ...uris] = url.split("+");
    return { name, uri: uris.join("+") };
  }

  /**
   * 安装插件
   * @param url npm+axios | git+https://github.com/imohuan/electron-manager-demo.git
   */
  async install(url: string): Promise<Result<boolean>> {
    const { name, uri } = this.urlInfo(url);
    const result = await this.strategy.call(name, "install", uri, {
      isDev: false
    });
    if (!result) return Result.error("安装失败 未找到对应的安装策略");
    if (!result.isOk()) return result as Result;

    const optionFile = resolve(result.data.path, this.option.fileName);
    const extensionOption: ExtensionInfo = loadJson(optionFile);
    if (!extensionOption) return Result.error("安装失败 解析插件配置失败: " + result.data.name);
    return await this.load(url, optionFile, extensionOption);
  }

  private async load(
    url: string,
    optionFile: string,
    extensionOption: ExtensionInfo
  ): Promise<Result<boolean>> {
    const result = await require(resolve(dirname(optionFile), extensionOption.main))?.apply(
      this.hooks
    );
    if (!result) return Result.error("安装失败 插件初始化失败: " + extensionOption.main);
    if (this.plugins.has(extensionOption.name))
      return Result.error("安装失败 插件名称已经存在: " + extensionOption.main);
    this.plugins.set(extensionOption.name, result);
    await this.hooks.invokePromise("extension-init", { url, info: extensionOption });
    writeFileSync(
      optionFile,
      JSON.stringify(defaultsDeep({ repo: url }, extensionOption), null, 2)
    );
    this.hookMap.set(extensionOption.name, "");
    return Result.ok(true);
  }

  async update(url: string) {
    const { name, uri } = this.urlInfo(url);
    await this.strategy.call(name, "update", uri, { isDev: false });
    const info = await this.strategy.call(name, "info", uri, { local: true });
    await this.hooks.invokePromise("extension-update", { url, name, info });
    if (!info) return null;
    this.plugins.delete(info.name);
    await this.hooks.invokePromise("extension-destroy", { url, name, info });
    return await this.load(url, get(info, "path", ""), info);
  }

  async uninstall(url: string) {
    const { name, uri } = this.urlInfo(url);
    const info = await this.strategy.call(name, "info", uri, { local: true });
    await this.hooks.invokePromise("extension-destroy", { url, name, info });
    return await this.strategy.call(name, "uninstall", uri, { isDev: false });
  }

  async call(pluginName: string, funName: string, ...args: any[]) {
    if (!this.plugins.has(pluginName)) return Result.error("未找到对应插件: " + pluginName);
    const obj = this.plugins.get(pluginName);
    if (!obj?.[funName]) return Result.error(`未找到对应方法: ${pluginName}-${funName}`);
    try {
      return await obj[funName](...args);
    } catch (e: any) {
      return Result.error(`执行命令错误: ${pluginName}-${funName}-${e.message}`);
    }
  }

  async autoUpdate(option: { force?: boolean }) {
    const list: (ExtensionInfo & { repo: string })[][] = await this.strategy.callList("list", {
      local: true
    });

    await Promise.all(
      list.flat(1).map(async (item) => {
        const oldVersion = item.version;
        const { name, uri } = this.urlInfo(item.repo);
        const info = await this.strategy.call(name, "info", uri, {});
        const laseVersion = get(info, "version", "0.0.0");
        if (lt(oldVersion, laseVersion)) {
          if (option?.force) {
            return await this.update(item.repo);
          } else {
            await this.hooks.invokePromise("extension-update-msg", { url: item.repo, name, info });
            return true;
          }
        } else return false;
      })
    );
  }
}

export class ExtensionStrategy {
  protected map: Map<string, AbstractStrategy> = new Map();

  constructor(private option: ExtensionStrategyOption) {
    this.map.set("git", new StrategyGit(this.option));
    this.map.set("npm", new StrategyNpm(this.option));
  }

  add(name: string, instance: AbstractStrategy) {
    this.map.set(name, instance);
  }

  async call<K extends keyof AbstractStrategy>(
    strategyName: string,
    type: K,
    ...args: Parameters<AbstractStrategy[K]>
  ): Promise<ReturnType<AbstractStrategy[K]> | null> {
    if (!this.map.has(strategyName)) return null;
    const fn = this.map.get(strategyName)!;
    return await (fn[type] as any)(...args);
  }

  async callList<K extends keyof AbstractStrategy>(
    type: K,
    ...args: Parameters<AbstractStrategy[K]>
  ): Promise<any[]> {
    return await Promise.all(Array.from(this.map.values()).map((m) => (m[type] as any)(...args)));
  }
}

export class Hooks {
  private hooks: Map<string, Set<Function>> = new Map();
  constructor() {}

  add(name: string, fn: Function) {
    const hooks = this.get(name);
    hooks.add(fn);
    this.hooks.set(name, hooks);
  }

  remove(name: string, fn: Function) {
    const hooks = this.get(name);
    hooks.delete(fn);
    this.hooks.set(name, hooks);
  }

  get(name: string) {
    return this.hooks.get(name) || new Set();
  }

  invoke(name: string, ...args: any[]) {
    for (const hook of this.get(name)) {
      hook(...args);
    }
  }

  async invokePromise(name: string, ...args: any[]) {
    for (const hook of this.get(name)) {
      await hook(...args);
    }
  }
}

export const npmMirror = {
  npm: "https://registry.npmjs.org/",
  yarn: "https://registry.yarnpkg.com/",
  tencent: "https://mirrors.cloud.tencent.com/npm/",
  cnpm: "https://r.cnpmjs.org/",
  taobao: "https://registry.npmmirror.com/",
  npmMirror: "https://skimdb.npmjs.com/registry/"
};

export class StrategyNpm extends AbstractStrategy {
  private registry: string;

  constructor(option: ExtensionStrategyOption & { registry?: keyof typeof npmMirror }) {
    super(option);
    this.registry = get(npmMirror, option?.registry || "taobao", npmMirror["taobao"]);
    /** 初始化插件安装目录 */
    const path = resolve(this.option.baseDir, "package.json");
    if (!existsSync(path)) {
      writeFileSync(path, JSON.stringify({ dependencies: {} }, null, 2));
    }
  }

  async info(
    module: string,
    option: Partial<ExtensionCallInfoOption>
  ): Promise<ExtensionInfo | null> {
    if (option?.local) {
      return loadJson(resolve(this.option.baseDir, "node_modules", module, this.option.fileName));
    } else {
      return await got
        .get(`https://cdn.jsdelivr.net/npm/${module}/${this.option.fileName}`)
        .json<any>()
        .catch(() => null);
    }
  }

  async list(option: Partial<ExtensionCallInfoOption>): Promise<ExtensionInfo[]> {
    const json = loadJson(resolve(this.option.baseDir, "package.json"));
    const modules = Object.keys(get(json, "dependencies", []));
    const result = await Promise.all(
      modules.map((m) =>
        loadJson(resolve(this.option.baseDir, "node_modules", m, this.option.fileName))
      )
    );
    return result.filter((f) => f);
  }

  async install(
    module: string,
    option: Partial<ExtensionCallOption>
  ): Promise<Result<ExtensionCallResult>> {
    const cmd = option?.isDev ? "link" : "install";
    return await this.execCommand(cmd, module);
  }

  async update(
    module: string,
    option: Partial<ExtensionCallOption>
  ): Promise<Result<ExtensionCallResult>> {
    return await this.execCommand("install", `${module}@latest`);
  }

  async uninstall(
    module: string,
    option: Partial<ExtensionCallOption>
  ): Promise<Result<ExtensionCallResult>> {
    const cmd = option.isDev ? "unlink" : "uninstall";
    return await this.execCommand(cmd, module);
  }

  private async execCommand(cmd: string, module: string): Promise<any> {
    const _args = [cmd, module, "--color=always", "--save", `--registry=${this.registry}`];
    const start = new Date().getTime();
    const path = resolve(this.option.baseDir, "node_modules", module);
    const _process = await execCommand("npm", _args, {
      cwd: this.option.baseDir,
      onMessage: (_, msg) => {
        this.option.hooks.invoke("extension-progress", { type: "loading" });
      }
    });
    _process.process.on("error", (err) => Result.error(`操作失败: ${err.message}`));
    return Result.ok({
      time: new Date().getTime() - start,
      path,
      size: existsSync(path) ? statSync(path).size : 0,
      name: module
    });
  }
}

export class StrategyGit extends AbstractStrategy {
  private cachePath: string;
  constructor(option: ExtensionStrategyOption) {
    super(option);
    this.cachePath = resolve(this.option.baseDir, "node_cache");
  }

  private getUrlName(gitUrl: string) {
    return basename(gitUrl).replace(".git", "");
  }

  private checkGit() {
    return new Promise((_resolve) => {
      execa("git", ["-v"])
        .then(() => _resolve(true))
        .catch(() => _resolve(false));
    });
  }

  async info(
    gitUrl: string,
    option: Partial<ExtensionCallInfoOption>
  ): Promise<ExtensionInfo | null> {
    if (option?.local) {
      return loadJson(resolve(this.option.baseDir, this.getUrlName(gitUrl), this.option.fileName));
    } else {
      const repo = /(https:\/\/github\.com\/[^\/]+\/[^\/]+)/.exec(gitUrl)?.[1] || gitUrl;
      const name = repo.replace("https://github.com/", "").replace(".git", "");
      const url = `https://raw.githubusercontent.com/${name}/main/${this.option.fileName}`;
      return await got
        .get(url, { agent: { https: new Agent({ rejectUnauthorized: false }) } })
        .json<any>()
        .catch(() => null);
    }
  }

  async list(option: Partial<ExtensionCallInfoOption>): Promise<ExtensionInfo[]> {
    const result = await Promise.all(
      readdirSync(this.option.baseDir).map((name) => {
        return loadJson(resolve(this.option.baseDir, name, this.option.fileName));
      })
    );
    return result.filter((f) => f);
  }

  async install(
    gitUrl: string,
    option: Partial<ExtensionCallOption & { update?: boolean }>
  ): Promise<Result<ExtensionCallResult>> {
    if (await this.checkGit()) {
      return await this.execCommand("clone", gitUrl);
    } else if (gitUrl.startsWith("https://github.com/")) {
      const fastUrl = await getGitZipFastUrl(gitUrl);
      const out = resolve(this.option.baseDir, option?.update ? "_" : "" + this.getUrlName(gitUrl));
      return await downloadZip({ url: fastUrl, cache: this.cachePath, out }).then(
        (res) => res?.data
      );
    } else return Result.error("请安装Git");
  }

  async update(
    gitUrl: string,
    option: Partial<ExtensionCallOption>
  ): Promise<Result<ExtensionCallResult>> {
    const cwd = resolve(this.option.baseDir, this.getUrlName(gitUrl));
    if (existsSync(resolve(cwd, ".git"))) {
      await this.execCommand("fetch", ["--all"], { cwd });
      await this.execCommand("reset", ["--hard", "origin/main"], { cwd });
      return await this.execCommand("pull", ["origin", "main", "--progress"], { cwd });
    } else return await this.install(gitUrl, { update: true });
  }

  async uninstall(
    gitUrl: string,
    option: Partial<ExtensionCallOption>
  ): Promise<Result<ExtensionCallResult>> {
    const start = new Date().getTime();
    const name = this.getUrlName(gitUrl);
    const targetDir = resolve(this.option.baseDir, name);
    removeSync(targetDir);
    if (existsSync(targetDir)) return Result.error("卸载失败: " + name);
    else {
      return Result.ok({
        name,
        path: targetDir,
        size: 0,
        time: new Date().getTime() - start
      });
    }
  }

  private async execCommand(
    cmd: string,
    args: string | string[] = [],
    option: Partial<ExecCommandOption> = {}
  ): Promise<any> {
    const start = new Date().getTime();
    const _args = isArray(args) ? args : [args];
    const name = this.getUrlName(_args[0]);
    const path = resolve(this.option.baseDir, name);
    const _process = await execCommand("git", [cmd, ..._args], {
      cwd: this.option.baseDir,
      onMessage: (_, msg) => {
        const values = /Receiving objects:\s+(\d+)%\s+\((\d+)\/(\d+)\)/.exec(msg);
        if (!values) return;
        const progress = {
          percent: parseInt(values[1]),
          transferred: parseInt(values[2]),
          total: parseInt(values[3])
        };
        this.option.hooks.invoke("extension-progress", { type: "progress", progress });
      },
      ...option
    });
    _process.process.on("error", (err) => Result.error(`操作失败: ${err.message}`));
    return Result.ok({
      time: new Date().getTime() - start,
      path,
      size: existsSync(path) ? statSync(path).size : 0,
      name
    });
  }
}

(async () => {
  const n = new ExtensionHost({
    baseDir: resolve(__dirname, "extensions")
    // fileName: "package.json"
  });
  await n.init();
  // n.install("npm+rubick-plugin-db").then(console.log);
  // await n.install("git+https://github.com/imohuan/electron-plugin-demo.git").then(console.log);
  await n.call("demo", "getVersion", []).then(console.log);
  await n.autoUpdate({ force: true }).then(console.log);
  // await n.uninstall("git+https://github.com/imohuan/electron-plugin-demo.git").then(console.log);
})();
