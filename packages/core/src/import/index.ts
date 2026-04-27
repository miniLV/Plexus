import { readAllMCP, readMCP, writeMCP } from "../store/mcp.js";
import { readAllSkills, readSkills, writeSkill } from "../store/skills.js";
import { buildImportPreview } from "./from-agents.js";
import type { ImportPreview, MCPCandidate, SkillCandidate } from "./from-agents.js";

export type {
  ImportPreview,
  MCPCandidate,
  SkillCandidate,
  NewItem,
  ExtendItem,
} from "./from-agents.js";

/**
 * Compute what would be imported (preview only — no writes).
 *
 * Reads BOTH personal and team layers as the existing store, since either
 * already covers the agent → no need to import again.
 */
export async function previewImport(): Promise<ImportPreview> {
  const [storeMcp, storeSkills] = await Promise.all([readAllMCP(), readAllSkills()]);
  return buildImportPreview({ storeMcp, storeSkills });
}

/**
 * Apply the import: write everything from the preview into the personal layer.
 *
 * - "new"    candidates: add a new entry.
 * - "extend" candidates: append the missing agents to the existing entry's
 *   `enabledAgents`. Team-layer entries are not mutated; instead, we add a
 *   personal-layer override (which wins via merge).
 *
 * Returns counts of writes performed.
 */
export async function applyImport(preview?: ImportPreview): Promise<{
  mcpWritten: number;
  skillsWritten: number;
  mcpExtended: number;
  skillsExtended: number;
}> {
  const p = preview ?? (await previewImport());

  let mcpWritten = 0;
  let mcpExtended = 0;
  let skillsWritten = 0;
  let skillsExtended = 0;

  // ── MCP ────────────────────────────────────────────────────────────────
  if (p.mcp.length > 0) {
    const personal = await readMCP("personal");
    const team = await readMCP("team");
    const personalById = new Map(personal.map((m) => [m.id, m]));
    const teamById = new Map(team.map((m) => [m.id, m]));

    const next = [...personal];
    const newPushed = new Set<string>();

    for (const cand of p.mcp) {
      if (cand.kind === "new") {
        next.push(cand.item);
        newPushed.add(cand.item.id);
        mcpWritten += 1;
      } else {
        const existingPersonal = personalById.get(cand.id);
        if (existingPersonal) {
          existingPersonal.enabledAgents = Array.from(
            new Set([...existingPersonal.enabledAgents, ...cand.agentsToAdd]),
          );
        } else {
          const existingTeam = teamById.get(cand.id);
          if (existingTeam) {
            // Promote a personal-layer override.
            next.push({
              ...existingTeam,
              layer: "personal",
              enabledAgents: Array.from(
                new Set([...existingTeam.enabledAgents, ...cand.agentsToAdd]),
              ),
            });
          }
        }
        mcpExtended += 1;
      }
    }
    await writeMCP("personal", next);
  }

  // ── Skills ─────────────────────────────────────────────────────────────
  if (p.skills.length > 0) {
    const personalSkills = await readSkills("personal");
    const teamSkills = await readSkills("team");
    const personalById = new Map(personalSkills.map((s) => [s.id, s]));
    const teamById = new Map(teamSkills.map((s) => [s.id, s]));

    for (const cand of p.skills) {
      if (cand.kind === "new") {
        await writeSkill(cand.item);
        skillsWritten += 1;
      } else {
        const existingPersonal = personalById.get(cand.id);
        if (existingPersonal) {
          await writeSkill({
            ...existingPersonal,
            enabledAgents: Array.from(
              new Set([...existingPersonal.enabledAgents, ...cand.agentsToAdd]),
            ),
          });
        } else {
          const existingTeam = teamById.get(cand.id);
          if (existingTeam) {
            await writeSkill({
              ...existingTeam,
              layer: "personal",
              enabledAgents: Array.from(
                new Set([...existingTeam.enabledAgents, ...cand.agentsToAdd]),
              ),
            });
          }
        }
        skillsExtended += 1;
      }
    }
  }

  return { mcpWritten, skillsWritten, mcpExtended, skillsExtended };
}
