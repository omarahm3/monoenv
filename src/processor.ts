import { ProjectMap, VariablesMap } from "./types";
import { loadProjectFile, writeEnvFile } from "./utils/fs";
import {
  createProjectMap,
  prepareMultipleEnvFiles,
  prepareSingleEnvFile,
} from "./utils/parser";

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
  const project = loadProjectFile(projectPath);
  const variables = createProjectMap(project);

  if (project.shared) {
    return processShared(project, variables);
  }

  processMultiple(project, variables);
}
