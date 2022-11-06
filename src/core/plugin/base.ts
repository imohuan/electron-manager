import { execa, Options as ExecaOptions } from "execa";
import { ensureDirSync } from "fs-extra";
import { defaultsDeep, isArray } from "lodash-es";

export interface AdapterInfo {
  /** 插件类型 */
  type: "adapter";
  /** 插件名称 */
  name: string;
  /** 可读插件名称 */
  pluginName: string;
  /** 作者 */
  author: string;
  /** 描述 */
  description: string;
  /** 入口文件 */
  main: string;
  /** 版本 */
  version: string;
  /** logo地址 */
  logo: string;
}

export interface AdapterBaseOption {
  baseDir: string;
}

export interface ExecCommandOption extends ExecaOptions {
  onMessage: (status: "stdout" | "stderr", msg: string) => void;
}

export abstract class AdapterBase {
  protected fileName: string;
  constructor(protected baseDir: string) {
    this.fileName = "plugin.json";
    ensureDirSync(this.baseDir);
  }

  abstract info(module: string, option: any): Promise<AdapterInfo | null>;
  abstract list(): Promise<AdapterInfo[]>;
  abstract install(modules: string, option: any): Promise<any>;
  abstract update(modules: string): Promise<any>;
  abstract uninstall(modules: string, option: any): Promise<any>;

  protected async execCommandBase(
    program: string,
    args: string[],
    ops: Partial<ExecCommandOption> = {}
  ): Promise<any> {
    return new Promise((_resolve) => {
      const { onMessage, ...execaOption }: ExecCommandOption = defaultsDeep(ops, {
        onMessage: () => {}
      } as ExecCommandOption);

      const _process = execa(program, args, { cwd: this.baseDir, ...execaOption });
      const stdout: any[] = [];
      const stderr: any[] = [];
      const messages: any[] = [];

      _process.stdout
        ?.on("data", (data) => {
          data = data.toString();
          onMessage("stdout", data);
          stdout.push(data);
          messages.push(data);
        })
        .pipe(process.stdout);

      _process.stderr
        ?.on("data", (data) => {
          data = data.toString();
          onMessage("stderr", data);
          stderr.push(data);
          messages.push(data);
        })
        .pipe(process.stdout);

      _process.on("close", (code: number) => _resolve({ code, stdout, stderr, messages }));
    });
  }
}
