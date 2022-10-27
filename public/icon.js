const { spawn } = require("child_process");
const { app, BrowserWindow, ipcMain } = require("electron");
const { resolve } = require("path");
const { readFileSync, writeFileSync } = require("fs-extra");

app.on("ready", async () => {
  const { input, output } = process.env;
  const window = new BrowserWindow({
    minWidth: 900,
    minHeight: 500,
    autoHideMenuBar: true,
    webPreferences: {
      webSecurity: false,
      contextIsolation: false,
      nodeIntegration: true,
      allowRunningInsecureContent: true
    }
  });

  window.loadFile(resolve(__dirname, `./icon.html`));
  window.webContents.on("did-finish-load", () => {
    window.webContents.send("load", readFileSync(input));
  });

  ipcMain.on("image", (_, image) => {
    const inputImageFile = resolve(output, "crop.jpg");
    writeFileSync(inputImageFile, image);
    const iconBuildName =
      process.platform === "win32" ? "electron-icon-builder.cmd" : "electron-icon-builder";
    const _process = spawn(resolve(__dirname, "../node_modules/.bin", iconBuildName), [
      `--input=${inputImageFile}`,
      `--output=${output}`
    ]);
    _process.on("close", () => app.quit());
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
