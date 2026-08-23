import { describe, expect, it } from "vitest";
import { installGracefulShutdown, type SignalTarget } from "../src/mcp/gracefulShutdown.js";

class FakeSignalTarget implements SignalTarget {
  readonly listeners = new Map<NodeJS.Signals, (signal: NodeJS.Signals) => void | Promise<void>>();

  once(signal: NodeJS.Signals, listener: (signal: NodeJS.Signals) => void | Promise<void>): void {
    this.listeners.set(signal, listener);
  }

  async emit(signal: NodeJS.Signals): Promise<void> {
    await this.listeners.get(signal)?.(signal);
  }
}

describe("installGracefulShutdown", () => {
  it("registers SIGTERM and SIGINT handlers and closes the HTTP handle once", async () => {
    const signalTarget = new FakeSignalTarget();
    let closeCount = 0;

    installGracefulShutdown(
      {
        close: async () => {
          closeCount += 1;
        }
      },
      { signalTarget }
    );

    await signalTarget.emit("SIGTERM");
    await signalTarget.emit("SIGINT");

    expect(closeCount).toBe(1);
  });
});
