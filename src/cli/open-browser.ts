import { spawn } from "node:child_process";
import type { Logger } from "../application/ports/index.ts";

export const browserCommand = (url: string, platform: NodeJS.Platform): [string, string[]] => {
  switch (platform) {
    case "darwin":
      return ["open", [url]];
    case "win32":
      // The empty title stops `start` from taking the URL for the window title.
      return ["cmd", ["/c", "start", '""', url]];
    default:
      return ["xdg-open", [url]];
  }
};

/** Opens the URL in the default browser. A failure only warns: the URL is printed anyway. */
export const openBrowser = (url: string, logger: Logger, platform = process.platform): void => {
  const [file, args] = browserCommand(url, platform);
  const warn = (reason: string) =>
    logger.warn("Couldn't open the browser; open the printed URL yourself", { reason });
  try {
    const child = spawn(file, args, {
      detached: true,
      stdio: "ignore",
      windowsVerbatimArguments: platform === "win32",
    });
    child.on("error", (error) => warn(error.message));
    child.on("exit", (code) => {
      if (code !== 0 && code !== null) warn(`${file} exited with ${code}`);
    });
    child.unref();
  } catch (error) {
    warn(error instanceof Error ? error.message : String(error));
  }
};
