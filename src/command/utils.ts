import chalk, { Chalk } from "chalk";
import { Command } from "commander";
import latestVersion from "latest-version";
import { defaultsDeep, get, max, upperFirst } from "lodash-es";
import moment from "moment";
import semver from "semver";
import { promisify } from "util";

import { Logger } from "@imohuan/log";

import pkg from "../../package.json";

const figlet: any = promisify(require("figlet"));

const levelColor = {
  error: chalk.red.bold,
  warn: chalk.yellow.bold,
  info: chalk.green.bold,
  debug: chalk.blue.bold,
  verbose: chalk.cyan.bold,
  silly: chalk.white.bold
};

export type LogLevel = keyof typeof levelColor;

interface HelpColor {
  logo: Chalk;
  usage: Chalk;
  head: Chalk;
  title: Chalk;
  description: Chalk;
}

export const formatLog = (args: { label: string; level: LogLevel; message: string }) => {
  const result = `${chalk.gray.bold("$")} ${chalk.gray.bold(
    moment().format("YYYY-MM-DD hh:mm:ss")
  )} ${chalk.blue.bold(`[${args.label}]`)} ${get(
    levelColor,
    args.level,
    chalk.red.bold
  )(`[${upperFirst(args.level)}]`)}: ${args.message}`;
  return chalk.white.bold(result);
};

/** 检测最新版本 */
export async function checkUpdate() {
  try {
    const version = await latestVersion(pkg.name);
    if (semver.lt(pkg.version, version)) {
      Logger.warn("检查到最新版本", chalk.green.bold(version));
      Logger.warn(`请执行 ${chalk.green.bold(`npm i ${pkg.name}@${version} -g`)} 进行更新`);
    } else {
      // Logger.info(`当前已是最新版本: ${pkg.version}`);
    }
  } catch {}
}

/** 重构帮助样式 */
export function initHelp(label: string, program: Command, userHelpColor: Partial<HelpColor> = {}) {
  const helpColor: HelpColor = defaultsDeep(userHelpColor, {
    logo: chalk.cyan.bold,
    usage: chalk.yellow.bold,
    head: chalk.white.bold,
    title: chalk.green.bold,
    description: chalk.gray.bold
  } as HelpColor);

  program.configureHelp({
    helpWidth: max([process.stdout.columns, 100]),
    // sortSubcommands: true,
    formatHelp: (cmd, helper) => {
      const termWidth = helper.padWidth(cmd, helper);
      const helpWidth = helper.helpWidth || 80;
      const itemIndentWidth = 4;
      const itemSeparatorWidth = 2;

      function formatItem(term: string, description: string) {
        term = helpColor.title(term.padEnd(termWidth + itemSeparatorWidth));
        description = helpColor.description(description);
        if (description) {
          const fullText = `${term}${description}`;
          return helper.wrap(fullText, helpWidth - itemIndentWidth, termWidth + itemSeparatorWidth);
        }
        return term;
      }

      function formatList(textArray: string[]) {
        return textArray.join("\n").replace(/^/gm, " ".repeat(itemIndentWidth));
      }

      const usage = `${helpColor.head("🛷 使用")} ${helpColor.usage(helper.commandUsage(cmd))}`;
      const title = helpColor.logo(
        figlet.textSync(label, {
          // font: "Ghost",
          horizontalLayout: "Isometric1",
          verticalLayout: "default",
          width: 200,
          whitespaceBreak: true
        })
      );

      let output = [title, "", usage, ""];

      // cmd 详细介绍 (description)
      const commandDescription = helper.commandDescription(cmd);
      if (commandDescription.length > 0)
        output = output.concat([helpColor.description(commandDescription), ""]);

      // cmd 参数介绍
      const argumentList = helper.visibleArguments(cmd).map((argument) => {
        return formatItem(helper.argumentTerm(argument), helper.argumentDescription(argument));
      });
      if (argumentList.length > 0)
        output = output.concat([helpColor.head("🛠️  参数"), formatList(argumentList), ""]);

      // cmd 配置介绍
      const optionList = helper.visibleOptions(cmd).map((option) => {
        return formatItem(helper.optionTerm(option), helper.optionDescription(option));
      });
      if (optionList.length > 0)
        output = output.concat([helpColor.head("🪁 配置"), formatList(optionList), ""]);

      // cmd 命令介绍
      const commandList = helper.visibleCommands(cmd).map((cmd) => {
        return formatItem(helper.subcommandTerm(cmd), helper.subcommandDescription(cmd));
      });
      if (commandList.length > 0)
        output = output.concat([helpColor.head("🐳 指令"), formatList(commandList), ""]);

      return output.join("\n");
    },

    //获取要在子命令列表中显示的命令术语 : Get the command term to show in the list of subcommands
    subcommandTerm: (cmd) => cmd.name() // Just show the name, instead of short usage.
  });
}

/** 重构错误输出 */
export function initOutput(program: Command) {
  program.configureOutput({
    outputError(str) {
      if (str.indexOf("error: missing required argument") !== -1) {
        const args = str.match(/\'(.+)\'/)![1];
        Logger.error(`缺少所需的参数 "${chalk.yellow.bold(args)}"`);
      } else if (str.indexOf("unknown option") !== -1) {
        const args = str.match(/\'(.+)\'/)![1];
        Logger.error(`未知配置 "${chalk.yellow.bold(args)}"`);
      } else {
        Logger.error(str);
      }
    }
  });
  // program.exitOverride((_err) => {
  //   process.exitCode = 1;
  // });
}

/** 未知命令输出 */
export function initUnKnowCommand(program: Command) {
  program.command("*", { hidden: true }).action(function (_, cmd) {
    Logger.error(`未找到对应的指令: ${chalk.yellow.bold(cmd.args.join(", "))}`);
  });

  // 关闭 -h, -help 配置
  // program.helpOption(false);
  // 关闭子命令中的help
  program.addHelpCommand(false);
}
