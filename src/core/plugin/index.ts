import { AdapterGit } from "./git";
import { AdapterNpm } from "./npm";

export class PluginStrategy {
  constructor(private option: any = {}) {}

  getStrategy(uri: string) {
    if (uri.startsWith("http")) return new AdapterGit(this.option);
    else return new AdapterNpm(this.option);
  }

  //

  async call(type: "install" | "uninstall" | "update" | "list" | "info", url: string, option: any) {
    const fn: Function = this.getStrategy(url)[type];
    return await fn(url, option);
  }
}
