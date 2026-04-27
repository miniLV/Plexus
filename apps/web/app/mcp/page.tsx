import { ALL_AGENTS, readAllMCP } from "@plexus/core";
import { McpEditor } from "@/components/mcp-editor";

export const dynamic = "force-dynamic";

export default async function McpPage() {
  const servers = await readAllMCP();
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">MCP Servers</h1>
        <p className="text-sm text-plexus-mute">
          Define MCP servers once. Pick which agents publish them.
        </p>
      </div>

      <McpEditor initial={servers} agents={[...ALL_AGENTS]} />
    </div>
  );
}
