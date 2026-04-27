import { readMCP, writeMCP } from "../store/mcp.js";
import { readSkills, writeSkill } from "../store/skills.js";
import { buildImportPreview } from "./from-agents.js";
import type { ImportPreview } from "./from-agents.js";

export type { ImportPreview, ImportedItem } from "./from-agents.js";

/**
 * Compute what would be imported (preview only — no writes).
 */
export async function previewImport(): Promise<ImportPreview> {
  const [pmcp, pskills] = await Promise.all([readMCP("personal"), readSkills("personal")]);
  return buildImportPreview({
    existingPersonalMcpIds: pmcp.map((s) => s.id),
    existingPersonalSkillIds: pskills.map((s) => s.id),
  });
}

/**
 * Apply the import: write everything from the preview into the personal layer.
 *
 * Returns counts of what was actually written.
 */
export async function applyImport(preview?: ImportPreview): Promise<{
  mcpWritten: number;
  skillsWritten: number;
}> {
  const p = preview ?? (await previewImport());

  // MCP: append to existing personal servers.
  if (p.mcp.length > 0) {
    const existing = await readMCP("personal");
    const merged = [...existing, ...p.mcp.map((x) => x.item)];
    await writeMCP("personal", merged);
  }

  // Skills: write each as its own SKILL.md.
  for (const s of p.skills) {
    await writeSkill(s.item);
  }

  return {
    mcpWritten: p.mcp.length,
    skillsWritten: p.skills.length,
  };
}
