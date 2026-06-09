import { access, rm } from "node:fs/promises";
import { execSync } from "node:child_process";
import { join } from "node:path";

const markers = [
  join("node_modules", "@heroui/styles/dist/components/breadcrumbs/breadcrumbs.styles.js"),
  join("node_modules", "@heroui/styles/dist/components/close-button/close-button.styles.js"),
  join("node_modules", "@heroui/styles/dist/components/disclosure-group.css"),
  join("node_modules", "@upstash/ratelimit/dist/index.js"),
];

let needsHerouiRepair = false;
let needsRatelimitRepair = false;

for (const marker of markers) {
  try {
    await access(marker);
  } catch {
    if (marker.includes("@heroui/styles")) needsHerouiRepair = true;
    if (marker.includes("@upstash/ratelimit")) needsRatelimitRepair = true;
  }
}

if (needsHerouiRepair) {
  console.log("Repairing corrupted @heroui/styles install…");
  await rm(join("node_modules", "@heroui/styles"), { recursive: true, force: true });
  execSync("npm install @heroui/styles@3.1.0 --no-fund --no-audit", { stdio: "inherit" });
}

if (needsRatelimitRepair) {
  console.log("Repairing corrupted @upstash/ratelimit install…");
  await rm(join("node_modules", "@upstash/ratelimit"), { recursive: true, force: true });
  execSync("npm install @upstash/ratelimit@^2.0.8 --no-fund --no-audit", { stdio: "inherit" });
}
