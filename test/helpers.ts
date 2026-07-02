import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

export interface Sandbox {
  dir: string;
  file(name: string, content: string): string;
  restore(): void;
}

export function createSandbox(): Sandbox {
  const dir = mkdtempSync(join(tmpdir(), "monoenv-test-"));
  const previous = process.cwd();
  process.chdir(dir);

  return {
    dir,
    file(name, content) {
      const path = join(dir, name);
      writeFileSync(path, content, "utf-8");
      return path;
    },
    restore() {
      process.chdir(previous);
      rmSync(dir, { recursive: true, force: true });
    },
  };
}

export class ExitError extends Error {
  readonly code?: number;

  constructor(code?: number) {
    super(`process.exit(${code})`);
    this.code = code;
  }
}
