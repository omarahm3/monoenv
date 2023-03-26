import { processProjectFile } from "./processor";
import { fileExists, getProjectFile } from "./utils/fs";

export function loadEnv() {
  const projectFile = getProjectFile();

  if (!projectFile) {
    return;
  }

  processProjectFile(projectFile.path);
}

export function loadEnvFromConfigFile(projectPath: string) {
  if (!fileExists(projectPath)) {
    console.error(`[ ${projectPath} ] does not exist`);
    process.exit(1);
  }

  processProjectFile(projectPath);
}
