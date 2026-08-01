import assert from "node:assert/strict";
import fs from "node:fs";
import { createRequire } from "node:module";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { copyDirectoryTree, directoryStats } from "./web-runtime-contract.mjs";

const require = createRequire(import.meta.url);
const { mapStandaloneJunctionTarget } = require("./windows-symlink-junction.cjs");

function temporaryDirectory(testContext) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "openreel-web-runtime-"));
  testContext.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  return directory;
}

test("copyDirectoryTree excludes runtime dependency trees by stable relative path", (t) => {
  const temporaryRoot = temporaryDirectory(t);
  const source = path.join(temporaryRoot, "source");
  const destination = path.join(temporaryRoot, "destination");
  fs.mkdirSync(path.join(source, "apps", "web", "node_modules", "next"), {
    recursive: true,
  });
  fs.mkdirSync(path.join(source, "node_modules", "react"), { recursive: true });
  fs.writeFileSync(path.join(source, "apps", "web", "server.js"), "server");
  fs.writeFileSync(
    path.join(source, "apps", "web", "node_modules", "next", "package.json"),
    "{}",
  );
  fs.writeFileSync(path.join(source, "node_modules", "react", "package.json"), "{}");

  copyDirectoryTree(source, destination, {
    exclude(relative) {
      return ["node_modules", "apps/web/node_modules"].some(
        (excluded) => relative === excluded || relative.startsWith(`${excluded}/`),
      );
    },
  });

  assert.equal(
    fs.readFileSync(path.join(destination, "apps", "web", "server.js"), "utf8"),
    "server",
  );
  assert.equal(fs.existsSync(path.join(destination, "node_modules")), false);
  assert.equal(fs.existsSync(path.join(destination, "apps", "web", "node_modules")), false);
});

test("copyDirectoryTree dereferences directory links into a self-contained runtime", (t) => {
  const temporaryRoot = temporaryDirectory(t);
  const source = path.join(temporaryRoot, "source");
  const destination = path.join(temporaryRoot, "destination");
  const linkedPackage = path.join(temporaryRoot, "linked-package");
  fs.mkdirSync(source, { recursive: true });
  fs.mkdirSync(linkedPackage, { recursive: true });
  fs.writeFileSync(path.join(linkedPackage, "package.json"), '{"name":"linked"}');
  fs.symlinkSync(
    linkedPackage,
    path.join(source, "linked"),
    process.platform === "win32" ? "junction" : "dir",
  );

  copyDirectoryTree(source, destination);

  assert.equal(fs.lstatSync(path.join(destination, "linked")).isDirectory(), true);
  assert.equal(
    fs.readFileSync(path.join(destination, "linked", "package.json"), "utf8"),
    '{"name":"linked"}',
  );
  assert.equal(directoryStats(destination).links, 0);
});

test("Windows junction targets are remapped into the standalone dependency mirror", () => {
  const pathApi = path.win32;
  const repositoryRoot = "D:\\a\\openreel-studio\\openreel-studio";
  const standaloneRoot = pathApi.join(repositoryRoot, "apps", "web", ".next", "standalone");
  const packageTarget =
    "\\\\?\\D:\\a\\openreel-studio\\openreel-studio\\node_modules\\.pnpm\\next@15.5.18\\node_modules\\next";
  const linkPath = pathApi.join(
    standaloneRoot,
    "apps",
    "web",
    "node_modules",
    "next",
  );

  assert.equal(
    mapStandaloneJunctionTarget(
      packageTarget,
      linkPath,
      { repositoryRoot, standaloneRoot },
      pathApi,
    ),
    pathApi.join(
      standaloneRoot,
      "node_modules",
      ".pnpm",
      "next@15.5.18",
      "node_modules",
      "next",
    ),
  );
});

test("relative Windows symlink targets resolve from the destination link directory", () => {
  const pathApi = path.win32;
  const repositoryRoot = "D:\\repo";
  const standaloneRoot = pathApi.join(repositoryRoot, "apps", "web", ".next", "standalone");
  const linkPath = pathApi.join(
    standaloneRoot,
    "apps",
    "web",
    "node_modules",
    "next",
  );

  assert.equal(
    mapStandaloneJunctionTarget(
      ".\\react",
      linkPath,
      { repositoryRoot, standaloneRoot },
      pathApi,
    ),
    pathApi.join(standaloneRoot, "apps", "web", "node_modules", "react"),
  );
});
