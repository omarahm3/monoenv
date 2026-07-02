import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { processProjectFile } from "../src/processor";
import { createSandbox } from "./helpers";

describe("processProjectFile", () => {
  it("writes a single shared file to the default output", () => {
    const box = createSandbox();
    try {
      const path = box.file(
        "cfg.yaml",
        [
          "shared: true",
          "overwrite: true",
          "apps:",
          "  api:",
          '    - NODE_ENV="production"',
          "  web:",
          "    - VITE_API_URL=localhost:5000",
        ].join("\n")
      );

      processProjectFile(path);

      const env = readFileSync(box.dir + "/.env", "utf-8");
      assert.equal(env, 'NODE_ENV="production"\nVITE_API_URL="localhost:5000"\n');
    } finally {
      box.restore();
    }
  });

  it("honors a custom shared output path", () => {
    const box = createSandbox();
    try {
      const path = box.file(
        "cfg.yaml",
        "shared: true\noverwrite: true\noutput: '.shared.env'\napps:\n  api:\n    - A=1\n"
      );

      processProjectFile(path);

      assert.equal(existsSync(box.dir + "/.env"), false);
      assert.equal(readFileSync(box.dir + "/.shared.env", "utf-8"), 'A="1"\n');
    } finally {
      box.restore();
    }
  });

  it("writes one prefixed/postfixed file per app in multiple mode", () => {
    const box = createSandbox();
    try {
      const path = box.file(
        "cfg.yaml",
        [
          "shared: false",
          "overwrite: true",
          "prefix: '.'",
          "postfix: '.env'",
          "apps:",
          "  api:",
          '    - PORT="3000"',
          "  web:",
          "    - VITE_API_URL=localhost:3000",
        ].join("\n")
      );

      processProjectFile(path);

      assert.equal(readFileSync(box.dir + "/.api.env", "utf-8"), 'PORT="3000"\n');
      assert.equal(
        readFileSync(box.dir + "/.web.env", "utf-8"),
        'VITE_API_URL="localhost:3000"\n'
      );
    } finally {
      box.restore();
    }
  });

  it("uses the bare app name when prefix and postfix are omitted", () => {
    const box = createSandbox();
    try {
      const path = box.file(
        "cfg.yaml",
        "shared: false\noverwrite: true\napps:\n  api:\n    - A=1\n"
      );

      processProjectFile(path);

      assert.equal(readFileSync(box.dir + "/api", "utf-8"), 'A="1"\n');
    } finally {
      box.restore();
    }
  });
});
