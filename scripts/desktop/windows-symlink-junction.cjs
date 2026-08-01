const fs = require("node:fs");
const path = require("node:path");

const repositoryRoot = path.resolve(__dirname, "..", "..");
const standaloneRoot = path.join(
  repositoryRoot,
  "apps",
  "web",
  ".next",
  "standalone",
);

function stripWindowsNamespace(value) {
  if (value.startsWith("\\\\?\\UNC\\")) {
    return `\\\\${value.slice(8)}`;
  }
  if (value.startsWith("\\\\?\\")) {
    return value.slice(4);
  }
  return value;
}

function isInside(parent, candidate, pathApi = path) {
  const relative = pathApi.relative(parent, candidate);
  return (
    relative === "" ||
    (relative !== ".." &&
      !relative.startsWith(`..${pathApi.sep}`) &&
      !pathApi.isAbsolute(relative))
  );
}

function mapStandaloneJunctionTarget(
  target,
  linkPath,
  roots = { repositoryRoot, standaloneRoot },
  pathApi = path,
) {
  const normalizedTarget = stripWindowsNamespace(String(target));
  const absoluteTarget = pathApi.isAbsolute(normalizedTarget)
    ? pathApi.normalize(normalizedTarget)
    : pathApi.resolve(pathApi.dirname(linkPath), normalizedTarget);
  if (
    isInside(roots.standaloneRoot, linkPath, pathApi) &&
    isInside(roots.repositoryRoot, absoluteTarget, pathApi) &&
    !isInside(roots.standaloneRoot, absoluteTarget, pathApi)
  ) {
    return pathApi.join(
      roots.standaloneRoot,
      pathApi.relative(roots.repositoryRoot, absoluteTarget),
    );
  }
  return absoluteTarget;
}

if (process.platform === "win32") {
  const originalSymlink = fs.symlink;
  const originalSymlinkSync = fs.symlinkSync;
  const originalPromisesSymlink = fs.promises.symlink;

  function isDirectorySync(target, linkPath) {
    try {
      return fs.statSync(target).isDirectory();
    } catch {
      if (!isInside(standaloneRoot, linkPath)) {
        return false;
      }
      const sourcePath = path.join(repositoryRoot, path.relative(standaloneRoot, linkPath));
      try {
        return fs.statSync(sourcePath).isDirectory();
      } catch {
        return false;
      }
    }
  }

  async function isDirectory(target, linkPath) {
    try {
      return (await fs.promises.stat(target)).isDirectory();
    } catch {
      if (!isInside(standaloneRoot, linkPath)) {
        return false;
      }
      const sourcePath = path.join(repositoryRoot, path.relative(standaloneRoot, linkPath));
      try {
        return (await fs.promises.stat(sourcePath)).isDirectory();
      } catch {
        return false;
      }
    }
  }

  fs.symlink = function symlinkWithJunctionFallback(target, linkPath, type, callback) {
    if (typeof type === "function") {
      callback = type;
      type = undefined;
    }
    const mappedTarget = mapStandaloneJunctionTarget(target, linkPath);
    const nextType = type ?? (isDirectorySync(mappedTarget, linkPath) ? "junction" : undefined);
    return originalSymlink.call(this, mappedTarget, linkPath, nextType, callback);
  };

  fs.symlinkSync = function symlinkSyncWithJunctionFallback(target, linkPath, type) {
    const mappedTarget = mapStandaloneJunctionTarget(target, linkPath);
    const nextType = type ?? (isDirectorySync(mappedTarget, linkPath) ? "junction" : undefined);
    return originalSymlinkSync.call(this, mappedTarget, linkPath, nextType);
  };

  fs.promises.symlink = async function promisesSymlinkWithJunctionFallback(target, linkPath, type) {
    const mappedTarget = mapStandaloneJunctionTarget(target, linkPath);
    const nextType = type ?? ((await isDirectory(mappedTarget, linkPath)) ? "junction" : undefined);
    return originalPromisesSymlink.call(this, mappedTarget, linkPath, nextType);
  };
}

module.exports = {
  isInside,
  mapStandaloneJunctionTarget,
};
