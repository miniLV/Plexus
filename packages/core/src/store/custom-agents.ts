import fs from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import { pathExists } from "./fs-utils.js";
import { PLEXUS_PATHS } from "./paths.js";

/**
 * Custom agents (Lite) — user-defined agents managed only at the
 * "instruction file" (CLAUDE.md / AGENTS.md / etc.) layer. Stored at
 * `<plexus root>/personal/custom-agents.json`.
 *
 * Built-in agents (claude-code, cursor, codex, factory-droid) are NOT
 * stored here; they live in `AGENT_PATHS` and behave as before. Custom
 * agents only surface on the dashboard's Custom Agents card and let users
 * view/edit a single declared instruction file path.
 */

export const CustomAgentSchema = z.object({
  id: z
    .string()
    .min(1)
    .max(64)
    .regex(/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/, {
      message: "id must be lowercase alphanumeric with optional dashes",
    }),
  displayName: z.string().min(1).max(80),
  /** Absolute path to the agent's instruction file (e.g. ~/.copilot/AGENTS.md). */
  instructionFile: z.string().min(1),
  /** Optional free-form note shown in the UI. */
  note: z.string().max(280).optional(),
  /** ISO timestamp when this entry was created. */
  createdAt: z.string(),
});

export type CustomAgent = z.infer<typeof CustomAgentSchema>;

const FileSchema = z.object({
  agents: z.array(CustomAgentSchema),
});

const STORE_PATH = path.join(PLEXUS_PATHS.personal, "custom-agents.json");

const RESERVED_IDS = new Set(["claude-code", "cursor", "codex", "factory-droid"]);

async function readRaw(): Promise<{ agents: CustomAgent[] }> {
  if (!(await pathExists(STORE_PATH))) return { agents: [] };
  try {
    const raw = await fs.readFile(STORE_PATH, "utf8");
    const parsed = FileSchema.safeParse(JSON.parse(raw));
    if (!parsed.success) {
      // Don't throw at read time — surface as empty list and let the user
      // re-add. The original file stays on disk, untouched.
      return { agents: [] };
    }
    return parsed.data;
  } catch {
    return { agents: [] };
  }
}

async function writeRaw(file: { agents: CustomAgent[] }): Promise<void> {
  await fs.mkdir(path.dirname(STORE_PATH), { recursive: true });
  await fs.writeFile(STORE_PATH, `${JSON.stringify(file, null, 2)}\n`, "utf8");
}

export async function listCustomAgents(): Promise<CustomAgent[]> {
  const { agents } = await readRaw();
  return agents;
}

export async function getCustomAgent(id: string): Promise<CustomAgent | undefined> {
  const all = await listCustomAgents();
  return all.find((a) => a.id === id);
}

export interface CustomAgentInput {
  id: string;
  displayName: string;
  instructionFile: string;
  note?: string;
}

export async function addCustomAgent(input: CustomAgentInput): Promise<CustomAgent> {
  const next: CustomAgent = {
    ...input,
    instructionFile: path.resolve(expandTilde(input.instructionFile)),
    createdAt: new Date().toISOString(),
  };
  // Validate via zod.
  const parsed = CustomAgentSchema.safeParse(next);
  if (!parsed.success) {
    throw new Error(
      `Invalid custom agent: ${parsed.error.errors.map((e) => e.message).join("; ")}`,
    );
  }
  if (RESERVED_IDS.has(parsed.data.id)) {
    throw new Error(`Agent id '${parsed.data.id}' is reserved for a built-in agent.`);
  }
  const file = await readRaw();
  if (file.agents.some((a) => a.id === parsed.data.id)) {
    throw new Error(`Custom agent '${parsed.data.id}' already exists.`);
  }
  file.agents.push(parsed.data);
  await writeRaw(file);
  return parsed.data;
}

export async function removeCustomAgent(id: string): Promise<boolean> {
  const file = await readRaw();
  const before = file.agents.length;
  file.agents = file.agents.filter((a) => a.id !== id);
  if (file.agents.length === before) return false;
  await writeRaw(file);
  return true;
}

function expandTilde(p: string): string {
  if (p.startsWith("~/") || p === "~") {
    return path.join(process.env.HOME ?? "", p.slice(1));
  }
  return p;
}
