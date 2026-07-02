#!/usr/bin/env node

import minimist from "minimist";
import { loadEnvFromConfigFile } from "../index.js";

const argv = minimist(process.argv.slice(2));
const configPath = argv.config || argv.c;

loadEnvFromConfigFile(configPath);
