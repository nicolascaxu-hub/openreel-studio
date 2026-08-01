import childProcess from "node:child_process";
import net from "node:net";
import path from "node:path";

import { targetWebDir, verifyWebRuntime } from "./web-runtime-contract.mjs";

const START_TIMEOUT_MS = 60_000;
const POLL_INTERVAL_MS = 250;

function reservePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      server.close((error) => {
        if (error) {
          reject(error);
        } else {
          resolve(address.port);
        }
      });
    });
  });
}

function delay(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function waitForServer(baseUrl, child, output) {
  const deadline = Date.now() + START_TIMEOUT_MS;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) {
      throw new Error(`Staged web server exited early (${child.exitCode}).\n${output.value}`);
    }
    try {
      const response = await fetch(baseUrl, { signal: AbortSignal.timeout(2_000) });
      if (response.ok) {
        await response.arrayBuffer();
        return;
      }
    } catch {
      // The server is still starting.
    }
    await delay(POLL_INTERVAL_MS);
  }
  throw new Error(`Staged web server did not start within ${START_TIMEOUT_MS} ms.\n${output.value}`);
}

async function assertHttpOk(url) {
  const response = await fetch(url, { signal: AbortSignal.timeout(10_000) });
  if (!response.ok) {
    throw new Error(`HTTP smoke failed for ${url}: ${response.status}`);
  }
  const body = await response.arrayBuffer();
  if (body.byteLength === 0) {
    throw new Error(`HTTP smoke returned an empty body for ${url}`);
  }
}

verifyWebRuntime();
const port = await reservePort();
const baseUrl = `http://127.0.0.1:${port}`;
const output = { value: "" };
const child = childProcess.spawn(process.execPath, [path.join(targetWebDir, "server.js")], {
  cwd: targetWebDir,
  env: {
    ...process.env,
    HOSTNAME: "127.0.0.1",
    INTERNAL_API_BASE_URL: "http://127.0.0.1:7860",
    NODE_ENV: "production",
    PORT: String(port),
  },
  stdio: ["ignore", "pipe", "pipe"],
});
for (const stream of [child.stdout, child.stderr]) {
  stream.on("data", (chunk) => {
    output.value = `${output.value}${chunk}`.slice(-16_000);
  });
}

try {
  await waitForServer(baseUrl, child, output);
  await assertHttpOk(`${baseUrl}/`);
  await assertHttpOk(`${baseUrl}/projects/desktop-packaging-smoke`);
  await assertHttpOk(`${baseUrl}/director/mannequins/human-base.glb`);
  console.log(`Staged web runtime HTTP smoke passed at ${baseUrl}`);
} finally {
  if (child.exitCode === null) {
    child.kill("SIGTERM");
    await Promise.race([
      new Promise((resolve) => child.once("exit", resolve)),
      delay(5_000),
    ]);
  }
  if (child.exitCode === null) {
    child.kill("SIGKILL");
  }
}
