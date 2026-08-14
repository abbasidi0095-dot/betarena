import { build, context } from "esbuild";

const watch = process.argv.includes("--watch");

const config = {
  entryPoints: ["server.ts"],
  bundle: true,
  platform: "node",
  format: "cjs",
  outfile: "dist/server.cjs",
  sourcemap: true,
  external: [
    "next",
    "react",
    "react-dom",
    "@prisma/client",
    ".prisma",
    "socket.io",
    "dotenv",
    "sharp",
  ],
  logLevel: "info",
};

if (watch) {
  const ctx = await context(config);
  await ctx.watch();
  console.log("[esbuild] watching for changes…");
} else {
  await build(config);
  process.exit(0);
}
