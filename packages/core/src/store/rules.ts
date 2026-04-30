import fs from "node:fs/promises";
import path from "node:path";
import type { ConfigLayer } from "../types.js";
import { ensureDir, pathExists } from "./fs-utils.js";
import { ensureStoreScaffolding, layerRoot } from "./scaffolding.js";

const RULES_DIR = "rules";
const GLOBAL_RULES_FILE = "global.md";

export interface RulesDocument {
  layer: ConfigLayer;
  path: string;
  content: string;
  updatedAt: string;
}

export function rulesFile(layer: ConfigLayer): string {
  return path.join(layerRoot(layer), RULES_DIR, GLOBAL_RULES_FILE);
}

export async function readRules(layer: ConfigLayer): Promise<RulesDocument | null> {
  await ensureStoreScaffolding();
  const file = rulesFile(layer);
  if (!(await pathExists(file))) return null;
  const stat = await fs.stat(file);
  return {
    layer,
    path: file,
    content: await fs.readFile(file, "utf8"),
    updatedAt: stat.mtime.toISOString(),
  };
}

export async function readEffectiveRules(): Promise<RulesDocument | null> {
  return (await readRules("personal")) ?? (await readRules("team"));
}

export async function writePersonalRules(content: string): Promise<void> {
  await ensureStoreScaffolding();
  const file = rulesFile("personal");
  await ensureDir(path.dirname(file));
  await fs.writeFile(file, content, "utf8");
}
