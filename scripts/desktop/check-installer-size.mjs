import fs from "node:fs";
import path from "node:path";

import { repoRoot } from "./web-runtime-contract.mjs";

const MIB = 1024 * 1024;
const TARGETS = {
  linux: {
    extensions: new Map([
      [".AppImage", 350],
      [".deb", 280],
    ]),
  },
  mac: {
    extensions: new Map([
      [".dmg", 260],
      [".zip", 260],
    ]),
  },
  windows: {
    extensions: new Map([[".exe", 260]]),
  },
};

const targetIndex = process.argv.indexOf("--target");
const target = targetIndex >= 0 ? process.argv[targetIndex + 1] : null;
if (!target || !TARGETS[target]) {
  throw new Error("Usage: node scripts/desktop/check-installer-size.mjs --target linux|mac|windows");
}

const desktopPackage = JSON.parse(
  fs.readFileSync(path.join(repoRoot, "apps", "desktop", "package.json"), "utf8"),
);
const installerDirectory = path.join(repoRoot, "dist", "installers");
const entries = fs.readdirSync(installerDirectory, { withFileTypes: true });

for (const [extension, budgetMiB] of TARGETS[target].extensions) {
  const artifacts = entries.filter(
    (entry) =>
      entry.isFile() &&
      entry.name.includes(desktopPackage.version) &&
      entry.name.endsWith(extension),
  );
  if (artifacts.length === 0) {
    throw new Error(`No ${target} ${extension} artifact found for version ${desktopPackage.version}.`);
  }
  for (const artifact of artifacts) {
    const artifactPath = path.join(installerDirectory, artifact.name);
    const bytes = fs.statSync(artifactPath).size;
    const sizeMiB = bytes / MIB;
    if (bytes > budgetMiB * MIB) {
      throw new Error(
        `${artifact.name} is ${sizeMiB.toFixed(1)} MiB; budget is ${budgetMiB} MiB.`,
      );
    }
    console.log(`${artifact.name}: ${sizeMiB.toFixed(1)} MiB / ${budgetMiB} MiB budget`);
  }
}
