import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

export const repoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "..",
);
export const webDir = path.join(repoRoot, "apps", "web");
export const standaloneDir = path.join(webDir, ".next", "standalone");
export const staticDir = path.join(webDir, ".next", "static");
export const publicDir = path.join(webDir, "public");
export const targetDir = path.join(
  repoRoot,
  "apps",
  "desktop",
  "dist",
  "resources",
  "web",
);
export const targetWebDir = path.join(targetDir, "apps", "web");
export const targetNodeModulesDir = path.join(targetWebDir, "node_modules");
export const runtimeManifestPath = path.join(targetDir, "openreel-runtime.json");

const DEFAULT_STAGE_BUDGET_MIB = 110;
const REQUIRED_RUNTIME_PACKAGES = ["next", "react", "react-dom", "sharp"];

function assertDirectory(directory, message) {
  if (!fs.existsSync(directory) || !fs.statSync(directory).isDirectory()) {
    throw new Error(message);
  }
}

function packagePath(parentDirectory, packageName) {
  return path.join(parentDirectory, ...packageName.split("/"));
}

function listRootPackages(nodeModulesDirectory) {
  const packages = [];
  for (const entry of fs.readdirSync(nodeModulesDirectory, { withFileTypes: true })) {
    if (entry.name.startsWith(".")) {
      continue;
    }
    const entryPath = path.join(nodeModulesDirectory, entry.name);
    if (entry.name.startsWith("@")) {
      for (const scopedEntry of fs.readdirSync(entryPath, { withFileTypes: true })) {
        if (scopedEntry.isDirectory() || scopedEntry.isSymbolicLink()) {
          packages.push(path.join(entryPath, scopedEntry.name));
        }
      }
      continue;
    }
    if (entry.isDirectory() || entry.isSymbolicLink()) {
      packages.push(entryPath);
    }
  }
  return packages;
}

function matchesPlatformConstraint(values, currentValue) {
  if (!Array.isArray(values) || values.length === 0) {
    return true;
  }
  const excluded = values
    .filter((value) => value.startsWith("!"))
    .map((value) => value.slice(1));
  if (excluded.includes(currentValue)) {
    return false;
  }
  const included = values.filter((value) => !value.startsWith("!"));
  return included.length === 0 || included.includes(currentValue);
}

function currentLibc() {
  if (process.platform !== "linux") {
    return null;
  }
  const report = process.report?.getReport?.();
  return report?.header?.glibcVersionRuntime ? "glibc" : "musl";
}

function supportsCurrentRuntime(packageJson) {
  return (
    matchesPlatformConstraint(packageJson.os, process.platform) &&
    matchesPlatformConstraint(packageJson.cpu, process.arch) &&
    matchesPlatformConstraint(packageJson.libc, currentLibc())
  );
}

function dependencyNames(packageJson) {
  const names = new Set([
    ...Object.keys(packageJson.dependencies ?? {}),
    ...Object.keys(packageJson.optionalDependencies ?? {}),
  ]);
  for (const name of Object.keys(packageJson.peerDependencies ?? {})) {
    if (!packageJson.peerDependenciesMeta?.[name]?.optional) {
      names.add(name);
    }
  }
  return [...names];
}

function readPackage(packageDirectory) {
  const packageJsonPath = path.join(packageDirectory, "package.json");
  if (!fs.existsSync(packageJsonPath)) {
    throw new Error(`Runtime package is missing package.json: ${packageDirectory}`);
  }
  return JSON.parse(fs.readFileSync(packageJsonPath, "utf8"));
}

export function copyDirectoryTree(sourceRoot, destinationRoot, options = {}) {
  const exclude = options.exclude ?? (() => false);

  const visit = (source, destination, relative, ancestors) => {
    if (relative && exclude(relative)) {
      return;
    }

    const sourceStat = fs.statSync(source);
    if (sourceStat.isDirectory()) {
      const canonicalSource = fs.realpathSync(source);
      if (ancestors.has(canonicalSource)) {
        throw new Error(`Directory link cycle while staging runtime: ${source}`);
      }
      const nextAncestors = new Set(ancestors);
      nextAncestors.add(canonicalSource);
      fs.mkdirSync(destination, { recursive: true });
      for (const entry of fs.readdirSync(source, { withFileTypes: true })) {
        const entryRelative = relative ? `${relative}/${entry.name}` : entry.name;
        visit(
          path.join(source, entry.name),
          path.join(destination, entry.name),
          entryRelative,
          nextAncestors,
        );
      }
      return;
    }

    if (!sourceStat.isFile()) {
      throw new Error(`Unsupported runtime entry while staging: ${source}`);
    }
    fs.mkdirSync(path.dirname(destination), { recursive: true });
    fs.copyFileSync(source, destination);
    fs.chmodSync(destination, sourceStat.mode);
  };

  visit(sourceRoot, destinationRoot, "", new Set());
}

