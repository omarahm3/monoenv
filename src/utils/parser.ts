import { parse } from "dotenv";
import {
  AppVariables,
  EnvFileOptions,
  ProjectMap,
  Scalar,
  VariablesMap,
} from "../types/index.js";

const REFERENCE = /(\\*)\$\{([^}]+)\}/g;

function resolveReference(
  expression: string,
  scope: Map<string, string>,
  resolving: Set<string>
): string {
  const separator = expression.indexOf(":-");
  const name = (separator >= 0 ? expression.slice(0, separator) : expression).trim();
  const fallback = separator >= 0 ? expression.slice(separator + 2) : undefined;

  if (scope.has(name) && !resolving.has(name)) {
    resolving.add(name);
    const expanded = expandValue(scope.get(name)!, scope, resolving);
    resolving.delete(name);
    return expanded;
  }

  const fromEnv = process.env[name];
  if (fromEnv !== undefined) {
    return fromEnv;
  }

  return fallback ?? "";
}

function expandValue(
  raw: string,
  scope: Map<string, string>,
  resolving: Set<string>
): string {
  return raw.replace(REFERENCE, (_match, slashes: string, expression: string) => {
    const prefix = "\\".repeat(Math.floor(slashes.length / 2));

    if (slashes.length % 2 === 1) {
      return `${prefix}\${${expression}}`;
    }

    return prefix + resolveReference(expression, scope, resolving);
  });
}

export function expandVariables(variables: VariablesMap): VariablesMap {
  const expanded: VariablesMap = new Map();

  for (const [app, scope] of variables) {
    const resolved = new Map<string, string>();

    for (const [key, value] of scope) {
      resolved.set(key, expandValue(value, scope, new Set([key])));
    }

    expanded.set(app, resolved);
  }

  return expanded;
}

function parseVariables(variables: string[]) {
  const parsed = parse(variables.join("\n"));
  return new Map<string, string>(Object.entries(parsed));
}

function mapVariables(variables: Record<string, Scalar>) {
  const result = new Map<string, string>();

  for (const [key, value] of Object.entries(variables)) {
    result.set(key, value == null ? "" : String(value));
  }

  return result;
}

function serialize(key: string, value: string) {
  if (value.includes('"') && !value.includes("'")) {
    return `${key}='${value}'\n`;
  }

  const escaped = value
    .replaceAll("\n", "\\n")
    .replaceAll("\r", "\\r")
    .replaceAll('"', '\\"');

  return `${key}="${escaped}"\n`;
}

export function createProjectMap(raw: ProjectMap) {
  const map = new Map<string, Map<string, string>>();
  const apps = raw.apps ?? {};

  for (const app in apps) {
    const variables: AppVariables = apps[app];

    if (Array.isArray(variables)) {
      if (variables.length) {
        map.set(app, parseVariables(variables));
      }
      continue;
    }

    if (variables && Object.keys(variables).length) {
      map.set(app, mapVariables(variables));
    }
  }

  return map;
}

export function mergeVariables(layers: VariablesMap[]): VariablesMap {
  const merged: VariablesMap = new Map();

  for (const layer of layers) {
    for (const [app, variables] of layer) {
      const target = merged.get(app) ?? new Map<string, string>();

      for (const [key, value] of variables) {
        target.set(key, value);
      }

      merged.set(app, target);
    }
  }

  return merged;
}

export function prepareSingleEnvFile(opts: EnvFileOptions) {
  const seen = new Map<string, string>();
  let content = "";

  for (const [app, variables] of opts.variables) {
    for (const [key, value] of variables) {
      const existing = seen.get(key);

      if (existing !== undefined) {
        if (existing !== value) {
          console.warn(
            `[ ${key} ] is defined multiple times with different values, keeping the first one and ignoring the value from [ ${app} ]`
          );
        }
        continue;
      }

      content += serialize(key, value);
      seen.set(key, value);
    }
  }

  return content;
}

export function prepareMultipleEnvFiles(opts: EnvFileOptions) {
  const files = new Map<string, string>();

  for (const [app, variables] of opts.variables) {
    let content = "";
    for (const [key, value] of variables) {
      content += serialize(key, value);
    }
    files.set(app, content);
  }

  return files;
}
