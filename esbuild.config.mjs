import * as esbuild from "esbuild";
import { cpSync } from "fs";
import dotenv from "dotenv";

// Load environment variables from .env file
dotenv.config();

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
  define: {
    "process.env.SUPABASE_URL": JSON.stringify(process.env.SUPABASE_URL || ""),
    "process.env.SUPABASE_ANON_KEY": JSON.stringify(process.env.SUPABASE_ANON_KEY || ""),
  },
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
