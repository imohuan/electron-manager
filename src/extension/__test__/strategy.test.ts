import { assert, describe, it } from "vitest";
import { StrategyGit } from "../strategy/git";
import { resolve } from "path";
import { Hooks } from "../hooks";
import { StrategyNpm } from '../../../local-test/plugin/index';




describe("test git strategy", () => {
  const option: any = {
    baseDir: resolve(__dirname, "plugin"),
    fileName: "package.json",
    hooks: new Hooks()
  }

  it("gitee", async () => {
    const git = new StrategyGit(option);
    const info = await git.info("https://gitee.com/layui/layui-vue.git", {});
    assert.equal(typeof info, "object");
  });

  it("npm", async () => {
    const git = new StrategyNpm(option)
    // git.install("")
  })
});
