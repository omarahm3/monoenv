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

export function loadProjectFile(path: string) {
  const variablesFile = fs.readFileSync(path, "utf-8");
  return yaml.parseDocument(variablesFile).toJSON() as ProjectMap;
}

export function fileExists(path: string) {
  return fs.existsSync(path);
}

export function getProjectFile(): ProjectFile | null {
  const exts = ["yaml", "yml"];

  for (const ext of exts) {
    if (fileExists(resolvePath(`${DEFAULT_PROJECT_FILE}.${ext}`))) {
      return {
        path: `${DEFAULT_PROJECT_FILE}.${ext}`,
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
