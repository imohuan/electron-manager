import { Result } from "../helper/result";
import { PluginCallOption } from "./plugin";
import { WindowOption } from "./window";

export type IpcRaw = {
  id: number;
  name: string;
  isMain: boolean;
  option: WindowOption | null;
  callback?: Function;
};

export type IpcRouter = {
  "plugin-name": () => Result;
  "plugin-install": (urlOrName: string, pluginName: string) => Result;
  "plugin-uninstall": (pluginName: string) => Result;
  "plugin-update": (pluginName: string) => any;
  "plugin-call": (name: string, args: any[], option: Partial<PluginCallOption>) => Result;
  "update-error": (e: Error) => any;
  "update-available": () => any;
  "update-downloaded": () => any;
  "update-install": () => any;
};
