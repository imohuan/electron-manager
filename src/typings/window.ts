import { BrowserWindowConstructorOptions } from "electron";

export type Window = {
  /** 加载URL */
  url?: string;
  /** 加载文件 */
  file?: string;
  /** 加载 Url 或者 文件 */
  path?: string;
  /** 开启控制台 */
  devtool?: "left" | "right" | "bottom" | "undocked" | "detach";
  /** 是否开启webview */
  webview?: boolean;
  /** 在程序关闭的时候重启该窗口 */
  reload?: boolean;
} & BrowserWindowConstructorOptions;

export type WindowOption = { name: string; id: number; webContentId: number; option: Window };
