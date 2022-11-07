import { resolve } from "path";

import { PluginStrategy } from "./";
import { AdapterGit } from "./git";
import { AdapterNpm } from "./npm";

// const n = new AdapterNpm({ baseDir: resolve(__dirname, "plugin") });
// const n = new AdapterGit({ baseDir: resolve(__dirname, "plugin") });
// const m = new PluginStrategy({ baseDir: resolve(__dirname, "plugin") });

(async () => {
  // await n.install("rubick-adapter-db");
  // n.info("rubick-adapter-db").then(console.log);
  // n.list().then(console.log);
  // const gitUrl = "https://gitee.com/jackyuzju/UnityAssetsResources.git";
  // await n.install(gitUrl);
  // await n.update(gitUrl);
  // await n.uninstall(gitUrl);
  // n.info(gitUrl).then(console.log);
  // n.list().then(console.log);
})();
