import chalk from "chalk";
import { build } from "esbuild";
import { execa } from "execa";
import { moveSync, removeSync, statSync } from "fs-extra";
import { resolve } from "path";

import { Logger } from "@imohuan/log";

import pkg from "../package.json";
import { formatSize } from "../src/helper/utils";

const all = Object.keys(pkg.dependencies).concat([
  "electron",
  "@electron/remote",
  "electron-builder"
]);

function buildFile(inputFile: string, outputFile: string) {
  const startTime = new Date().getTime();
  build({
    entryPoints: [inputFile],
    outfile: outputFile,
    bundle: true,
    platform: "node",
    minify: true,
    format: "cjs",
    external: all
  }).then(() => {
    Logger.info("打包指令消耗时长: ", chalk.green.bold(new Date().getTime() - startTime) + "ms");
    const stat = statSync(outputFile);
    Logger.info(
      chalk.gray.bold(`=> ${chalk.green.bold(formatSize(stat.size).padEnd(15, " "))} ${outputFile}`)
    );
  });
}

(async () => {
  buildFile(
    resolve(__dirname, "../src/command/index.ts"),
    resolve(__dirname, "../dist", "command.js")
  );

  buildFile(
    resolve(__dirname, "../src/preloads/plugin.ts"),
    resolve(__dirname, "../dist/preloads", "plugin.js")
  );

  buildFile(resolve(__dirname, "../src/index.ts"), resolve(__dirname, "../dist", "index.js"));

  if (process.argv.includes("--dts")) {
    const tsc = process.platform === "win32" ? "tsc.cmd" : "tsc";
    const outDir = resolve(__dirname, "../dist/types_back");
    await execa(
      resolve(__dirname, "../node_modules/.bin", tsc),
      [
        "-p",
        resolve(__dirname, "../dts.tsconfig.json"),
        "--emitDeclarationOnly",
        "--outDir",
        outDir
      ],
      { stdio: "inherit" }
    );
    moveSync(resolve(outDir, "src"), resolve(__dirname, "../dist/types"));
    removeSync(outDir);
  }
})();
