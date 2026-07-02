import fs from "fs";
import yaml from "yaml";
import {
  ExtYaml,
  ProjectFile,
  ProjectMap,
  WriteEnvFileOptions,
} from "../types/index.js";
import { dirname, resolve } from "path";

const DEFAULT_PROJECT_FILE = ".monoenv";

export function loadProjectFile(path: string): ProjectMap {
  const variablesFile = fs.readFileSync(path, "utf-8");
  const parsed = yaml.parseDocument(variablesFile).toJSON();
  return validateProjectFile(parsed, path);
}

export function loadConfigChain(path: string): ProjectMap[] {
  return resolveChain(resolvePath(path), []);
}

function normalizeExtends(value: string | string[] | undefined): string[] {
  if (value === undefined) {
    return [];
  }

  return Array.isArray(value) ? value : [value];
}

function resolveChain(absPath: string, ancestors: string[]): ProjectMap[] {
  if (ancestors.includes(absPath)) {
    invalidConfig(absPath, 'circular "extends" reference');
  }

  if (!fileExists(absPath)) {
    invalidConfig(absPath, "config file not found");
  }

  const config = loadProjectFile(absPath);
  const baseDir = dirname(absPath);
  const chain: ProjectMap[] = [];

  for (const base of normalizeExtends(config.extends)) {
    chain.push(...resolveChain(resolve(baseDir, base), [...ancestors, absPath]));
  }

  chain.push(config);
  return chain;
}

function invalidConfig(path: string, message: string): never {
  console.error(`[ ${path} ] is not a valid monoenv config: ${message}`);
  process.exit(1);
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isScalar(value: unknown): boolean {
  return (
    value === null ||
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  );
}

function validateProjectFile(raw: unknown, path: string): ProjectMap {
  if (!isPlainObject(raw)) {
    invalidConfig(path, "expected a YAML mapping at the root");
  }

  for (const key of ["shared", "overwrite", "expand"] as const) {
    if (raw[key] !== undefined && typeof raw[key] !== "boolean") {
      invalidConfig(path, `"${key}" must be a boolean`);
    }
  }

  for (const key of ["output", "prefix", "postfix"] as const) {
    if (raw[key] !== undefined && typeof raw[key] !== "string") {
      invalidConfig(path, `"${key}" must be a string`);
    }
  }

  if (raw.extends !== undefined) {
    const bases = Array.isArray(raw.extends) ? raw.extends : [raw.extends];
    if (
      (!Array.isArray(raw.extends) && typeof raw.extends !== "string") ||
      bases.some((base) => typeof base !== "string")
    ) {
      invalidConfig(path, '"extends" must be a string or an array of strings');
    }
  }

  if (raw.apps !== undefined) {
    if (!isPlainObject(raw.apps)) {
      invalidConfig(path, '"apps" must map each app name to its variables');
    }

    for (const [app, variables] of Object.entries(raw.apps)) {
      if (variables == null) {
        continue;
      }

      if (Array.isArray(variables)) {
        if (variables.some((entry) => typeof entry !== "string")) {
          invalidConfig(path, `app "${app}" list entries must be "KEY=value" strings`);
        }
        continue;
      }

      if (isPlainObject(variables)) {
        for (const [key, value] of Object.entries(variables)) {
          if (!isScalar(value)) {
            invalidConfig(
              path,
              `app "${app}" variable "${key}" must be a string, number, boolean, or null`
            );
          }
        }
        continue;
      }

      invalidConfig(
        path,
        `app "${app}" must be a list of "KEY=value" strings or a map of variables`
      );
    }
  } else if (raw.extends === undefined) {
    invalidConfig(
      path,
      '"apps" is required unless the config extends another config'
    );
  }

  return raw as unknown as ProjectMap;
}

export function fileExists(path: string) {
  return fs.existsSync(path);
}

export function getProjectFile(): ProjectFile | null {
  const exts = ["yaml", "yml"];

  for (const ext of exts) {
    const path = resolvePath(`${DEFAULT_PROJECT_FILE}.${ext}`);

    if (fileExists(path)) {
      return {
        path,
        extension: ext as ExtYaml,
      };
    }
  }

  return null;
}

export function writeEnvFile(opts: WriteEnvFileOptions) {
  const path = resolvePath(opts.path);
  if (fileExists(path) && !opts.overwrite) {
    console.log(`[ ${path} ] already exists, ignoring...`);
    return;
  }

  fs.writeFileSync(path, opts.content, { encoding: "utf-8" });
}

function resolvePath(path: string) {
  return resolve(process.cwd(), path);
}
