import chokidar from "chokidar";
import { Command } from "commander";
import electron from "electron";
import { execa, ExecaChildProcess } from "execa";
import { copySync } from "fs-extra";
import { basename, resolve } from "path";
import { WebSocketServer } from "ws";
import { Logger } from "@imohuan/log";
import { decode } from "../helper/encoding";
import { buildElectron, buildFile, buildMain, loadConfig } from "./build";
import { ElectronConfig } from "../typings/command";
import readline from "readline";

export const defaultConfigName = "electron.config.ts";

export function electronHot(config: ElectronConfig) {
  const wss = new WebSocketServer({ port: 36600 });

  let _process: ExecaChildProcess;
  let _abortController: AbortController;

  const start: Function = () => {
    _abortController = new AbortController();
    const inputFile = resolve(config.outDir, "index.js");
    _process = execa(electron as any, [inputFile], {
      cwd: process.cwd(),
      signal: _abortController.signal,
      windowsHide: false,
      encoding: "buffer"
    });
    const onData = (data: any) => {
      const msg = decode(data, "utf-8").replaceAll("\n", "").trim();
      msg && console.log(msg);
    };
    _process.stdout?.on("data", onData);
    _process.stderr?.on("data", onData);
    _process.on("exit", () => {
      // TODO 在程序完全退出之后也退出终端
    });
  };

  const restart: Function = () => {
    _process.kill();
    start();
  };

  const refresh = (path: string) => {
    const sendValue = JSON.stringify({ type: "refresh", path });
    wss.clients.forEach((client) => client.send(sendValue));
  };

  const end: Function = () => {
    _process.kill();
    wss.close();
  };

  return { start, restart, end, refresh };
}

export function commandCommand(program: Command) {
  program
    .command("dev")
    .option(
      "-c, --config <config_path>",
      `配置文件地址, 默认为 ${defaultConfigName}`,
      resolve(process.cwd(), defaultConfigName)
    )
    .description("进入开发模式")
    .action(async ({ config: configPath }) => {
      const config = loadConfig(configPath);
      if (!config) return;

      await buildElectron(config);
      readline.emitKeypressEvents(process.stdin);
      process.stdin.setRawMode(true);
      process.stdin.on("keypress", async (_, key): Promise<any> => {
        if (key.ctrl && key.name === "c") return exit();
        if (key.name === "c") console.clear();
        if (key.name === "r") {
          await buildMain(config, config.inputFile);
          Logger.info("重新加载应用 => Main");
          hot.restart();
        }
      });

      const hot = electronHot(config);
      hot.start();

      const exit = () => {
        Logger.info("退出 Exit;");
        hot.end();
        process.exit(0);
      };

      chokidar.watch(config.inputFile).on("change", async () => {
        await buildMain(config, config.inputFile);
        Logger.info("热重载 => Main");
        hot.restart();
      });

      chokidar
        .watch([config.preloadDir, ...config.preloadFiles].filter((f) => f.trim()))
        .on("change", async (path) => {
          await buildFile(config, path);
          hot.refresh(path);
          Logger.info(`热重载 => Preload [${basename(path)}]`);
        });

      process.on("SIGINT", exit);
    });

  program
    .command("build")
    .option(
      "-c, --config <config_path>",
      `配置文件地址, 默认为 ${defaultConfigName}`,
      resolve(process.cwd(), defaultConfigName)
    )
    .description("进入编译模式")
    .action(async ({ config: configPath }) => {
      const config = loadConfig(configPath);
      if (!config) return;
      await buildElectron(config);
    });

  program
    .command("init")
    .description("创建初始化模板")
    .action(async () => {
      copySync(resolve(__dirname, "../template"), process.cwd());
    });
}
