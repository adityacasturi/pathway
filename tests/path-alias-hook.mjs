import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const projectRoot = path.resolve(fileURLToPath(new URL("../", import.meta.url)));

function resolveAliasTarget(specifier) {
  const rel = specifier.slice(2);
  const base = path.join(projectRoot, rel);
  const candidates = [
    base,
    `${base}.ts`,
    `${base}.tsx`,
    path.join(base, "index.ts"),
  ];

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return pathToFileURL(candidate).href;
    }
  }

  return pathToFileURL(`${base}.ts`).href;
}

/**
 * Resolves `@/` imports for Node's native test runner (same mapping as tsconfig paths).
 */
export async function resolve(specifier, context, nextResolve) {
  if (specifier.startsWith("@/")) {
    return nextResolve(resolveAliasTarget(specifier), context);
  }
  return nextResolve(specifier, context);
}
