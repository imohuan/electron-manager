import { app } from "electron";
import { resolve } from "path";
import { Manager, ManagerData } from "@imohuan/electron-manager";

/** 全局数据声明 */
interface GlobalData {
  hello: number;
}

/** ipc 声明 */
type IpcRouter = {
  test: (name: string) => string;
};

const m = new Manager<ManagerData<GlobalData>, IpcRouter>();

app.on("ready", async () => {
  m.window!.create("hello", {
    devtool: "bottom",
    file: resolve(__dirname, "../electron-win.html"),
    webPreferences: { preload: resolve(__dirname, "preload/test.js"), nodeIntegration: true }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
