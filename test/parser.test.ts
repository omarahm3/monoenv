import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  createProjectMap,
  prepareMultipleEnvFiles,
  prepareSingleEnvFile,
} from "../src/utils/parser";
import type { ProjectMap, VariablesMap } from "../src/types";

const project = (apps: ProjectMap["apps"]): ProjectMap => ({ apps });

const vars = (entries: Record<string, Record<string, string>>): VariablesMap => {
  const map: VariablesMap = new Map();
  for (const [app, values] of Object.entries(entries)) {
    map.set(app, new Map(Object.entries(values)));
  }
  return map;
};

describe("createProjectMap", () => {
  it("parses KEY=value entries into a per-app map", () => {
    const map = createProjectMap(
      project({
        api: ['NODE_ENV="production"', "PORT=3000"],
        web: ["VITE_API_URL=localhost:5000"],
      })
    );

    assert.deepEqual([...map.keys()], ["api", "web"]);
    assert.equal(map.get("api")!.get("NODE_ENV"), "production");
    assert.equal(map.get("api")!.get("PORT"), "3000");
    assert.equal(map.get("web")!.get("VITE_API_URL"), "localhost:5000");
  });

  it("skips apps whose value is not an array", () => {
    const map = createProjectMap(project({ broken: null as unknown as string[] }));
    assert.equal(map.has("broken"), false);
  });

  it("skips apps with an empty variable list", () => {
    const map = createProjectMap(project({ empty: [] }));
    assert.equal(map.has("empty"), false);
  });

  it("ignores entries without an '=' separator", () => {
    const map = createProjectMap(project({ api: ["NOT_A_PAIR", "OK=1"] }));
    assert.deepEqual([...map.get("api")!.entries()], [["OK", "1"]]);
  });
});

describe("createProjectMap (map form)", () => {
  it("reads variables from a native YAML map", () => {
    const map = createProjectMap(
      project({ api: { NODE_ENV: "production", HOST: "0.0.0.0" } })
    );
    assert.equal(map.get("api")!.get("NODE_ENV"), "production");
    assert.equal(map.get("api")!.get("HOST"), "0.0.0.0");
  });

  it("coerces number, boolean, and null scalars to strings", () => {
    const map = createProjectMap(
      project({ api: { PORT: 3000, DEBUG: true, EMPTY: null } })
    );
    assert.equal(map.get("api")!.get("PORT"), "3000");
    assert.equal(map.get("api")!.get("DEBUG"), "true");
    assert.equal(map.get("api")!.get("EMPTY"), "");
  });

  it("skips apps with an empty map", () => {
    const map = createProjectMap(project({ empty: {} }));
    assert.equal(map.has("empty"), false);
  });

  it("skips apps whose value is null", () => {
    const map = createProjectMap(project({ broken: null as unknown as string[] }));
    assert.equal(map.has("broken"), false);
  });

  it("supports list and map forms in the same config", () => {
    const map = createProjectMap(
      project({ api: { PORT: 3000 }, worker: ['LOG_LEVEL="info"'] })
    );
    assert.equal(map.get("api")!.get("PORT"), "3000");
    assert.equal(map.get("worker")!.get("LOG_LEVEL"), "info");
  });
});

describe("prepareMultipleEnvFiles", () => {
  it("serializes plain values with double quotes", () => {
    const files = prepareMultipleEnvFiles({
      project: project({}),
      variables: vars({ api: { FOO: "bar" } }),
    });
    assert.equal(files.get("api"), 'FOO="bar"\n');
  });

  it("uses single quotes when the value contains only double quotes", () => {
    const files = prepareMultipleEnvFiles({
      project: project({}),
      variables: vars({ api: { JSON: '{"a":1}' } }),
    });
    assert.equal(files.get("api"), `JSON='{"a":1}'\n`);
  });

  it("escapes double quotes when the value also has a single quote", () => {
    const files = prepareMultipleEnvFiles({
      project: project({}),
      variables: vars({ api: { MIX: `a"b'c` } }),
    });
    assert.equal(files.get("api"), `MIX="a\\"b'c"\n`);
  });

  it("escapes newlines and carriage returns", () => {
    const files = prepareMultipleEnvFiles({
      project: project({}),
      variables: vars({ api: { MULTI: "a\nb\rc" } }),
    });
    assert.equal(files.get("api"), 'MULTI="a\\nb\\rc"\n');
  });

  it("produces one entry per app", () => {
    const files = prepareMultipleEnvFiles({
      project: project({}),
      variables: vars({ api: { A: "1" }, web: { B: "2" } }),
    });
    assert.deepEqual([...files.keys()], ["api", "web"]);
    assert.equal(files.get("web"), 'B="2"\n');
  });
});

describe("prepareSingleEnvFile", () => {
  it("dedups identical keys silently, keeping the first", (t) => {
    const warn = t.mock.method(console, "warn", () => {});
    const out = prepareSingleEnvFile({
      project: project({}),
      variables: vars({
        api: { NODE_ENV: "production" },
        web: { NODE_ENV: "production" },
      }),
    });

    assert.equal(out, 'NODE_ENV="production"\n');
    assert.equal(warn.mock.calls.length, 0);
  });

  it("warns when the same key has conflicting values", (t) => {
    const warn = t.mock.method(console, "warn", () => {});
    const out = prepareSingleEnvFile({
      project: project({}),
      variables: vars({
        api: { NODE_ENV: "production" },
        web: { NODE_ENV: "development" },
      }),
    });

    assert.equal(out, 'NODE_ENV="production"\n');
    assert.equal(warn.mock.calls.length, 1);
    const message = String(warn.mock.calls[0].arguments[0]);
    assert.match(message, /NODE_ENV/);
    assert.match(message, /web/);
  });

  it("combines distinct keys across apps", () => {
    const out = prepareSingleEnvFile({
      project: project({}),
      variables: vars({ api: { A: "1" }, web: { B: "2" } }),
    });
    assert.equal(out, 'A="1"\nB="2"\n');
  });
});
