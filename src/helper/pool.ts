import { createPool, Pool } from "generic-pool";

export class SamplePool {
  private pool: Pool<any>;

  constructor(max: number = 40) {
    this.pool = createPool({ create: async () => [], destroy: async () => {} }, { max });
  }

  async run(cb: Function): Promise<any> {
    return new Promise((_resolve) => {
      this.pool.acquire().then(async (client) => {
        let result: any = null;
        try {
          result = await cb();
        } catch (e) {
          console.error("[Pool Error]", e);
        }
        this.pool.release(client);
        _resolve(result);
      });
    });
  }

  clear(cb?: Function): Promise<any> {
    return new Promise((_resolve) => {
      this.pool.drain().then(async () => {
        try {
          cb && (await cb());
        } catch {}
        await this.pool.clear();
        _resolve(true);
      });
    });
  }
}
