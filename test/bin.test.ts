import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createSandbox } from "./helpers.ts";

let runId = 0;

async function runBin(argv: string[]) {
  const original = process.argv;
  process.argv = ["node", "run.ts", ...argv];
  try {
    // A unique query busts the ESM module cache so the bin re-executes.
    await import(`../src/bin/run.ts?run=${runId++}`);
  } finally {
    process.argv = original;
  }
}

const CONFIG = "shared: true\noverwrite: true\napps:\n  api:\n    A: 1\n";

describe("bin/run", () => {
  it("processes the config passed via -c", async () => {
    const box = createSandbox();
    try {
      box.file("cfg.yaml", CONFIG);
      await runBin(["-c", "cfg.yaml"]);
      assert.equal(readFileSync(box.dir + "/.env", "utf-8"), 'A="1"\n');
    } finally {
      box.restore();
    }
  });

  it("processes the config passed via --config", async () => {
    const box = createSandbox();
    try {
      box.file("cfg.yaml", CONFIG);
      await runBin(["--config", "cfg.yaml"]);
      assert.equal(readFileSync(box.dir + "/.env", "utf-8"), 'A="1"\n');
    } finally {
      box.restore();
    }
  });

  it("falls back to the default config when no flag is passed", async () => {
    const box = createSandbox();
    try {
      box.file(".monoenv.yaml", CONFIG);
      await runBin([]);
      assert.equal(readFileSync(box.dir + "/.env", "utf-8"), 'A="1"\n');
    } finally {
      box.restore();
    }
  });
});
