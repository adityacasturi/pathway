#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { globSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(fileURLToPath(new URL("../", import.meta.url)));
const testFiles = globSync("tests/unit/**/*.test.ts", { cwd: root }).sort();

if (testFiles.length === 0) {
  console.error("No unit tests found under tests/unit/");
  process.exit(1);
}

const coverage = process.argv.includes("--coverage");
const nodeArgs = [
  "--disable-warning=ExperimentalWarning",
  "--import",
  path.join(root, "tests/register-alias.mjs"),
  "--experimental-strip-types",
  "--experimental-specifier-resolution=node",
];

if (coverage) {
  nodeArgs.push(
    "--experimental-test-coverage",
    "--test-coverage-include=lib/**",
    "--test-coverage-include=types/**",
    "--test-coverage-exclude=tests/**",
    "--test-coverage-exclude=**/*.test.ts",
    "--test-coverage-exclude=lib/scraping/adapters/**",
  );
}

nodeArgs.push("--test", ...testFiles.map((file) => path.join(root, file)));

const result = spawnSync(process.execPath, nodeArgs, {
  cwd: root,
  stdio: "inherit",
  env: process.env,
});

process.exit(result.status ?? 1);
