export class Result<T = any> {
  public status: number;
  public message: string;
  public data: T | null;

  constructor(option: { status: number; message?: string; data: T | null }) {
    this.data = option.data;
    this.status = option.status;
    this.message = option?.message || "";
  }

  static msg(status: number, message: string) {
    return new Result({ status, message, data: null });
  }

  static ok<T = any>(data: T | null) {
    return new Result({ status: 200, data });
  }

  static error(message: string) {
    return new Result({ status: 100, message, data: null });
  }

  toString() {
    return JSON.stringify({ status: this.status, message: this.message, data: this.data }, null, 2);
  }
}
