(function() {
  "use strict";
  function activateTab(tabId) {
    document.querySelectorAll(".tab-btn").forEach((btn2) => {
      btn2.classList.remove("active");
    });
    document.querySelectorAll(".tab-pane").forEach((pane2) => {
      pane2.style.display = "none";
    });
    const btn = document.getElementById(`tab-${tabId}`);
    const pane = document.getElementById(`pane-${tabId}`);
    if (btn) btn.classList.add("active");
    if (pane) pane.style.display = "block";
  }
  async function renderOverview() {
    var _a;
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    const tabId = (tab == null ? void 0 : tab.id) ?? 0;
    const resp = await chrome.runtime.sendMessage(
      { type: "GET_STATS", tabId }
    );
    setText("session-count", (resp == null ? void 0 : resp.sessionCageCount) ?? 0);
    setText("tab-count", (resp == null ? void 0 : resp.tabCount) ?? 0);
    setText("monthly-caged", (resp == null ? void 0 : resp.monthlyPiiCaged) ?? 0);
    setText("monthly-shadow", (resp == null ? void 0 : resp.monthlyShadowAi) ?? 0);
    const status = document.getElementById("status-text");
    if (status) {
      if (((resp == null ? void 0 : resp.sessionShadowCount) ?? 0) > 0) {
        status.textContent = "⚠️ Shadow AI detected";
        status.style.background = "#fef2f2";
        status.style.color = "#991b1b";
        status.style.borderColor = "#fecaca";
      } else if (((resp == null ? void 0 : resp.sessionCageCount) ?? 0) > 0) {
        status.textContent = "🔒 Protecting your data";
      } else {
        status.textContent = "✅ Monitoring — no PII detected yet";
      }
    }
    if (((resp == null ? void 0 : resp.monthlyPiiCaged) ?? 0) >= 100) {
      const wm = document.getElementById("watermark");
      if (wm) wm.style.display = "block";
    }
    const sitesEl = document.getElementById("top-sites");
    if (sitesEl && ((_a = resp == null ? void 0 : resp.topSites) == null ? void 0 : _a.length)) {
      sitesEl.innerHTML = resp.topSites.slice(0, 5).map((s) => `<li><span class="site-name">${escHtml(s.site)}</span><span class="site-count">${s.count}</span></li>`).join("");
    }
  }
  async function renderShadowAi() {
    const resp = await chrome.runtime.sendMessage(
      { type: "GET_SHADOW_LOG" }
    );
    const listEl = document.getElementById("shadow-list");
    if (!listEl) return;
    const entries = (resp == null ? void 0 : resp.entries) ?? [];
    if (entries.length === 0) {
      listEl.innerHTML = '<li class="empty">No shadow AI calls detected yet.<br>Keep browsing — AI is everywhere.</li>';
      return;
    }
    const bysite = /* @__PURE__ */ new Map();
    for (const e of entries) {
      const existing = bysite.get(e.site);
      if (existing) {
        existing.count += e.totalCount;
        if (e.timestamp > existing.lastSeen) existing.lastSeen = e.timestamp;
      } else {
        bysite.set(e.site, {
          count: e.totalCount,
          lastSeen: e.timestamp,
          detail: e.detail ?? ""
        });
      }
    }
    listEl.innerHTML = [...bysite.entries()].sort((a, b) => b[1].count - a[1].count).map(([site, info]) => `
      <li class="shadow-item">
        <div class="shadow-site">${escHtml(site)}</div>
        <div class="shadow-meta">${info.count} call(s) · ${formatDate(info.lastSeen)}</div>
        <div class="shadow-detail">${escHtml(info.detail)}</div>
      </li>`).join("");
  }
  async function exportCSV() {
    const resp = await chrome.runtime.sendMessage(
      { type: "EXPORT_AUDIT_CSV" }
    );
    if (!(resp == null ? void 0 : resp.csv)) {
      alert("Audit log is empty.");
      return;
    }
    const blob = new Blob([resp.csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `ai-cage-audit-${(/* @__PURE__ */ new Date()).toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }
  function setText(id, value) {
    const el = document.getElementById(id);
    if (el) el.textContent = String(value);
  }
  function escHtml(s) {
    return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }
  function formatDate(iso) {
    try {
      return new Date(iso).toLocaleString(void 0, {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit"
      });
    } catch {
      return iso;
    }
  }
  document.addEventListener("DOMContentLoaded", () => {
    var _a, _b, _c, _d;
    (_a = document.getElementById("tab-overview")) == null ? void 0 : _a.addEventListener("click", () => {
      activateTab("overview");
      void renderOverview();
    });
    (_b = document.getElementById("tab-shadow")) == null ? void 0 : _b.addEventListener("click", () => {
      activateTab("shadow");
      void renderShadowAi();
    });
    (_c = document.getElementById("tab-agent")) == null ? void 0 : _c.addEventListener("click", () => {
      activateTab("agent");
      void renderAgentTab();
    });
    (_d = document.getElementById("export-btn")) == null ? void 0 : _d.addEventListener("click", () => {
      void exportCSV();
    });
    activateTab("overview");
    void renderOverview();
  });
  async function renderAgentTab() {
    const resp = await chrome.runtime.sendMessage(
      { type: "GET_AUDIT_LOG" }
    );
    const entries = (resp == null ? void 0 : resp.entries) ?? [];
    const agentEvents = entries.filter((e) => e.type === "AGENT_TOOL_CALL" || e.type === "POLICY_VIOLATION").slice(-20).reverse();
    const blockedInjections = agentEvents.filter(
      (e) => (e.detail ?? "").includes("BLOCKED_INJECTION") || (e.detail ?? "").includes("injections=") && !(e.detail ?? "").includes("injections=0")
    ).length;
    const exfilAttempts = agentEvents.filter(
      (e) => (e.detail ?? "").includes("BLOCKED_DOMAIN") || (e.detail ?? "").includes("exfil")
    ).length;
    setText("agent-blocked", blockedInjections);
    setText("agent-exfil", exfilAttempts);
    const listEl = document.getElementById("agent-events");
    if (!listEl) return;
    if (agentEvents.length === 0) {
      listEl.innerHTML = '<li style="font-size:11px;color:#64748b;padding:8px 0">No agent events recorded yet.</li>';
      return;
    }
    listEl.innerHTML = agentEvents.map((e) => {
      const isBlocked = (e.detail ?? "").includes("BLOCKED");
      const color = isBlocked ? "#dc2626" : "#16a34a";
      const icon = isBlocked ? "🚫" : "✅";
      return `
      <li style="padding:4px 0;border-bottom:1px solid #f1f5f9;font-size:11px">
        <span style="color:${color};font-weight:700">${icon} ${escHtml(e.type)}</span>
        <span style="color:#64748b;float:right">${formatDate(e.timestamp)}</span>
        <div style="color:#64748b;font-size:10px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${escHtml(e.detail ?? "")}</div>
      </li>`;
    }).join("");
  }
})();
