import { ElectronConfig } from "@imohuan/electron-manager";
import { resolve } from "path";

const srcResolve = (...args: any[]) => {
  return resolve(__dirname, "src-electron", ...args);
};

console.log(resolve(__dirname, "./dist/*"));

export default {
  inputFile: srcResolve("index.ts"),
  preloadDir: srcResolve("preloads"),
  external: ["electron", "@electron/remote"],
  pack: { copyright: "Copyright © 2022 imohuan" },
  packTarget: "windows",
  packPreset: {
    appId: "com.electron.imohuan",
    iconDir: resolve(__dirname, "./build-icon/icons"),
    name: "imohuan",
    files: ["./dist/**"]
  }
} as ElectronConfig;
