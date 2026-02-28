import * as esbuild from "esbuild";
import { cpSync } from "fs";

const watch = process.argv.includes("--watch");

/** Copy static assets (manifest, popup.html, icons) into dist/ */
function copyStatic() {
  cpSync("static", "dist", { recursive: true });
}

const buildOptions = {
  entryPoints: {
    background: "src/background/index.ts",
    popup: "src/popup/index.ts",
  },
  bundle: true,
  outdir: "dist",
  format: "iife",
  target: "chrome120",
  logLevel: "info",
};

if (watch) {
  const ctx = await esbuild.context(buildOptions);
  copyStatic();
  await ctx.watch();
  console.log("Watching for changes...");
} else {
  await esbuild.build(buildOptions);
  copyStatic();
}
