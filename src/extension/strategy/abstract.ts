import { Options as ExecaOptions } from "execa";
import { ensureDirSync } from "fs-extra";
import { execCommand } from "../../helper/exec";
import { Result } from "../../helper/result";

import { Hooks } from "../hooks";
import { ExtensionInfo } from "../typings";

export interface ExtensionCallOption {}
export interface ExtensionCallResult {
  /** 耗时 */
  time: number;
  /** 安装的地址 */
  path: string;
  /** 大小 */
  size: number;
  /** 插件名称 (文件夹名称) */
  name: string;
}

export interface ExtensionCallInfoOption {
  /** 是否获取本地的info信息 */
  local: boolean;
}

export interface ExtensionCallListOption {
  /** 是否获取本地的info信息 */
  local: boolean;
}

export interface ExtensionStrategyOption {
  /** Hooks */
  hooks: Hooks;
  /** 基础目录 */
  baseDir: string;
  /** 插件配置文件名称 */
  fileName: string;
}

export interface ExecCommandOption extends ExecaOptions {
  onMessage: (status: "stdout" | "stderr", msg: string) => void;
}

export abstract class AbstractStrategy {
  constructor(protected option: ExtensionStrategyOption) {
    ensureDirSync(this.option.baseDir);
  }

  abstract info(
    module: string,
    option: Partial<ExtensionCallInfoOption>
  ): Promise<ExtensionInfo | null>;

  abstract list(option: Partial<ExtensionCallListOption>): Promise<ExtensionInfo[]>;

  abstract install(
    module: string,
    option: Partial<ExtensionCallOption>
  ): Promise<Result<ExtensionCallResult>>;

  abstract update(
    module: string,
    option: Partial<ExtensionCallOption>
  ): Promise<Result<ExtensionCallResult>>;

  abstract uninstall(
    module: string,
    option: Partial<ExtensionCallOption>
  ): Promise<Result<ExtensionCallResult>>;

  protected async execCommandBase(
    program: string,
    args: string[],
    ops: Partial<ExecCommandOption> = {}
  ): ReturnType<typeof execCommand> {
    return await execCommand(program, args, {
      cwd: this.option.baseDir,
      ...ops
    });
  }
}
