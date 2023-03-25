export type ExtYaml = "yaml" | "yml";
export type VariablesMap = Map<string, Map<string, string>>;

export interface ProjectFile {
  path: string;
  extension: ExtYaml;
}

export interface ProjectMap {
  shared?: boolean;
  overwrite?: boolean;
  output?: string;
  prefix?: string;
  postfix?: string;

  apps: {
    [key: string]: string[];
  };
}

export interface EnvFileOptions {
  project: ProjectMap;
  variables: Map<string, Map<string, string>>;
}

export interface WriteEnvFileOptions {
  path: string;
  overwrite?: boolean;
  content: string;
}
