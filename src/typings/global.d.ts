import { Manager } from "../core/manager";
import { IpcRouter } from "./ipc";
import { ManagerData } from "./manager";

declare global {
  const manager: Manager<ManagerData<Record<string, any>>, IpcRouter>;
}
