# monoenv
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](./LICENSE)
[![Twitter: omarahm3](https://img.shields.io/twitter/follow/omarahm3.svg?style=social)](https://twitter.com/omarahm3)

> Better handling of multiple applications dotenv files in monorepos.

Monoenv is a tool that helps you manage multiple dotenv files in a monorepo with ease in both development and production environments, with the goal of having a single source of truth yaml file that contains all of your environment variables for all of your projects that you can either combibne them under single `.env` file (usually for development) or have a multiple per-application `.env` file (usually for production).

Package is depending on [`dotenv`](https://github.com/motdotla/dotenv) because you will need it to manage your generated `.env` file/s.

## Install

On your monorepo root, run:

```bash
npm i -D monoenv
```

## Why

Handling dotenv files in monorepos for me is a bit of pain especaially whe it comes to deployment. Since at least for [turborepo](https://turbo.build/repo/docs/handbook/environment-variables) you're expected to have a single `.env` file that is shared between all of your projects, while this is fine for development, i didn't want to have this while deploying and building my projects' docker images.

I wanted to have a single `.env` file per project, that i could feed to my docker build or docker run commands.

#### Before

I would have a shared `.env` file at the root of my application that contains all environement variables for my 3 services and 1 frontend application, during deployment i would have to pass the `.env` file to frontend image build command and to my running services too.

```yaml
version: "3.2"

services:
  frontend:
    container_name: frontend
    image: frontend
    build: 
      context: .
      dockerfile: ./apps/frontend/Dockerfile
      args:
        - VITE_API_URL=${VITE_API_URL}
    env_file: ./.env # ---- here
    restart: always

  server:
    container_name: server
    image: server
    build: 
      context: .
      dockerfile: ./apps/api/Dockerfile
    env_file: ./.env # ---- here
    restart: always

  uploader:
    container_name: uploader
    image: uploader
    build: 
      context: .
      dockerfile: ./apps/uploader/Dockerfile
    env_file: ./.env # ---- here
    restart: always
```

Notice how i'm using the same `.env` file for all of my services.

#### After

Separation of concerns is a good thing. Now i have a single `.env` file for each project and can be easilly fed to docker

```yaml
version: "3.2"

services:
  frontend:
    container_name: frontend
    image: frontend
    build: 
      context: .
      dockerfile: ./apps/frontend/Dockerfile
      args:
        - VITE_API_URL=${VITE_API_URL}
    restart: always
    env_file: ./.frontend.env # ---- here

  server:
    container_name: server
    image: server
    build: 
      context: .
      dockerfile: ./apps/api/Dockerfile
    env_file: ./.server.env # ---- here
    restart: always

  uploader:
    container_name: uploader
    image: uploader
    build: 
      context: .
      dockerfile: ./apps/uploader/Dockerfile
    env_file: ./.uploader.env # ---- here
    restart: always
```

So the reason i created this so i don't worry more about `.env` files no more, i just have a single `.monoenv.yaml` file that i keep maintaining and do not care anymore about my environment since `monoenv` will take care of generating all the files needed and i have to prepare my deployment scripts and applications accordingly.


## Usage

Create a `.monoenv.yaml` file in your project root directory:

```yaml
shared: true # set true if you want to combine all the environment variables in a single `.env` file
overwrite: false # set true if you want to overwrite any existing `.env` file/s
postfix: '.env' # set the postfix for the generated application environment file
prefix: '.' # set the prefix for the generated application environment file
output: '.env' # set the output file for the generated application environment file, this works only with 'shared' option set to true

apps:
  api:
    - NODE_ENV="production"
    - API_PORT="3000"
    - HOST="0.0.0.0"
    - LOG_LEVEL="info"
    - JWT_SECRET="test"
    - DATABASE_URL="postgres://postgres:postgres@localhost:5432/test"
    
  uploader:
    - NODE_ENV="production"

  web:
    - NODE_ENV="production"
    - VITE_API_URL=localhost:3000
```

now you can use monoenv in by calling it in your before running your development script in `package.json`:

```json
"scripts": {
    "dev": "monoenv && dotenv -- turbo run dev --parallel"
    ...
}
```

Make sure you setup your monorepo to load your environment variables (e.g. on [turborepo](https://turbo.build/repo/docs/handbook/environment-variables)) and that have `dotenv` package installed in your applications, since `dev` script will generate a `.env` file on the parent directory that will look like this:

```
NODE_ENV="production"
API_PORT="3000"
HOST="0.0.0.0"
LOG_LEVEL="info"
JWT_SECRET="test"
DATABASE_URL="postgres://postgres:postgres@localhost:5432/test"
NODE_ENV="production"
NODE_ENV="production"
VITE_API_URL="localhost:3000"
```

You can always use different name for your monoenv config file, then you can supply that config file as such:

```bash
monoenv --config project.production.yaml
```

## In code

Although not really recommended and is not its purpose, just like you're calling `dotenv.config()` as early as possible in your application, you can call `monoenv.loadEnv` or `monoenv.loadEnvFromConfigFile` **before** calling `dotenv.config` to parse and create the needed dotenv files.

```typescript
import monoenv from "monoenv";
import * as dotenv from "dotenv";
monoenv.loadEnvFromConfigFile(".monoenv.yaml");
// monoenv.loadEnv(); // To load .monoenv.yaml|yml file by default
dotenv.config();
```

# Use case

Let's say you're woring on turborepo and you want to have a separate environment file for each application on production since this is the recommended way to do it. You have 3 applications api, image-uploader, and web

Now on the root of your monorepo you have a `.monoenv.dev.yaml` file that looks like this:

```yaml
shared: true
overwrite: true
output: '.env'

apps:
  api:
    - NODE_ENV="development"
    - API_PORT="5000"
    - HOST="localhost"
    - LOG_LEVEL="debug"
    - JWT_SECRET="supersecret"
    - DATABASE_URL="postgres://postgres:postgres@localhost:5432/test"
    
  uploader:
    - NODE_ENV="development"
    - API_URL="http://localhost:5000"

  web:
    - NODE_ENV="development"
    - VITE_API_URL=localhost:5000
```

And in your `package.json` file you will have:

```json
"scripts": {
    "dev": "monoenv -c .monoenv.dev.yaml && dotenv -- turbo run dev --parallel",
    ...
}
```

once you run `npm run dev` you'll find a new `.env` file in your root directory that will be fed by `dotenv-cli` to your applications.

However this is for your development environment, so for production you will need to have a separate `.env` file for each application. And the way to do is by having another `.monoenv.prod.yaml` file that looks like this:

```yaml
shared: false
overwrite: false
postfix: '.env'
prefix: '.'

apps:
  api:
    - NODE_ENV="production"
    - API_PORT="3000"
    - HOST="0.0.0.0"
    - LOG_LEVEL="info"
    - JWT_SECRET="productionsecret"
    - DATABASE_URL="postgres://postgres:postgres@localhost:5432/prod"
    
  uploader:
    - NODE_ENV="production"

  web:
    - NODE_ENV="production"
    - VITE_API_URL=localhost:3000
```

Then in your deployment process and before building your applications or docker images, you can run:

```bash
npx monoenv -c .monoenv.prod.yaml
```

You'll notice 3 new files created with these names:

- .api.env
- .uploader.env
- .web.env

You can now feed these env files to your applications in whatever way you'd like.
