import { Command } from "commander";
import electron from "electron";
import { execa } from "execa";
import { ensureDirSync, existsSync } from "fs-extra";
import { resolve } from "path";

import { Logger } from "@imohuan/log";

export function commandIcon(program: Command) {
  program
    .command("icon")
    .option("-i, --input <input_file>", "输入图片地址", "")
    .option(
      "-o, --output <output_dir>",
      "输出图片目录地址，默认为终端目录下的 build-icon 目录",
      resolve(process.cwd(), "build-icon")
    )
    .description("编译图标")
    .action(async ({ input, output }) => {
      input = resolve(process.cwd(), input);
      output = resolve(process.cwd(), output);
      if (!existsSync(input)) return Logger.error("未找到输入地址的图片");
      ensureDirSync(output);
      await execa(electron as any, [resolve(__dirname, "../public/icon.js")], {
        windowsHide: false,
        stdio: "inherit",
        env: { input, output }
      });
    });
}
