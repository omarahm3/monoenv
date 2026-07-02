import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  fileExists,
  getProjectFile,
  loadConfigChain,
  loadProjectFile,
  writeEnvFile,
} from "../src/utils/fs.ts";
import { createSandbox, ExitError } from "./helpers.ts";

function expectExit(t: any) {
  const exit = t.mock.method(process, "exit", (code?: number) => {
    throw new ExitError(code);
  });
  t.mock.method(console, "error", () => {});
  return exit;
}

describe("loadProjectFile", () => {
  it("loads and returns a well-formed config", () => {
    const box = createSandbox();
    try {
      const path = box.file(
        "cfg.yaml",
        [
          "shared: true",
          "overwrite: false",
          "output: '.env'",
          "prefix: '.'",
          "postfix: '.env'",
          "apps:",
          "  api:",
          "    FOO: bar",
          "  empty:",
        ].join("\n")
      );

      const config = loadProjectFile(path);
      assert.equal(config.shared, true);
      assert.equal(config.output, ".env");
      assert.deepEqual(config.apps!.api, { FOO: "bar" });
    } finally {
      box.restore();
    }
  });

  it("rejects a non-mapping root", (t) => {
    const box = createSandbox();
    try {
      const exit = expectExit(t);
      const path = box.file("cfg.yaml", "42\n");
      assert.throws(() => loadProjectFile(path), ExitError);
      assert.equal(exit.mock.calls[0].arguments[0], 1);
    } finally {
      box.restore();
    }
  });

  it("rejects an empty (null) root", (t) => {
    const box = createSandbox();
    try {
      expectExit(t);
      const path = box.file("cfg.yaml", "");
      assert.throws(() => loadProjectFile(path), ExitError);
    } finally {
      box.restore();
    }
  });

  it("rejects an 'apps' value that is a list", (t) => {
    const box = createSandbox();
    try {
      expectExit(t);
      const path = box.file("cfg.yaml", "apps:\n  - 1\n");
      assert.throws(() => loadProjectFile(path), ExitError);
    } finally {
      box.restore();
    }
  });

  it("rejects a non-boolean 'shared'", (t) => {
    const box = createSandbox();
    try {
      expectExit(t);
      const path = box.file("cfg.yaml", "shared: yep\napps:\n  api:\n    A: 1\n");
      assert.throws(() => loadProjectFile(path), ExitError);
    } finally {
      box.restore();
    }
  });

  it("rejects a non-boolean 'overwrite'", (t) => {
    const box = createSandbox();
    try {
      expectExit(t);
      const path = box.file(
        "cfg.yaml",
        "shared: true\noverwrite: 5\napps:\n  api:\n    A: 1\n"
      );
      assert.throws(() => loadProjectFile(path), ExitError);
    } finally {
      box.restore();
    }
  });

  it("rejects a non-string 'output'", (t) => {
    const box = createSandbox();
    try {
      expectExit(t);
      const path = box.file("cfg.yaml", "output: 5\napps:\n  api:\n    A: 1\n");
      assert.throws(() => loadProjectFile(path), ExitError);
    } finally {
      box.restore();
    }
  });

  it("rejects a missing 'apps' mapping", (t) => {
    const box = createSandbox();
    try {
      expectExit(t);
      const path = box.file("cfg.yaml", "shared: true\n");
      assert.throws(() => loadProjectFile(path), ExitError);
    } finally {
      box.restore();
    }
  });

  it("rejects an 'apps' value that is not a mapping", (t) => {
    const box = createSandbox();
    try {
      expectExit(t);
      const path = box.file("cfg.yaml", "apps: nope\n");
      assert.throws(() => loadProjectFile(path), ExitError);
    } finally {
      box.restore();
    }
  });

  it("allows an app defined with no variables", () => {
    const box = createSandbox();
    try {
      const path = box.file("cfg.yaml", "apps:\n  api:\n");
      const config = loadProjectFile(path);
      assert.equal(config.apps!.api, null);
    } finally {
      box.restore();
    }
  });

  it("rejects an app defined as a scalar", (t) => {
    const box = createSandbox();
    try {
      expectExit(t);
      const path = box.file("cfg.yaml", 'apps:\n  api: "string"\n');
      assert.throws(() => loadProjectFile(path), ExitError);
    } finally {
      box.restore();
    }
  });

  it("rejects an app defined as a list", (t) => {
    const box = createSandbox();
    try {
      expectExit(t);
      const path = box.file("cfg.yaml", "apps:\n  api:\n    - A=1\n");
      assert.throws(() => loadProjectFile(path), ExitError);
    } finally {
      box.restore();
    }
  });

  it("accepts an app defined as a scalar map", () => {
    const box = createSandbox();
    try {
      const path = box.file(
        "cfg.yaml",
        "apps:\n  api:\n    NODE_ENV: production\n    PORT: 3000\n    DEBUG: true\n"
      );
      const config = loadProjectFile(path);
      assert.deepEqual(config.apps!.api, {
        NODE_ENV: "production",
        PORT: 3000,
        DEBUG: true,
      });
    } finally {
      box.restore();
    }
  });

  it("rejects a map variable whose value is not a scalar", (t) => {
    const box = createSandbox();
    try {
      expectExit(t);
      const path = box.file(
        "cfg.yaml",
        "apps:\n  api:\n    NESTED:\n      - 1\n"
      );
      assert.throws(() => loadProjectFile(path), ExitError);
    } finally {
      box.restore();
    }
  });

  it("accepts a config that extends another and omits apps", () => {
    const box = createSandbox();
    try {
      const path = box.file("cfg.yaml", "extends: base.yaml\noutput: '.env'\n");
      const config = loadProjectFile(path);
      assert.equal(config.extends, "base.yaml");
      assert.equal(config.apps, undefined);
    } finally {
      box.restore();
    }
  });

  it("rejects an extends value that is not a string or list", (t) => {
    const box = createSandbox();
    try {
      expectExit(t);
      const path = box.file("cfg.yaml", "extends: 5\napps:\n  api:\n    A: 1\n");
      assert.throws(() => loadProjectFile(path), ExitError);
    } finally {
      box.restore();
    }
  });

  it("rejects an extends list containing non-strings", (t) => {
    const box = createSandbox();
    try {
      expectExit(t);
      const path = box.file("cfg.yaml", "extends:\n  - 1\napps:\n  api:\n    A: 1\n");
      assert.throws(() => loadProjectFile(path), ExitError);
    } finally {
      box.restore();
    }
  });
});

