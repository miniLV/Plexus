// Tiny shell injector for the static mockups.
// Each page sets <body data-active="mcp" data-title="MCP Servers" data-crumb="Workspace / MCP Servers">
// and puts its content inside <main id="content">…</main>.
// This script wraps content with sidebar + top bar.

(function () {
  const NAV = [
    {
      group: "Workspace",
      items: [
        { id: "dashboard", label: "Dashboard", href: "dashboard.html",
          icon: '<rect x="3" y="3" width="7" height="9"/><rect x="14" y="3" width="7" height="5"/><rect x="14" y="12" width="7" height="9"/><rect x="3" y="16" width="7" height="5"/>' },
        { id: "mcp", label: "MCP Servers", href: "mcp-servers.html", count: 12,
          icon: '<path d="M5 12V8a2 2 0 0 1 2-2h2"/><path d="M19 12V8a2 2 0 0 0-2-2h-2"/><path d="M5 12v4a2 2 0 0 0 2 2h2"/><path d="M19 12v4a2 2 0 0 1-2 2h-2"/><circle cx="12" cy="12" r="2"/>' },
        { id: "skills", label: "Skills", href: "skills.html", count: 8,
          icon: '<path d="M12 2 4 6v6c0 5 3.5 9.5 8 10 4.5-.5 8-5 8-10V6l-8-4Z"/>' },
        { id: "mirror", label: "Mirror", href: "mirror.html",
          icon: '<path d="m17 3 4 4-4 4"/><path d="M21 7H9"/><path d="m7 21-4-4 4-4"/><path d="M3 17h12"/>' },
      ],
    },
    {
      group: "Configuration",
      items: [
        { id: "backups", label: "Backups", href: "backups.html",
          icon: '<path d="M3 12a9 9 0 1 0 9-9"/><path d="M3 4v5h5"/><path d="M12 7v5l3 2"/>' },
        { id: "team", label: "Team", href: "team.html", chip: "1.1 beta",
          icon: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>' },
        { id: "settings", label: "Settings", href: "settings.html",
          icon: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33h0a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51h0a1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82v0a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>' },
      ],
    },
  ];

  const active = document.body.dataset.active || "dashboard";
  const title  = document.body.dataset.title  || "Dashboard";
  const crumb  = document.body.dataset.crumb  || `Workspace / ${title}`;

  const sidebar = `
    <aside class="w-[240px] border-r border-hair shrink-0 px-3 py-5 flex flex-col"
           style="background: var(--plexus-surface);">
      <div class="px-2 mb-6">
        <div class="flex items-baseline gap-2">
          <span class="dot bg-accent" style="width:10px;height:10px;"></span>
          <span class="title">Plexus</span>
          <span class="font-mono caption text-3">v1.0.0</span>
        </div>
        <div class="caption text-3 mt-1 px-3">team agent config</div>
      </div>
      ${NAV.map(g => `
        <div class="px-1 ${g.group === "Configuration" ? "" : "mb-2"}">
          ${g.group === "Configuration" ? '<div class="sidebar-divider"></div>' : ""}
          <div class="eyebrow px-2 mb-2">${g.group}</div>
          ${g.items.map(it => `
            <a href="${it.href}" class="nav-item ${active === it.id ? "active" : ""}">
              <svg class="ico" viewBox="0 0 24 24">${it.icon}</svg>
              ${it.label}
              ${it.count != null ? `<span class="ml-auto caption text-mute">${it.count}</span>` : ""}
              ${it.chip ? `<span class="badge badge-beta ml-auto">${it.chip}</span>` : ""}
            </a>`).join("")}
        </div>`).join("")}
      <div class="mt-auto px-3 pt-4 border-t border-hair">
        <div class="flex items-center gap-2 mb-1">
          <span class="dot pulse" style="background: var(--plexus-ok);"></span>
          <span class="body" style="font-weight: 500;">4 agents synced</span>
        </div>
        <div class="caption text-3">last sync 2 min ago</div>
      </div>
    </aside>`;

  const topbar = `
    <header class="flex items-center justify-between px-10 py-5 border-b border-hair">
      <div class="flex items-center gap-3 caption text-3">
        ${crumb.split(" / ").map((c, i, arr) =>
          i === arr.length - 1
            ? `<span class="text-2">${c}</span>`
            : `<span>${c}</span><span>/</span>`
        ).join("")}
      </div>
      <div class="flex items-center gap-3">
        <button class="btn btn-ghost">
          <svg class="ico" viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
          <span class="caption text-3">Search…</span>
          <span class="caption text-mute font-mono ml-2 px-1.5 py-0.5 rounded"
                style="background: var(--plexus-surface-2); border:1px solid var(--plexus-border);">⌘K</span>
        </button>
        <div class="theme-toggle" title="Toggle theme"></div>
        <div class="w-8 h-8 rounded-full grid place-items-center"
             style="background: var(--plexus-accent-faint); color: var(--plexus-accent); font-weight: 600;">M</div>
      </div>
    </header>`;

  // Wrap existing #content
  const content = document.getElementById("content");
  const html = `
    <div class="flex min-h-screen">
      ${sidebar}
      <main class="flex-1 min-w-0">
        ${topbar}
        <div id="page" class="px-10 py-8 max-w-[1180px] mx-auto"></div>
      </main>
    </div>`;
  document.body.innerHTML = html;
  document.getElementById("page").appendChild(content);
  content.style.display = "block";

  // Theme toggle
  document.querySelector(".theme-toggle").addEventListener("click", () => {
    const html = document.documentElement;
    html.dataset.theme = html.dataset.theme === "dark" ? "light" : "dark";
  });
})();
