import type { MCPServerDef, SkillDef } from "./types.js";

/**
 * Merge personal layer over team layer.
 *
 * Rule: an item with the same `id` in `personal` overrides the team one.
 *       Items only in `personal` are added on top.
 *       Items only in `team` are kept as-is.
 *
 * MVP semantics: members can ADD on top of team baseline but not REMOVE.
 * That means if a team item exists and personal has no entry with same id,
 * the team item is kept regardless of personal preference.
 */

export function mergeMCP(team: MCPServerDef[], personal: MCPServerDef[]): MCPServerDef[] {
  const byId = new Map<string, MCPServerDef>();
  for (const t of team) byId.set(t.id, t);
  for (const p of personal) byId.set(p.id, p);
  return Array.from(byId.values());
}

export function mergeSkills(team: SkillDef[], personal: SkillDef[]): SkillDef[] {
  const byId = new Map<string, SkillDef>();
  for (const t of team) byId.set(t.id, t);
  for (const p of personal) byId.set(p.id, p);
  return Array.from(byId.values());
}
