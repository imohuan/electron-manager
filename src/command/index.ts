require("ts-node/register");

import { program } from "commander";
import { setOption } from "@imohuan/log";
import { checkUpdate, formatLog, initHelp, initOutput, initUnKnowCommand } from "./utils";
import pkg from "../../package.json";
import { commandCommand } from "./command";
import { commandIcon } from "./icon";
import { commandPack } from "./pack";

export * from "./config";

export async function main() {
  const label = "Manager-Cli";
  setOption({ label });
  /** 注册命令 */
  registerCommand(label);
  /** 检查更新 */
  await checkUpdate();
}

function registerCommand(label: string) {
  program.name(label.replaceAll(" ", "-").toLocaleLowerCase()).usage("[command] [options]");
  program.helpOption("-h, --help", "指令帮助");
  program.version(
    formatLog({ level: "info", label, message: `版本号: ${pkg.version}` }),
    "-v, --version",
    "查看版本"
  );

  initHelp(label, program);
  initOutput(program);
  initUnKnowCommand(program);

  commandCommand(program);
  commandIcon(program);
  commandPack(program);

  program.parse();
}
