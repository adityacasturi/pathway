import { register } from "node:module";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = path.resolve(fileURLToPath(new URL("../", import.meta.url)));

register(pathToFileURL(path.join(root, "tests/path-alias-hook.mjs")).href, pathToFileURL(root));
