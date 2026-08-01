import { stageWebRuntime, targetDir } from "./web-runtime-contract.mjs";

const { packages, stats } = stageWebRuntime();
console.log(
  `Staged self-contained Next runtime at ${targetDir} ` +
    `(${packages.length} packages, ${(stats.bytes / 1024 / 1024).toFixed(1)} MiB)`,
);
