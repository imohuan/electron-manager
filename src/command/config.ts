import { resolve } from "path";
import { ElectronConfig } from "../typings/command";

export function defineConfig(ops: Partial<ElectronConfig> = {}): ElectronConfig {
  const config = Object.assign(
    {
      inputFile: "",
      preloadDir: "",
      preloadFiles: [],
      outDir: resolve(process.cwd(), "dist"),
      outPreloadDir: "",
      packagePath: "./package.json",
      external: [],
      esbuild: {},
      clearOutDir: false,
      pack: {}
    } as Partial<ElectronConfig>,
    ops
  ) as ElectronConfig;

  if (!config.outPreloadDir.trim()) {
    config.outPreloadDir = resolve(config.outDir, "preload");
  }
  return config;
}
