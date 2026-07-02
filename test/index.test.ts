import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import monoenv, { loadEnv, loadEnvFromConfigFile } from "../src/index.ts";
import { createSandbox, ExitError } from "./helpers.ts";

function expectExit(t: any) {
  const exit = t.mock.method(process, "exit", (code?: number) => {
    throw new ExitError(code);
  });
  t.mock.method(console, "error", () => {});
  return exit;
}

describe("default export", () => {
  it("bundles the public helpers", () => {
    assert.equal(monoenv.loadEnv, loadEnv);
    assert.equal(monoenv.loadEnvFromConfigFile, loadEnvFromConfigFile);
  });
});

describe("loadEnv", () => {
  it("does nothing when no default config file exists", () => {
    const box = createSandbox();
    try {
      loadEnv();
      assert.equal(existsSync(box.dir + "/.env"), false);
    } finally {
      box.restore();
    }
  });

  it("processes the default .monoenv.yaml when present", () => {
    const box = createSandbox();
    try {
      box.file(
        ".monoenv.yaml",
        "shared: true\noverwrite: true\napps:\n  api:\n    A: 1\n"
      );
      loadEnv();
      assert.equal(readFileSync(box.dir + "/.env", "utf-8"), 'A="1"\n');
    } finally {
      box.restore();
    }
  });
});

describe("loadEnvFromConfigFile", () => {
  it("processes an explicitly provided config path", () => {
    const box = createSandbox();
    try {
      box.file(
        "custom.yaml",
        "shared: true\noverwrite: true\napps:\n  api:\n    A: 1\n"
      );
      loadEnvFromConfigFile("custom.yaml");
      assert.equal(readFileSync(box.dir + "/.env", "utf-8"), 'A="1"\n');
    } finally {
      box.restore();
    }
  });

  it("falls back to the default config when no path is given", () => {
    const box = createSandbox();
    try {
      box.file(
        ".monoenv.yaml",
        "shared: true\noverwrite: true\napps:\n  api:\n    A: 1\n"
      );
      loadEnvFromConfigFile(undefined);
      assert.equal(readFileSync(box.dir + "/.env", "utf-8"), 'A="1"\n');
    } finally {
      box.restore();
    }
  });

  it("exits when no path is given and no default config exists", (t) => {
    const box = createSandbox();
    try {
      const exit = expectExit(t);
      assert.throws(() => loadEnvFromConfigFile(undefined), ExitError);
      assert.equal(exit.mock.calls[0].arguments[0], 1);
    } finally {
      box.restore();
    }
  });

  it("exits when the provided config path does not exist", (t) => {
    const box = createSandbox();
    try {
      const exit = expectExit(t);
      assert.throws(() => loadEnvFromConfigFile("missing.yaml"), ExitError);
      assert.equal(exit.mock.calls[0].arguments[0], 1);
    } finally {
      box.restore();
    }
  });
});
