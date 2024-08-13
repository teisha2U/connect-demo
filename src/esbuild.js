const fs = require("fs");
const path = require("path");
const esbuild = require("esbuild");

const builderDir = "cfn-lex-resources";
const outDir = "dist";
// const entryPoints = fs.readdirSync(path.join(__dirname, functionsDir)).map((entry) => `${functionsDir}/${entry}/index.ts`);
const entryPoints = [path.join(__dirname, builderDir, "index.js")];

esbuild.build({
  entryPoints,
  bundle: true,
  outdir: path.join(__dirname, outDir),
  outbase: "./",
  platform: "node",
  sourcemap: "inline",
});
