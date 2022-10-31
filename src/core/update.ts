import { app } from "electron";
import { autoUpdater } from "electron-updater";
import { Context } from "./context";

export function checkUpdate(context: Context) {
  //检测更新
  autoUpdater.checkForUpdates();

  // 监听'error'事件
  autoUpdater.on("error", (err) => {
    context.ipc.invoke("update-error", [err]);
  });

  // 监听'update-available'事件，发现有新版本时触发
  autoUpdater.on("update-available", () => {
    context.ipc.invoke("update-available");
  });

  context.ipc.handle("update-install", () => {
    autoUpdater.quitAndInstall();
    app.quit();
  });

  autoUpdater.on("update-downloaded", () => {
    context.ipc.invoke("update-downloaded");
  });
}
