export interface CloseHandle {
  close(): Promise<void>;
}

export interface SignalTarget {
  once(signal: NodeJS.Signals, listener: (signal: NodeJS.Signals) => void | Promise<void>): unknown;
}

export function installGracefulShutdown(
  handle: CloseHandle,
  options: { signalTarget?: SignalTarget; onError?: (error: unknown) => void } = {}
): void {
  const signalTarget = options.signalTarget ?? process;
  let shutdownStarted = false;

  const shutdown = async (signal: NodeJS.Signals) => {
    if (shutdownStarted) {
      return;
    }

    shutdownStarted = true;
    console.info(`Received ${signal}; closing HTTP listener.`);
    try {
      await handle.close();
    } catch (error) {
      options.onError?.(error);
      process.exitCode = 1;
    }
  };

  signalTarget.once("SIGTERM", shutdown);
  signalTarget.once("SIGINT", shutdown);
}
