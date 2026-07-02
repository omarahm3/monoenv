import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
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

  it("expands ${VAR} references when expand is enabled", () => {
    const box = createSandbox();
    try {
      const path = box.file(
        "cfg.yaml",
        [
          "shared: false",
          "overwrite: true",
          "expand: true",
          "apps:",
          "  api:",
          "    HOST: localhost",
          "    PORT: 3000",
          "    BASE_URL: http://${HOST}:${PORT}",
        ].join("\n")
      );

      processProjectFile(path);

      assert.match(
        readFileSync(box.dir + "/api", "utf-8"),
        /BASE_URL="http:\/\/localhost:3000"/
      );
    } finally {
      box.restore();
    }
  });

  it("leaves ${VAR} references literal when expand is not enabled", () => {
    const box = createSandbox();
    try {
      const path = box.file(
        "cfg.yaml",
        [
          "shared: false",
          "overwrite: true",
          "apps:",
          "  api:",
          "    HOST: localhost",
          "    BASE_URL: http://${HOST}",
        ].join("\n")
      );

      processProjectFile(path);

      assert.match(
        readFileSync(box.dir + "/api", "utf-8"),
        /BASE_URL="http:\/\/\$\{HOST\}"/
      );
    } finally {
      box.restore();
    }
  });

  it("renders a map-form config and round-trips tricky values", () => {
    const box = createSandbox();
    try {
      const path = box.file(
        "cfg.yaml",
        [
          "shared: true",
          "overwrite: true",
          "apps:",
          "  api:",
          "    NODE_ENV: production",
          "    PORT: 3000",
          '    DATABASE_URL: postgres://u:p@host/db?opt="x"',
        ].join("\n")
      );

      processProjectFile(path);

      const env = readFileSync(box.dir + "/.env", "utf-8");
      assert.equal(
        env,
        [
          'NODE_ENV="production"',
          'PORT="3000"',
          `DATABASE_URL='postgres://u:p@host/db?opt="x"'`,
          "",
        ].join("\n")
      );
    } finally {
      box.restore();
    }
  });

  it("layers a base config with a per-env override via extends", () => {
    const box = createSandbox();
    try {
      box.file(
        "base.yaml",
        [
          "shared: true",
          "overwrite: true",
          "apps:",
          "  api:",
          "    NODE_ENV: development",
          "    PORT: 3000",
          "    HOST: localhost",
        ].join("\n")
      );
      const path = box.file(
        "prod.yaml",
        [
          "extends: base.yaml",
          "apps:",
          "  api:",
          "    NODE_ENV: production",
          "    PORT: 8080",
        ].join("\n")
      );

      processProjectFile(path);

      const env = readFileSync(box.dir + "/.env", "utf-8");
      assert.match(env, /NODE_ENV="production"/); // overridden
      assert.match(env, /PORT="8080"/); // overridden
      assert.match(env, /HOST="localhost"/); // inherited from base
    } finally {
      box.restore();
    }
  });

  it("resolves extends relative to the extending file and expands across layers", () => {
    const box = createSandbox();
    try {
      mkdirSync(box.dir + "/config");
      writeFileSync(
        box.dir + "/config/base.yaml",
        "shared: true\noverwrite: true\nexpand: true\napps:\n  api:\n    HOST: localhost\n",
        "utf-8"
      );
      const path = box.file(
        "config/app.yaml",
        [
          "extends: base.yaml",
          "apps:",
          "  api:",
          "    URL: http://${HOST}:3000",
        ].join("\n")
      );

      processProjectFile(path);

      assert.match(
        readFileSync(box.dir + "/.env", "utf-8"),
        /URL="http:\/\/localhost:3000"/
      );
    } finally {
      box.restore();
    }
  });
});
