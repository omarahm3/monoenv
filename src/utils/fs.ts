import fs from "fs";
import yaml from "yaml";
import {
  ExtYaml,
  ProjectFile,
  ProjectMap,
  WriteEnvFileOptions,
} from "../types";
import { resolve } from "path";

const DEFAULT_PROJECT_FILE = ".monoenv";

export function loadProjectFile(path: string): ProjectMap {
  const variablesFile = fs.readFileSync(path, "utf-8");
  const parsed = yaml.parseDocument(variablesFile).toJSON();
  return validateProjectFile(parsed, path);
}

function invalidConfig(path: string, message: string): never {
  console.error(`[ ${path} ] is not a valid monoenv config: ${message}`);
  process.exit(1);
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function validateProjectFile(raw: unknown, path: string): ProjectMap {
  if (!isPlainObject(raw)) {
    invalidConfig(path, "expected a YAML mapping at the root");
  }

  for (const key of ["shared", "overwrite"] as const) {
    if (raw[key] !== undefined && typeof raw[key] !== "boolean") {
      invalidConfig(path, `"${key}" must be a boolean`);
    }
  }

  for (const key of ["output", "prefix", "postfix"] as const) {
    if (raw[key] !== undefined && typeof raw[key] !== "string") {
      invalidConfig(path, `"${key}" must be a string`);
    }
  }

  if (!isPlainObject(raw.apps)) {
    invalidConfig(
      path,
      '"apps" is required and must map each app name to a list of "KEY=value" strings'
    );
  }

  for (const [app, variables] of Object.entries(raw.apps)) {
    if (variables == null) {
      continue;
    }

    if (
      !Array.isArray(variables) ||
      variables.some((entry) => typeof entry !== "string")
    ) {
      invalidConfig(path, `app "${app}" must be a list of "KEY=value" strings`);
    }
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
