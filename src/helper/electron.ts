import { ipcRenderer } from "electron";

export function isMain(): boolean {
  return !!require("electron").ipcMain;
}

export function isDev(): boolean {
  return isMain() ? require("electron-is-dev") : ipcRenderer.sendSync("get-is-dev");
}
