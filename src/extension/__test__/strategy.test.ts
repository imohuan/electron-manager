import { defaultsDeep } from "lodash-es";
import { resolve } from "path";
import { assert, describe, it } from "vitest";

import { Hooks } from "../hooks";
import { StrategyGit } from "../strategy/git";
import { StrategyNpm } from "../strategy/npm";

const option: any = {
  baseDir: resolve(__dirname, "plugin"),
  fileName: "package.json",
  hooks: new Hooks()
};

describe("test strategy info", () => {
  it("gitee", async () => {
    const git = new StrategyGit(option);
    const info = await git.info("https://gitee.com/layui/layui-vue.git", {});
    console.log("gitee info", info);
    assert.equal(typeof info, "object");
  });

  it("github", async () => {
    const git = new StrategyGit(defaultsDeep({ fileName: "plugin.json" }, option));
    const info = await git.info("https://github.com/imohuan/electron-plugin-demo.git", {});
    console.log("github info", info);
    assert.equal(typeof info, "object");
  });

  it("npm", async () => {
    const git = new StrategyNpm(option);
    const info = await git.info("axios", {});
    console.log("npm ginfo", info);
    assert.equal(typeof info, "object");
  });
});

describe("test strategy install", () => {
  it("gitee", async () => {
    const git = new StrategyGit(option);
    const info = await git.install("https://gitee.com/layui/layui-vue.git", {});
    console.log("gitee info", info);
    assert.equal(typeof info, "object");
  });

  it("github", async () => {
    const git = new StrategyGit(defaultsDeep({ fileName: "plugin.json" }, option));
    const info = await git.install("https://github.com/imohuan/electron-plugin-demo.git", {});
    console.log("github info", info);
    assert.equal(typeof info, "object");
  });

  it("npm", async () => {
    const git = new StrategyNpm(option);
    const info = await git.install("axios", {});
    console.log("npm ginfo", info);
    assert.equal(typeof info, "object");
  });
});

describe("test strategy uninstall", () => {
  it("gitee", async () => {
    const git = new StrategyGit(option);
    const info = await git.uninstall("https://gitee.com/layui/layui-vue.git", {});
    console.log("gitee info", info);
    assert.equal(typeof info, "object");
  });

  it("github", async () => {
    const git = new StrategyGit(defaultsDeep({ fileName: "plugin.json" }, option));
    const info = await git.uninstall("https://github.com/imohuan/electron-plugin-demo.git", {});
    console.log("github info", info);
    assert.equal(typeof info, "object");
  });

  it("npm", async () => {
    const git = new StrategyNpm(option);
    const info = await git.uninstall("axios", {});
    console.log("npm ginfo", info);
    assert.equal(typeof info, "object");
  });
});