export function collectRuntimePackages(rootNodeModulesDirectory) {
  assertDirectory(
    rootNodeModulesDirectory,
    `Next standalone node_modules missing: ${rootNodeModulesDirectory}`,
  );
  const queue = listRootPackages(rootNodeModulesDirectory).map((packageDirectory) =>
    fs.realpathSync(packageDirectory),
  );
  const packages = new Map();

  while (queue.length > 0) {
    const packageDirectory = queue.shift();
    const packageJson = readPackage(packageDirectory);
    if (!supportsCurrentRuntime(packageJson)) {
      continue;
    }

    const existing = packages.get(packageJson.name);
    if (existing) {
      if (existing.source !== packageDirectory) {
        throw new Error(
          `Runtime dependency ${packageJson.name} resolves to multiple versions: ` +
            `${existing.version} and ${packageJson.version}`,
        );
      }
      continue;
    }

    packages.set(packageJson.name, {
      name: packageJson.name,
      version: packageJson.version,
      source: packageDirectory,
    });

    const dependencyDirectory = path.dirname(packageDirectory);
    for (const dependencyName of dependencyNames(packageJson)) {
      const candidate = packagePath(dependencyDirectory, dependencyName);
      if (fs.existsSync(candidate)) {
        queue.push(fs.realpathSync(candidate));
      }
    }
  }

  for (const packageName of REQUIRED_RUNTIME_PACKAGES) {
    if (!packages.has(packageName)) {
      throw new Error(`Required web runtime package was not traced: ${packageName}`);
    }
  }
  return [...packages.values()].sort((left, right) => left.name.localeCompare(right.name));
}

function copyPackage(packageInfo) {
  const destination = packagePath(targetNodeModulesDir, packageInfo.name);
  copyDirectoryTree(packageInfo.source, destination, {
    exclude(relative) {
      return relative === "node_modules" || relative.startsWith("node_modules/");
    },
  });
}

function copyStandaloneApplication() {
  copyDirectoryTree(standaloneDir, targetDir, {
    exclude(relative) {
      const excludedDirectories = [
        "node_modules",
        "apps/web/node_modules",
      ];
      return excludedDirectories.some(
        (excluded) =>
          relative === excluded || relative.startsWith(`${excluded}/`),
      );
    },
  });
}

export function directoryStats(directory) {
  let bytes = 0;
  let files = 0;
  let links = 0;
  const visit = (current) => {
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const entryPath = path.join(current, entry.name);
      if (entry.isSymbolicLink()) {
        links += 1;
      } else if (entry.isDirectory()) {
        visit(entryPath);
      } else if (entry.isFile()) {
        files += 1;
        bytes += fs.statSync(entryPath).size;
      }
    }
  };
  visit(directory);
  return { bytes, files, links };
}

function writeRuntimeManifest(packages) {
  const manifest = {
    schema_version: 1,
    platform: process.platform,
    arch: process.arch,
    libc: currentLibc(),
    build_node_version: process.versions.node,
    packages: packages.map(({ name, version }) => ({ name, version })),
  };
  fs.writeFileSync(runtimeManifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
}

export function stageWebRuntime() {
  assertDirectory(
    standaloneDir,
    "Next standalone output missing. Run `pnpm --filter web build` first.",
  );
  assertDirectory(staticDir, "Next static output missing. Run `pnpm --filter web build` first.");

  const sourceNodeModules = path.join(standaloneDir, "apps", "web", "node_modules");
  const packages = collectRuntimePackages(sourceNodeModules);

  fs.rmSync(targetDir, { recursive: true, force: true });
  fs.mkdirSync(targetDir, { recursive: true });
  copyStandaloneApplication();

  const targetStaticDir = path.join(targetWebDir, ".next", "static");
  fs.cpSync(staticDir, targetStaticDir, { recursive: true });
  if (fs.existsSync(publicDir)) {
    fs.cpSync(publicDir, path.join(targetWebDir, "public"), { recursive: true });
  }

  fs.mkdirSync(targetNodeModulesDir, { recursive: true });
  for (const packageInfo of packages) {
    copyPackage(packageInfo);
  }
  writeRuntimeManifest(packages);
  return { packages, stats: directoryStats(targetDir) };
}

function fileInventory(directory) {
  const inventory = new Map();
  const visit = (current) => {
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const entryPath = path.join(current, entry.name);
      if (entry.isDirectory()) {
        visit(entryPath);
      } else if (entry.isFile()) {
        const relative = path.relative(directory, entryPath).split(path.sep).join("/");
        const hash = crypto.createHash("sha256").update(fs.readFileSync(entryPath)).digest("hex");
        inventory.set(relative, hash);
      }
    }
  };
  visit(directory);
  return inventory;
}

