import { ProjectMap, VariablesMap } from "./types";
import { loadConfigChain, writeEnvFile } from "./utils/fs";
import {
  createProjectMap,
  expandVariables,
  mergeVariables,
  prepareMultipleEnvFiles,
  prepareSingleEnvFile,
} from "./utils/parser";

const OPTION_KEYS = [
  "shared",
  "overwrite",
  "expand",
  "output",
  "prefix",
  "postfix",
] as const;

function mergeOptions(layers: ProjectMap[]): ProjectMap {
  const merged: ProjectMap = { apps: {} };
  const target = merged as Record<string, unknown>;

  for (const layer of layers) {
    for (const key of OPTION_KEYS) {
      if (layer[key] !== undefined) {
        target[key] = layer[key];
      }
    }
  }

  return merged;
}

function processShared(project: ProjectMap, variables: VariablesMap) {
  const content = prepareSingleEnvFile({
    project,
    variables,
  });

  writeEnvFile({
    path: project.output || ".env",
    overwrite: project.overwrite,
    content,
  });
}

function processMultiple(project: ProjectMap, variables: VariablesMap) {
  const files = prepareMultipleEnvFiles({
    project,
    variables,
  });

  for (const [app, content] of files) {
    writeEnvFile({
      path: `${project.prefix || ""}${app}${project.postfix || ""}`,
      overwrite: project.overwrite,
      content,
    });
  }
}

export function processProjectFile(projectPath: string) {
  const layers = loadConfigChain(projectPath);
  const project = mergeOptions(layers);
  const merged = mergeVariables(layers.map((layer) => createProjectMap(layer)));
  const variables = project.expand ? expandVariables(merged) : merged;

  if (project.shared) {
    return processShared(project, variables);
  }

  processMultiple(project, variables);
}
