import builder from "electron-builder";
import { BuildOptions } from "esbuild";

export type PlatformType = "windows" | "mac" | "linux";

export type Pack = builder.Configuration;

export type PackPreset = {
  /** manager icon命令生成的 icons目录 */
  iconDir: string;
  /** 软件名称 */
  name: string;
  /** 软件唯一ID */
  appId: string;
  /** 需要打包的文件 */
  files: string[];
};

export type ElectronConfig = {
  /** electron 的入口文件 */
  inputFile: string;
  /** preload 目录 */
  preloadDir: string;
  /** preload 文件 */
  preloadFiles: string[];
  /** 输出 目录 */
  outDir: string;
  /** 是否清空 输出目录 */
  clearOutDir: boolean;
  /** 输出 preload 目录 */
  outPreloadDir: string;
  /** 不需要打包的包 */
  external: string[];
  /** 默认为同级目录下的 package.json 的路径 */
  packagePath: string;
  /** esbuild 其他配置 */
  esbuild: BuildOptions;
  /** 打包命令 */
  pack: Pack;
  /** 目标 */
  packTarget: PlatformType;
  /** 打包预设 */
  packPreset?: PackPreset;
};
