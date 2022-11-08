import { AbstractStrategy, ExtensionStrategyOption } from "./strategy/abstract";
import { StrategyGit } from "./strategy/git";
import { StrategyNpm } from "./strategy/npm";

export class ExtensionStrategy {
  protected map: Map<string, AbstractStrategy> = new Map();

  constructor(private option: ExtensionStrategyOption) {
    this.map.set("git", new StrategyGit(this.option));
    this.map.set("npm", new StrategyNpm(this.option));
  }

  add(name: string, instance: AbstractStrategy) {
    this.map.set(name, instance);
  }

  async call<K extends keyof AbstractStrategy>(
    strategyName: string,
    type: K,
    ...args: Parameters<AbstractStrategy[K]>
  ): Promise<ReturnType<AbstractStrategy[K]> | null> {
    if (!this.map.has(strategyName)) return null;
    const fn = this.map.get(strategyName)!;
    return await (fn[type] as any)(...args);
  }

  async callList<K extends keyof AbstractStrategy>(
    type: K,
    ...args: Parameters<AbstractStrategy[K]>
  ): Promise<any[]> {
    return await Promise.all(Array.from(this.map.values()).map((m) => (m[type] as any)(...args)));
  }
}
