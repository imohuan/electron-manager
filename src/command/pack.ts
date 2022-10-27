import { Command } from "commander";
import Builder from "electron-builder";
import { defaultsDeep } from "lodash-es";
import { resolve } from "path";

import { Logger } from "@imohuan/log";

import { ElectronConfig, Pack, PlatformType } from "../typings/command";
import { buildElectron, loadConfig } from "./build";
import { defaultConfigName } from "./command";
import { writeFileSync } from "fs-extra";

const builder: typeof Builder = require("electron-builder");
const Platform = builder.Platform;

export function getPresetOption(config: ElectronConfig & { package: any }): Builder.Configuration {
  const baseConfig = config.pack;
  const presetConfig = config.packPreset!;

  const repo = config.package?.repo || "";
  const author = config.package?.author || "Unknown";

  const icons = {
    win: resolve(presetConfig.iconDir, "win", "icon.ico"),
    mac: resolve(presetConfig.iconDir, "mac", "icon.icns"),
    png: resolve(presetConfig.iconDir, "png", "512x512.png")
  };

  const defaults: any = {};
  if (baseConfig?.publish) defaults.publish = baseConfig.publish;

  return defaultsDeep(
    defaults,
    {
      directories: { output: "dist-electron" },
      appId: presetConfig.appId,
      productName: presetConfig.name,
      files: presetConfig.files,
      copyright: `Copyright © ${new Date().getFullYear()} ${config.package?.author || "Unknown"}`,
      publish: [
        {
          provider: "github",
          token: process.env["GH_TOKEN"],
          owner: author,
          repo,
          private: true,
          releaseType: "draft"
        }
      ],
      electronDownload: { mirror: "https://npm.taobao.org/mirrors/electron/" },
      win: {
        icon: icons.win,
        target: [{ target: "nsis", arch: ["ia32"] }], // "x64"
        artifactName: "${productName}_setup_${version}.${ext}"
      },
      nsis: {
        oneClick: false,
        perMachine: false, //是否开启安装时权限限制（此电脑或当前用户）
        allowToChangeInstallationDirectory: true,
        installerIcon: icons.win, //安装图标
        uninstallerIcon: icons.win, //卸载图标
        installerHeaderIcon: icons.win, //安装时头部图标
        deleteAppDataOnUninstall: false, // 卸载时删除用户数据
        createDesktopShortcut: true, // 创建桌面图标
        createStartMenuShortcut: true //创建开始菜单图标
      },
      dmg: {
        background: icons.png,
        contents: [
          { x: 410, y: 190, type: "link", path: "/Applications" },
          { x: 130, y: 190, type: "file" }
        ],
        window: { width: 1080, height: 760 }
      },
      mac: {
        icon: icons.mac,
        target: ["dmg", "zip"],
        // 您的应用程序是否必须使用强化的运行时进行签名。
        hardenedRuntime: true,
        // 是否让电子OSX签名验证签名。
        gatekeeperAssess: true,
        artifactName: "${productName}-${platform}-${arch}-${version}.${ext}"
      }
    } as Builder.Configuration,
    baseConfig,
    { asar: false } as Builder.Configuration
  );
}

export function commandPack(program: Command) {
  program
    .command("pack")
    .option(
      "-c, --config <config_path>",
      `配置文件地址, 默认为 ${defaultConfigName}`,
      resolve(process.cwd(), defaultConfigName)
    )
    .option("-t, --token <GH_TOKEN>", "自动更新的TOKEN，如GitHub的GH_TOKEN", "")
    .option("-o, --output <file_path>", "输出配置文件地址，默认不输出", "")
    .description("打包应用")
    .action(async ({ config: configPath, output, token }) => {
      const config = loadConfig(configPath);
      if (!config) return;
      process.env["GH_TOKEN"] = token;

      /** 1. 编译 electron 程序 */
      await buildElectron(config);

      /** 2. 修改配置 */
      let customOption: Pack = config.pack;
      if (config?.packPreset) customOption = getPresetOption(config);

      /** 3. 获取对应平台 */
      const platformList: PlatformType[] = ["windows", "mac", "linux"];
      const targetName: PlatformType = platformList.includes(config.packTarget)
        ? config.packTarget
        : "windows";
      let targets = Platform.WINDOWS.createTarget();
      if (targetName === "mac") targets = Platform.MAC.createTarget();
      if (targetName === "linux") targets = Platform.LINUX.createTarget();

      /** 4. 打包 */
      if (output.trim()) {
        writeFileSync(resolve(process.cwd(), output), JSON.stringify(customOption, null, 2));
      }

      builder
        .build({ targets, config: customOption })
        .then((res) => {
          Logger.info("打包成功:", JSON.stringify(res, null, 2));
        })
        .catch((error) => {
          Logger.error("打包失败:");
          console.log(error);
        });

      // const publish = new builder.PublishManager();
    });
}
