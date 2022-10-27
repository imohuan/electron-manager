import { resolve } from "path";
import { ElectronConfig } from "./src/typings/command";

const srcResolve = (...args: any[]) => {
  return resolve(__dirname, "src-electron", ...args);
};

export default {
  inputFile: srcResolve("index.ts"),
  preloadDir: srcResolve("preloads"),
  external: ["electron", "@electron/remote"],
  outDir: resolve(__dirname, "dist-electron"),
  pack: { directories: { output: "dist-pack" } },
  packTarget: "windows",
  packPreset: {
    appId: "com.electron.imohuan",
    iconDir: resolve(__dirname, "./build-icon/icons"),
    name: "imohuan",
    files: ["./dist/**"]
  }
} as ElectronConfig;