function assertSameInventory(source, staged, label) {
  const sourceInventory = fileInventory(source);
  const stagedInventory = fileInventory(staged);
  if (sourceInventory.size !== stagedInventory.size) {
    throw new Error(
      `${label} file count differs: source=${sourceInventory.size}, staged=${stagedInventory.size}`,
    );
  }
  for (const [relative, hash] of sourceInventory) {
    if (stagedInventory.get(relative) !== hash) {
      throw new Error(`${label} differs after staging: ${relative}`);
    }
  }
  return sourceInventory.size;
}

export function verifyWebRuntime() {
  assertDirectory(targetDir, "Staged web runtime is missing. Run `pnpm desktop:stage:web` first.");
  const serverPath = path.join(targetWebDir, "server.js");
  if (!fs.existsSync(serverPath)) {
    throw new Error(`Staged Next server is missing: ${serverPath}`);
  }
  if (!fs.existsSync(runtimeManifestPath)) {
    throw new Error(`Staged runtime manifest is missing: ${runtimeManifestPath}`);
  }

  const stats = directoryStats(targetDir);
  if (stats.links > 0) {
    throw new Error(`Staged web runtime must be self-contained; found ${stats.links} symbolic links.`);
  }
  if (fs.existsSync(path.join(targetDir, "node_modules"))) {
    throw new Error("Staged web runtime still contains a duplicate root node_modules directory.");
  }

  const budgetMiB = Number(process.env.OPENREEL_WEB_STAGE_MAX_MIB ?? DEFAULT_STAGE_BUDGET_MIB);
  const budgetBytes = budgetMiB * 1024 * 1024;
  if (!Number.isFinite(budgetBytes) || budgetBytes <= 0) {
    throw new Error(`Invalid OPENREEL_WEB_STAGE_MAX_MIB: ${process.env.OPENREEL_WEB_STAGE_MAX_MIB}`);
  }
  if (stats.bytes > budgetBytes) {
    throw new Error(
      `Staged web runtime is ${(stats.bytes / 1024 / 1024).toFixed(1)} MiB; ` +
        `budget is ${budgetMiB} MiB.`,
    );
  }

  const manifest = JSON.parse(fs.readFileSync(runtimeManifestPath, "utf8"));
  if (manifest.platform !== process.platform || manifest.arch !== process.arch) {
    throw new Error(
      `Staged runtime target is ${manifest.platform}/${manifest.arch}, ` +
        `current target is ${process.platform}/${process.arch}.`,
    );
  }
  if (manifest.libc !== currentLibc()) {
    throw new Error(`Staged runtime libc is ${manifest.libc}; current libc is ${currentLibc()}.`);
  }
  const manifestPackageNames = new Set(manifest.packages.map(({ name }) => name));
  const stagedPackages = listRootPackages(targetNodeModulesDir).map((packageDirectory) =>
    readPackage(packageDirectory),
  );
  const stagedPackageNames = new Set(stagedPackages.map(({ name }) => name));
  if (
    manifestPackageNames.size !== stagedPackageNames.size ||
    [...manifestPackageNames].some((name) => !stagedPackageNames.has(name))
  ) {
    throw new Error("Staged runtime packages do not match openreel-runtime.json.");
  }
  for (const packageJson of stagedPackages) {
    if (!supportsCurrentRuntime(packageJson)) {
      throw new Error(`Staged package does not support this runtime: ${packageJson.name}`);
    }
  }
  for (const packageName of REQUIRED_RUNTIME_PACKAGES) {
    if (!manifestPackageNames.has(packageName)) {
      throw new Error(`Runtime manifest is missing required package: ${packageName}`);
    }
  }

  const requireFromServer = createRequire(serverPath);
  for (const packageName of REQUIRED_RUNTIME_PACKAGES) {
    requireFromServer.resolve(packageName);
  }
  const sharp = requireFromServer("sharp");
  if (!sharp.versions?.sharp || !sharp.versions?.vips) {
    throw new Error("The staged sharp runtime could not load its native image library.");
  }

  const directorSource = path.join(publicDir, "director");
  const directorTarget = path.join(targetWebDir, "public", "director");
  const directorFiles = assertSameInventory(directorSource, directorTarget, "Director assets");
  return { stats, directorFiles, packages: manifest.packages.length };
}
