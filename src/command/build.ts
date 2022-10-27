import { Logger } from "@imohuan/log";
import chalk from "chalk";
import { existsSync, readdirSync, statSync, removeSync } from "fs-extra";
import { defaultsDeep, isArray } from "lodash-es";
import { basename, resolve } from "path";
import { formatSize, delay } from "../helper/utils";
import { ElectronConfig } from "../typings/command";
import { build, BuildOptions } from "esbuild";
import { defineConfig } from "./config";

const defaultOption: BuildOptions = {
  bundle: true,
  platform: "node",
  minify: true
};

export function getOption(config: ElectronConfig, customOption: BuildOptions): BuildOptions {
  return defaultsDeep(
    {
      external: config.external,
      ...customOption,
      ...config.esbuild
    } as BuildOptions,
    defaultOption
  );
}

/** 加载配置文件 */
export function loadConfig(configPath: string): (ElectronConfig & { package: any }) | null {
  try {
    if (!existsSync(configPath)) {
      Logger.error("未找到配置文件: " + configPath);
      return null;
    }
    let config: any = require(configPath);
    if (configPath.endsWith(".ts")) config = config?.default;
    if (!config) {
      Logger.error("配置文件出现错误");
      return null;
    }

    const configAll = defineConfig(config);
    const result = configAll as ElectronConfig & { package: any };
    result.package = require(resolve(process.cwd(), configAll.packagePath)) || {};
    return result;
  } catch (e: any) {
    Logger.error("加载配置文件报错: ", chalk.red.bold(e.message));
    console.log(e);
    return null;
  }
}

export function getName(path: string) {
  return basename(path).replace(/(\.ts|\.js)$/, "");
}

// export async function build(inputFile: string, outFile: string) {
//   const option = getOption()
//  }

export async function buildMain(config: ElectronConfig, file: string) {
  const option = getOption(config, {
    entryPoints: [file],
    outfile: resolve(config.outDir, "index.js")
  });
  await build(option);
}

export async function buildFile(config: ElectronConfig, files: string | string[]) {
  if (!isArray(files)) files = [files];
  const preloadMap: any = {};
  files.forEach((path) => (preloadMap[getName(path)] = path));
  const option = getOption(config, { entryPoints: preloadMap, outdir: config.outPreloadDir });
  await build(option);
}

export async function buildElectron(config: ElectronConfig) {
  const startTime = new Date().getTime();
  const outMainFile = resolve(config.outDir, "index.js");
  if (config.clearOutDir) removeSync(config.outDir);
  await delay(100);
  await build(getOption(config, { entryPoints: [config.inputFile], outfile: outMainFile }));

  const preloadMap: any = {};
  if (config.preloadDir.trim() && existsSync(config.preloadDir)) {
    readdirSync(config.preloadDir).forEach((name) => {
      preloadMap[getName(name)] = resolve(config.preloadDir, name);
    });
  }
  config.preloadFiles.forEach((path) => (preloadMap[getName(path)] = path));
  await build(getOption(config, { entryPoints: preloadMap, outdir: config.outPreloadDir }));
  Logger.info("代码打包消耗时长: ", chalk.green.bold(new Date().getTime() - startTime + " ms"));

  [
    outMainFile,
    ...readdirSync(config.outPreloadDir).map((m) => resolve(config.outPreloadDir, m))
  ].map((m) => {
    const stat = statSync(m);
    Logger.info(chalk.gray.bold(`=> ${chalk.green.bold(formatSize(stat.size))} ${m}`));
    return m;
  });
}
