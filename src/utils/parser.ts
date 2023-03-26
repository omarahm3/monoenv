import { ProjectMap, EnvFileOptions } from "../types";

function parseVaraibles(variables: string[]) {
  const variablesMap = new Map<string, string>();

  for (const variable of variables) {
    const splitted = variable.split("=");

    if (splitted.length < 2) {
      continue;
    }

    const key = splitted.shift();

    if (!key) {
      continue;
    }

    const value = splitted.join("=").replaceAll('"', "");
    variablesMap.set(key, value);
  }

  return variablesMap;
}

export function createProjectMap(raw: ProjectMap) {
  const map = new Map<string, Map<string, string>>();
  const apps = raw.apps;

  for (const app in apps) {
    const variables = apps[app];

    if (!Array.isArray(variables) || !variables.length) {
      continue;
    }

    map.set(app, parseVaraibles(variables));
  }

  return map;
}

export function prepareSingleEnvFile(opts: EnvFileOptions) {
  const keys = new Set<string>();
  let content = "";

  for (const [_, variables] of opts.variables) {
    for (const [key, value] of variables) {
      if (keys.has(key)) {
        continue;
      }

      content += `${key}="${value}"\n`;
      keys.add(key);
    }
  }

  return content;
}

export function prepareMultipleEnvFiles(opts: EnvFileOptions) {
  const files = new Map<string, string>();

  for (const [app, variables] of opts.variables) {
    let content = "";
    for (const [key, value] of variables) {
      content += `${key}="${value}"\n`;
    }
    files.set(app, content);
  }

  return files;
}
