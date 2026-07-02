export type ExtYaml = "yaml" | "yml";
export type VariablesMap = Map<string, Map<string, string>>;

export type Scalar = string | number | boolean | null;
export type AppVariables = string[] | Record<string, Scalar>;

export interface ProjectFile {
  path: string;
  extension: ExtYaml;
}

export interface ProjectMap {
  shared?: boolean;
  overwrite?: boolean;
  expand?: boolean;
  output?: string;
  prefix?: string;
  postfix?: string;

  apps: {
    [key: string]: AppVariables;
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
