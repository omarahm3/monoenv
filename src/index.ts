import { processProjectFile } from "./processor";
import { fileExists, getProjectFile } from "./utils/fs";

export function loadEnv() {
  const projectFile = getProjectFile();

  if (!projectFile) {
    return;
  }

  processProjectFile(projectFile.path);
}

export function loadEnvFromConfigFile(projectPath: string | undefined) {
  const path = projectPath || getProjectFile()?.path;

  if (!path) {
    console.error(
      "either have a '.monoenv.yaml' file on your root directory or supply your monoenv config file with [ --config | -c ] argument"
    );
    process.exit(1);
  }

  if (!fileExists(path)) {
    console.error(`[ ${path} ] does not exist`);
    process.exit(1);
  }

  processProjectFile(path);
}
