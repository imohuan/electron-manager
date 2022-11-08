export class Hooks {
  private hooks: Map<string, Set<Function>> = new Map();
  constructor() {}

  add(name: string, fn: Function) {
    const hooks = this.get(name);
    hooks.add(fn);
    this.hooks.set(name, hooks);
  }

  remove(name: string, fn: Function) {
    const hooks = this.get(name);
    hooks.delete(fn);
    this.hooks.set(name, hooks);
  }

  get(name: string) {
    return this.hooks.get(name) || new Set();
  }

  invoke(name: string, ...args: any[]) {
    for (const hook of this.get(name)) {
      hook(...args);
    }
  }

  async invokePromise(name: string, ...args: any[]) {
    for (const hook of this.get(name)) {
      await hook(...args);
    }
  }
}