describe("loadConfigChain", () => {
  it("returns the chain in base-to-leaf order", () => {
    const box = createSandbox();
    try {
      box.file("base.yaml", "shared: true\napps:\n  api:\n    A: 1\n");
      box.file("prod.yaml", "extends: base.yaml\napps:\n  api:\n    A: 2\n");
      const chain = loadConfigChain("prod.yaml");
      assert.equal(chain.length, 2);
      assert.equal(chain[0].shared, true);
      assert.equal(chain[1].extends, "base.yaml");
    } finally {
      box.restore();
    }
  });

  it("resolves an array of bases left to right before the leaf", () => {
    const box = createSandbox();
    try {
      box.file("a.yaml", "apps:\n  api:\n    A: 1\n");
      box.file("b.yaml", "apps:\n  api:\n    B: 2\n");
      box.file("leaf.yaml", "extends:\n  - a.yaml\n  - b.yaml\napps:\n  api:\n    C: 3\n");
      const chain = loadConfigChain("leaf.yaml");
      assert.deepEqual(
        chain.map((c) => Object.keys(c.apps!.api as Record<string, unknown>)[0]),
        ["A", "B", "C"]
      );
    } finally {
      box.restore();
    }
  });

  it("exits on a circular extends reference", (t) => {
    const box = createSandbox();
    try {
      expectExit(t);
      box.file("a.yaml", "extends: b.yaml\napps:\n  api:\n    A: 1\n");
      box.file("b.yaml", "extends: a.yaml\napps:\n  api:\n    B: 2\n");
      assert.throws(() => loadConfigChain("a.yaml"), ExitError);
    } finally {
      box.restore();
    }
  });

  it("exits when a referenced base file is missing", (t) => {
    const box = createSandbox();
    try {
      expectExit(t);
      box.file("leaf.yaml", "extends: missing.yaml\napps:\n  api:\n    A: 1\n");
      assert.throws(() => loadConfigChain("leaf.yaml"), ExitError);
    } finally {
      box.restore();
    }
  });
});

describe("fileExists", () => {
  it("reflects whether a path exists", () => {
    const box = createSandbox();
    try {
      const path = box.file("present.txt", "x");
      assert.equal(fileExists(path), true);
      assert.equal(fileExists(box.dir + "/missing.txt"), false);
    } finally {
      box.restore();
    }
  });
});

describe("getProjectFile", () => {
  it("finds .monoenv.yaml first", () => {
    const box = createSandbox();
    try {
      box.file(".monoenv.yaml", "apps: {}\n");
      const found = getProjectFile();
      assert.ok(found);
      assert.equal(found!.extension, "yaml");
      assert.match(found!.path, /\.monoenv\.yaml$/);
    } finally {
      box.restore();
    }
  });

  it("falls back to .monoenv.yml", () => {
    const box = createSandbox();
    try {
      box.file(".monoenv.yml", "apps: {}\n");
      const found = getProjectFile();
      assert.ok(found);
      assert.equal(found!.extension, "yml");
    } finally {
      box.restore();
    }
  });

  it("returns null when no config file is present", () => {
    const box = createSandbox();
    try {
      assert.equal(getProjectFile(), null);
    } finally {
      box.restore();
    }
  });
});

describe("writeEnvFile", () => {
  it("writes content to a new file", () => {
    const box = createSandbox();
    try {
      writeEnvFile({ path: "out.env", content: "A=1\n" });
      assert.equal(readFileSync(box.dir + "/out.env", "utf-8"), "A=1\n");
    } finally {
      box.restore();
    }
  });

  it("overwrites an existing file when overwrite is true", () => {
    const box = createSandbox();
    try {
      box.file("out.env", "OLD\n");
      writeEnvFile({ path: "out.env", overwrite: true, content: "NEW\n" });
      assert.equal(readFileSync(box.dir + "/out.env", "utf-8"), "NEW\n");
    } finally {
      box.restore();
    }
  });

  it("skips and logs when the file exists and overwrite is false", (t) => {
    const box = createSandbox();
    try {
      const log = t.mock.method(console, "log", () => {});
      box.file("out.env", "OLD\n");
      writeEnvFile({ path: "out.env", overwrite: false, content: "NEW\n" });
      assert.equal(readFileSync(box.dir + "/out.env", "utf-8"), "OLD\n");
      assert.equal(log.mock.calls.length, 1);
    } finally {
      box.restore();
    }
  });
});
