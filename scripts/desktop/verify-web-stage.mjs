import { targetDir, verifyWebRuntime } from "./web-runtime-contract.mjs";

const { stats, directorFiles, packages } = verifyWebRuntime();
console.log(
  `Verified ${targetDir}: ${packages} runtime packages, ${directorFiles} director files, ` +
    `${stats.links} links, ${(stats.bytes / 1024 / 1024).toFixed(1)} MiB`,
);
