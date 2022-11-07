import { execa, ExecaChildProcess, Options as ExecaOptions } from "execa";
import { defaultsDeep } from "lodash-es";

export interface ExecCommandOption extends ExecaOptions {
  onMessage: (status: "stdout" | "stderr", msg: string) => void;
}

export function execCommand(
  program: string,
  args: string[],
  ops: Partial<ExecCommandOption> = {}
): Promise<{
  code: number;
  stdout: any[];
  stderr: any[];
  messages: any[];
  process: ExecaChildProcess<string>;
}> {
  return new Promise((_resolve) => {
    const { onMessage, ...execaOption }: ExecCommandOption = defaultsDeep(ops, {
      onMessage: () => {}
    } as ExecCommandOption);

    const _process = execa(program, args, execaOption);
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

    _process.on("close", (code: number) =>
      _resolve({ code, stdout, stderr, messages, process: _process })
    );
  });
}
