# monoenv

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](./LICENSE)
[![Twitter: omarahm3](https://img.shields.io/twitter/follow/omarahm3.svg?style=social)](https://twitter.com/omarahm3)

> Better handling of multiple applications' dotenv files in monorepos.

monoenv keeps a single source-of-truth YAML file for every environment variable across
all the apps in your monorepo, and generates the `.env` files you actually need from it —
either one combined `.env` (handy for development) or one file per application (handy for
production and Docker builds).

- **Zero runtime `dotenv` dependency.** monoenv only *generates* `.env` files. Load them in
  your apps with [`dotenv`](https://github.com/motdotla/dotenv)/`dotenv-cli` as usual.
- **YAML-native config** with variable interpolation and config layering (`extends`).
- **ESM-only**, modern package — requires **Node.js >= 24**.

## Install

```bash
npm i -D monoenv
```

## Why

Managing `.env` files in a monorepo is painful at deployment time. Tools like
[Turborepo](https://turbo.build/repo/docs/handbook/environment-variables) expect a single
shared `.env` at the root — fine for development, but for production you usually want a
separate, minimal `.env` per service so each Docker image only gets what it needs.

**Before** — one shared `.env` fed to every service:

```yaml
services:
  frontend:
    build:
      args:
        - VITE_API_URL=${VITE_API_URL}
    env_file: ./.env # shared
  server:
    env_file: ./.env # shared
  uploader:
    env_file: ./.env # shared
```

**After** — one `.env` per service, generated from a single YAML config:

```yaml
services:
  frontend:
    env_file: ./.frontend.env
  server:
    env_file: ./.server.env
  uploader:
    env_file: ./.uploader.env
```

You maintain one `.monoenv.yaml` and let monoenv generate the rest.

## Quick start

Create a `.monoenv.yaml` in your repo root. Each app's variables are written as a plain
YAML map, so YAML handles typing, quoting, and escaping for you:

```yaml
shared: true      # combine every app's variables into a single file
overwrite: true   # overwrite the output file if it already exists

apps:
  api:
    NODE_ENV: production
    API_PORT: 3000
    HOST: 0.0.0.0
    LOG_LEVEL: info
    DATABASE_URL: postgres://postgres:postgres@localhost:5432/app
  web:
    NODE_ENV: production
    VITE_API_URL: localhost:3000
```

Run monoenv (typically before your dev/build script) in `package.json`:

```json
{
  "scripts": {
    "dev": "monoenv && dotenv -- turbo run dev --parallel"
  }
}
```

Because `shared: true`, this writes a single `.env` at the repo root:

```dotenv
NODE_ENV="production"
API_PORT="3000"
HOST="0.0.0.0"
LOG_LEVEL="info"
DATABASE_URL="postgres://postgres:postgres@localhost:5432/app"
VITE_API_URL="localhost:3000"
```

## Configuration

All keys live at the top of the config file; `apps` holds the per-application variables.

| Key         | Type                 | Default  | Description |
| ----------- | -------------------- | -------- | ----------- |
| `apps`      | map                  | —        | App name → map of variables. Required unless the config `extends` another. |
| `shared`    | boolean              | `false`  | `true`: merge all apps into one file. `false`: one file per app. |
| `output`    | string               | `.env`   | Output path for the combined file (**`shared: true` only**). |
| `prefix`    | string               | `""`     | Filename prefix for per-app files (**`shared: false` only**). |
| `postfix`   | string               | `""`     | Filename suffix for per-app files (**`shared: false` only**). |
| `overwrite` | boolean              | `false`  | Overwrite existing files instead of skipping them. |
| `expand`    | boolean              | `false`  | Enable `${VAR}` interpolation (see [Interpolation](#interpolation)). |
| `extends`   | string \| string[]   | —        | Inherit from one or more base configs (see [Extending configs](#extending-configs)). |

### Variable values

Each variable is a scalar: **string, number, boolean, or `null`**. Numbers and booleans are
coerced to strings (`3000` → `"3000"`, `true` → `"true"`), and `null` (an empty key) becomes
an empty string. Because the config is YAML, quotes and special characters are handled
natively — no manual escaping:

```yaml
apps:
  api:
    PORT: 3000                                  # -> "3000"
    DEBUG: true                                 # -> "true"
    DATABASE_URL: postgres://u:p@host/db?x="y"  # quotes preserved
    EMPTY:                                      # -> ""
```

An app with no variables (empty or `null`) is skipped.

### Output modes

**Combined (`shared: true`)** — every app's variables are written to a single file at
`output` (default `.env`). This is the usual choice for local development.

**Per-app (`shared: false`)** — each app gets its own file named
`<prefix><app><postfix>`. For example, with `prefix: "."` and `postfix: ".env"` you get
`.api.env`, `.web.env`, and so on. With no prefix/postfix the file is named after the app.

### Conflicting keys

In combined mode, if the same key appears in more than one app the first value wins and
duplicates are dropped. If two apps set the same key to *different* values, monoenv keeps
the first and prints a warning so you know a later value was ignored.

## Interpolation

Set `expand: true` to resolve `${VAR}` references. Resolution is **per app**: monoenv looks
in the app's own variables first, then falls back to `process.env` (handy for secrets or
CI-provided values). It is opt-in, so any values that happen to contain `${...}` keep their
literal meaning unless you turn it on.

```yaml
expand: true

apps:
  api:
    HOST: localhost
    PORT: 3000
    BASE_URL: http://${HOST}:${PORT}                 # -> http://localhost:3000
    DATABASE_URL: postgres://user:${DB_PASSWORD}@db  # DB_PASSWORD from process.env
    LOG_LEVEL: ${LOG_LEVEL:-info}                    # default when unset
```

- `${VAR:-default}` — use `default` when `VAR` is unset in both the app and `process.env`.
- References resolve recursively; reference cycles resolve to an empty string.
- Escape a literal with a backslash: `\${NOT_A_REF}` stays `${NOT_A_REF}`.
- References only see the current app's variables — they never cross into other apps.

## Extending configs

Use `extends` to build environment-specific configs on top of a shared base instead of
duplicating keys. Paths are resolved relative to the extending file.

```yaml
# .monoenv.base.yaml
shared: true
apps:
  api:
    NODE_ENV: development
    PORT: 3000
    HOST: localhost
```

```yaml
# .monoenv.prod.yaml
extends: .monoenv.base.yaml
apps:
  api:
    NODE_ENV: production   # override
    PORT: 8080             # override
    # HOST is inherited from the base
```

```bash
monoenv -c .monoenv.prod.yaml
```

- Options and per-app variables are merged, with the extending file taking precedence, key
  by key.
- `extends` may be a single path or a list (`extends: [a.yaml, b.yaml]`); later entries win.
- Interpolation runs after merging, so a value can reference a variable inherited from a base.
- A config that only extends may omit `apps` entirely.

## CLI

```bash
monoenv [-c | --config <path>]
```

With no argument, monoenv looks for `.monoenv.yaml` (or `.monoenv.yml`) in the current
directory. Pass `-c`/`--config` to use a different file:

```bash
npx monoenv -c .monoenv.prod.yaml
```

## Programmatic API

monoenv is ESM-only. It exposes named exports and a default export:

```typescript
import monoenv from "monoenv";
import * as dotenv from "dotenv";

monoenv.loadEnvFromConfigFile(".monoenv.yaml"); // generate from a specific file
// monoenv.loadEnv();                            // or use the default .monoenv.yaml|yml
dotenv.config();                                 // then load the generated .env
```

```typescript
import { loadEnv, loadEnvFromConfigFile } from "monoenv";
```

- `loadEnv()` — process the default `.monoenv.yaml`/`.monoenv.yml` if present; a no-op otherwise.
- `loadEnvFromConfigFile(path?)` — process `path`, or fall back to the default file. Exits
  the process with a clear message if no config can be found or the file does not exist.

## Use case

Say you're on Turborepo with three apps — `api`, `uploader`, and `web`. Keep a shared base
plus per-environment overrides.

`.monoenv.base.yaml` holds the values shared across environments (no `NODE_ENV`):

```yaml
apps:
  api:
    API_PORT: 5000
    HOST: localhost
  uploader:
    API_URL: http://localhost:5000
  web:
    VITE_API_URL: localhost:5000
```

**Development** — combine everything into one `.env`. `.monoenv.dev.yaml`:

```yaml
extends: .monoenv.base.yaml
shared: true
overwrite: true
output: '.env'
apps:
  api:
    NODE_ENV: development
    LOG_LEVEL: debug
  uploader:
    NODE_ENV: development
  web:
    NODE_ENV: development
```

```json
{
  "scripts": {
    "dev": "monoenv -c .monoenv.dev.yaml && dotenv -- turbo run dev --parallel"
  }
}
```

Running `npm run dev` writes a single `.env` that `dotenv-cli` feeds to every app.

**Production** — a separate file per app. `.monoenv.prod.yaml`:

```yaml
extends: .monoenv.base.yaml
shared: false
overwrite: true
prefix: '.'
postfix: '.env'
apps:
  api:
    NODE_ENV: production
    API_PORT: 3000    # override the base
    HOST: 0.0.0.0     # override the base
    LOG_LEVEL: info
  uploader:
    NODE_ENV: production
  web:
    NODE_ENV: production
```

Before building your images, run:

```bash
npx monoenv -c .monoenv.prod.yaml
```

You'll get one file per app — `.api.env`, `.uploader.env`, `.web.env` — ready to feed to
each service or Docker build.

## License

[MIT](./LICENSE.md)
