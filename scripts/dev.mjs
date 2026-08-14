/**
 * Dev loop: esbuild --watch rebuilds dist/server.cjs on change, and
 * `node --watch` restarts the server whenever the bundle changes.
 * Next runs in dev mode (on-demand compilation, HMR assets).
 */
import { spawn } from "node:child_process";

const esbuild = spawn("node", ["scripts/build-server.mjs", "--watch"], {
  stdio: "inherit",
});

const server = spawn(
  "node",
  ["--watch", "--watch-preserve-output", "dist/server.cjs"],
  {
    stdio: "inherit",
    env: { ...process.env, PORT: process.env.PORT ?? "3000" },
  },
);

const shutdown = () => {
  esbuild.kill();
  server.kill();
  process.exit(0);
};
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
