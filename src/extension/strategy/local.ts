import { Result } from "../../helper/result";

import { ExtensionInfo } from "../typings";
import {
  AbstractStrategy,
  ExtensionCallInfoOption,
  ExtensionCallListOption,
  ExtensionCallOption,
  ExtensionCallResult,
  ExtensionStrategyOption
} from "./abstract";

export class StrategyLocal extends AbstractStrategy {
  constructor(option: ExtensionStrategyOption) {
    super(option);
  }

  info(module: string, option: Partial<ExtensionCallInfoOption>): Promise<ExtensionInfo | null> {
    throw new Error("Method not implemented.");
  }

  list(option: Partial<ExtensionCallListOption>): Promise<ExtensionInfo[]> {
    throw new Error("Method not implemented.");
  }

  install(
    module: string,
    option: Partial<ExtensionCallOption>
  ): Promise<Result<ExtensionCallResult>> {
    throw new Error("Method not implemented.");
  }

  update(
    module: string,
    option: Partial<ExtensionCallOption>
  ): Promise<Result<ExtensionCallResult>> {
    throw new Error("Method not implemented.");
  }

  uninstall(
    module: string,
    option: Partial<ExtensionCallOption>
  ): Promise<Result<ExtensionCallResult>> {
    throw new Error("Method not implemented.");
  }
}
