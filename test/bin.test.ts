import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createSandbox } from "./helpers";

const BIN = "../src/bin/run";

function runBin(argv: string[]) {
  const original = process.argv;
  process.argv = ["node", "run.js", ...argv];
  try {
    delete require.cache[require.resolve(BIN)];
    require(BIN);
  } finally {
    process.argv = original;
  }
}

const CONFIG = "shared: true\noverwrite: true\napps:\n  api:\n    - A=1\n";

describe("bin/run", () => {
  it("processes the config passed via -c", () => {
    const box = createSandbox();
    try {
      box.file("cfg.yaml", CONFIG);
      runBin(["-c", "cfg.yaml"]);
      assert.equal(readFileSync(box.dir + "/.env", "utf-8"), 'A="1"\n');
    } finally {
      box.restore();
    }
  });

  it("processes the config passed via --config", () => {
    const box = createSandbox();
    try {
      box.file("cfg.yaml", CONFIG);
      runBin(["--config", "cfg.yaml"]);
      assert.equal(readFileSync(box.dir + "/.env", "utf-8"), 'A="1"\n');
    } finally {
      box.restore();
    }
  });

  it("falls back to the default config when no flag is passed", () => {
    const box = createSandbox();
    try {
      box.file(".monoenv.yaml", CONFIG);
      runBin([]);
      assert.equal(readFileSync(box.dir + "/.env", "utf-8"), 'A="1"\n');
    } finally {
      box.restore();
    }
  });
});
