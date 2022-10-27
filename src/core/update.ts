import { app } from "electron";
import { autoUpdater } from "electron-updater";

export function checkUpdate() {
  //检测更新
  autoUpdater.checkForUpdates();

  // 监听'error'事件
  autoUpdater.on("error", (err) => {
    manager.ipc.invoke("update-error", [err]);
  });

  // 监听'update-available'事件，发现有新版本时触发
  autoUpdater.on("update-available", () => {
    manager.ipc.invoke("update-available");
  });

  manager.ipc.handle("update-install", () => {
    autoUpdater.quitAndInstall();
    app.quit();
  });

  autoUpdater.on("update-downloaded", () => {
    manager.ipc.invoke("update-downloaded");
  });
}
