import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  fileExists,
  getProjectFile,
  loadProjectFile,
  writeEnvFile,
} from "../src/utils/fs";
import { createSandbox, ExitError } from "./helpers";

function expectExit(t: any) {
  const exit = t.mock.method(process, "exit", (code?: number) => {
    throw new ExitError(code);
  });
  t.mock.method(console, "error", () => {});
  return exit;
}

describe("loadProjectFile", () => {
  it("loads and returns a well-formed config", (t) => {
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
          '    - FOO="bar"',
          "  empty:",
        ].join("\n")
      );

      const config = loadProjectFile(path);
      assert.equal(config.shared, true);
      assert.equal(config.output, ".env");
      assert.deepEqual(config.apps.api, ['FOO="bar"']);
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
      const path = box.file("cfg.yaml", "shared: yep\napps:\n  api:\n    - A=1\n");
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
        "shared: true\noverwrite: 5\napps:\n  api:\n    - A=1\n"
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
      const path = box.file("cfg.yaml", "output: 5\napps:\n  api:\n    - A=1\n");
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

  it("allows an app defined with no variables", (t) => {
    const box = createSandbox();
    try {
      const path = box.file("cfg.yaml", "apps:\n  api:\n");
      const config = loadProjectFile(path);
      assert.equal(config.apps.api, null);
    } finally {
      box.restore();
    }
  });

  it("rejects an app whose value is not a list", (t) => {
    const box = createSandbox();
    try {
      expectExit(t);
      const path = box.file("cfg.yaml", 'apps:\n  api: "string"\n');
      assert.throws(() => loadProjectFile(path), ExitError);
    } finally {
      box.restore();
    }
  });

  it("rejects an app whose list contains non-strings", (t) => {
    const box = createSandbox();
    try {
      expectExit(t);
      const path = box.file("cfg.yaml", "apps:\n  api:\n    - 1\n");
      assert.throws(() => loadProjectFile(path), ExitError);
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
