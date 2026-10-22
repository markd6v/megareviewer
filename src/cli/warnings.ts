// Imported first by main.ts, so the listener is in place before node:sqlite loads. Some Node 24
// releases still call SQLite experimental: users can't act on that, so only it is dropped.
process.removeAllListeners("warning");
process.on("warning", (warning) => {
  if (warning.name === "ExperimentalWarning" && warning.message.includes("SQLite")) return;
  process.stderr.write(`(node:${process.pid}) ${warning.name}: ${warning.message}\n`);
});
