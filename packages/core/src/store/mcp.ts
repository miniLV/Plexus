import fs from "node:fs/promises";
import path from "node:path";
import YAML from "yaml";
import type { ConfigLayer, MCPServerDef } from "../types.js";
import { pathExists } from "./fs-utils.js";
import { PLEXUS_PATHS } from "./paths.js";
import { ensureStoreScaffolding, layerRoot } from "./scaffolding.js";

function mcpFile(layer: ConfigLayer): string {
  return path.join(layerRoot(layer), PLEXUS_PATHS.mcpDirRel, "servers.yaml");
}

export async function readMCP(layer: ConfigLayer): Promise<MCPServerDef[]> {
  await ensureStoreScaffolding();
  const file = mcpFile(layer);
  if (!(await pathExists(file))) return [];
  const raw = await fs.readFile(file, "utf8");
  const parsed = YAML.parse(raw) ?? {};
  const list = Array.isArray(parsed?.servers) ? parsed.servers : [];
  return list.map((s: any) => ({ ...s, layer })) as MCPServerDef[];
}

export async function writeMCP(layer: ConfigLayer, servers: MCPServerDef[]): Promise<void> {
  await ensureStoreScaffolding();
  const stripped = servers.map(({ layer: _l, ...rest }) => rest);
  const payload = { servers: stripped };
  await fs.writeFile(mcpFile(layer), YAML.stringify(payload), "utf8");
}

export async function readAllMCP(): Promise<MCPServerDef[]> {
  const [team, personal] = await Promise.all([readMCP("team"), readMCP("personal")]);
  return [...team, ...personal];
}
