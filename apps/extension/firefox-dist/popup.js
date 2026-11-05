(function() {
  "use strict";
  const UPGRADE_URL = "https://ai-cage-gamma.vercel.app/#pricing";
  const RELEASES_URL = "https://github.com/smartsniper31/ai-cage/releases";
  const VERSION_URL = "https://ai-cage-gamma.vercel.app/version.json";
  const FREE_LIMIT = 100;
  const WARN_AT = 80;
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
  function openUpgrade() {
    void chrome.tabs.create({ url: UPGRADE_URL });
  }
  function activateTab(tabId) {
    var _a;
    document.querySelectorAll(".tab-btn").forEach((btn) => btn.classList.remove("active"));
    document.querySelectorAll(".tab-pane").forEach((pane2) => {
      pane2.style.display = "none";
    });
    (_a = document.getElementById(`tab-${tabId}`)) == null ? void 0 : _a.classList.add("active");
    const pane = document.getElementById(`pane-${tabId}`);
    if (pane) pane.style.display = "block";
  }
  function renderProgress(monthly) {
    const pct = Math.min(100, Math.round(monthly / FREE_LIMIT * 100));
    const left = Math.max(0, FREE_LIMIT - monthly);
    const countEl = document.getElementById("free-progress-count");
    if (countEl) {
      countEl.textContent = `${monthly} / ${FREE_LIMIT}`;
      countEl.className = "free-progress-count";
      if (monthly >= FREE_LIMIT) countEl.classList.add("danger");
      else if (monthly >= WARN_AT) countEl.classList.add("warning");
    }
    const barEl = document.getElementById("progress-bar-fill");
    if (barEl) {
      barEl.style.width = `${pct}%`;
      barEl.className = "progress-bar-fill";
      if (monthly >= FREE_LIMIT) barEl.classList.add("danger");
      else if (monthly >= WARN_AT) barEl.classList.add("warning");
    }
    const bannerEl = document.getElementById("upgrade-banner");
    if (bannerEl) {
      if (monthly >= WARN_AT && monthly < FREE_LIMIT) {
        bannerEl.classList.add("show");
        const subEl = bannerEl.querySelector(".upgrade-banner-sub");
        if (subEl) {
          subEl.innerHTML = `You have <strong>${left} cage${left === 1 ? "" : "s"} left</strong> this month on the Free plan.<br>
          Upgrade to Pro for <strong>unlimited protection</strong> — €5/user/month.`;
        }
      } else {
        bannerEl.classList.remove("show");
      }
    }
    const wm = document.getElementById("watermark");
    if (wm) wm.style.display = monthly >= FREE_LIMIT ? "block" : "none";
  }
  async function renderOverview() {
    var _a;
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    const tabId = (tab == null ? void 0 : tab.id) ?? 0;
    const resp = await chrome.runtime.sendMessage({ type: "GET_STATS", tabId });
    const monthly = (resp == null ? void 0 : resp.monthlyPiiCaged) ?? 0;
    const session = (resp == null ? void 0 : resp.sessionCageCount) ?? 0;
    const shadow = (resp == null ? void 0 : resp.sessionShadowCount) ?? 0;
    const tabCnt = (resp == null ? void 0 : resp.tabCount) ?? 0;
    setText("monthly-caged", monthly);
    setText("monthly-shadow", (resp == null ? void 0 : resp.monthlyShadowAi) ?? 0);
    setText("session-count", session);
    setText("tab-count", tabCnt);
    renderProgress(monthly);
    const statusEl = document.getElementById("status-text");
    if (statusEl) {
      statusEl.style.background = "";
      statusEl.style.color = "";
      statusEl.style.borderColor = "";
      if (monthly >= FREE_LIMIT) {
        statusEl.textContent = "🔶 Monthly limit reached — upgrade for unlimited cages";
        statusEl.style.background = "#fef3c7";
        statusEl.style.color = "#92400e";
        statusEl.style.borderColor = "#fde68a";
      } else if (shadow > 0) {
        statusEl.textContent = `⚠️ Shadow AI detected — ${shadow} suspicious call${shadow > 1 ? "s" : ""}`;
        statusEl.style.background = "#fef2f2";
        statusEl.style.color = "#991b1b";
        statusEl.style.borderColor = "#fecaca";
      } else if (monthly >= WARN_AT) {
        statusEl.textContent = `⚡ ${FREE_LIMIT - monthly} free cage${FREE_LIMIT - monthly === 1 ? "" : "s"} left this month — upgrade soon`;
        statusEl.style.background = "#fffbeb";
        statusEl.style.color = "#92400e";
        statusEl.style.borderColor = "#fde68a";
      } else if (session > 0) {
        statusEl.textContent = `🔒 Active — ${session} item${session > 1 ? "s" : ""} protected this session`;
      } else if (monthly > 0) {
        statusEl.textContent = `✅ Active — ${monthly} item${monthly > 1 ? "s" : ""} protected this month`;
      } else {
        statusEl.textContent = "🛡️ Monitoring — type a prompt on an AI site to test";
      }
    }
    const sitesEl = document.getElementById("top-sites");
    if (sitesEl) {
      if ((_a = resp == null ? void 0 : resp.topSites) == null ? void 0 : _a.length) {
        sitesEl.innerHTML = resp.topSites.slice(0, 5).map((s) => `
          <li>
            <span class="site-name">${escHtml(s.site)}</span>
            <span class="site-count">${s.count}</span>
          </li>`).join("");
      } else {
        sitesEl.innerHTML = `
        <li class="empty">
          No activity yet.<br>
          <strong style="color:#15803d">
            Go to ChatGPT and type your email — watch it get protected.
          </strong>
        </li>`;
      }
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
      listEl.innerHTML = `
      <li class="empty">
        No hidden AI calls detected yet.<br>
        Keep browsing — we're watching for you.
      </li>`;
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
      <li class="shadow-item"
          onclick="var d=this.querySelector('.shadow-detail');d.classList.toggle('expanded');"
          title="Click to expand">
        <div style="display:flex;justify-content:space-between;align-items:center">
          <div class="shadow-site">${escHtml(site)}</div>
          <div style="font-size:10px;color:#64748b">
            ${info.count} call${info.count > 1 ? "s" : ""} · ${formatDate(info.lastSeen)} ▾
          </div>
        </div>
        <div class="shadow-detail">${escHtml(info.detail)}</div>
      </li>`).join("");
  }
  async function renderAgentTab() {
    const resp = await chrome.runtime.sendMessage({ type: "GET_AUDIT_LOG" });
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
    const lockedEl = document.getElementById("agent-locked-notice");
    if (lockedEl) {
      lockedEl.style.display = agentEvents.length === 0 ? "block" : "none";
    }
    const listEl = document.getElementById("agent-events");
    if (!listEl) return;
    if (agentEvents.length === 0) {
      listEl.innerHTML = `
      <li style="font-size:11px;color:#64748b;padding:8px 0;line-height:1.6">
        No agent events recorded yet.<br>
        Agent Cage monitors AI tool calls in real-time.
      </li>`;
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
        <div style="color:#64748b;font-size:10px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">
          ${escHtml(e.detail ?? "")}
        </div>
      </li>`;
    }).join("");
  }
  async function exportCSV() {
    const resp = await chrome.runtime.sendMessage(
      { type: "EXPORT_AUDIT_CSV" }
    );
    if (!(resp == null ? void 0 : resp.csv)) {
      alert("Audit log is empty — protect some data first, then export.");
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
  async function checkForUpdates(installedVersion) {
    var _a;
    try {
      const res = await fetch(VERSION_URL, { cache: "no-store" });
      if (!res.ok) return;
      const data = await res.json();
      const latest = data.version ?? "";
      if (!latest || latest === installedVersion) return;
      const toNum = (v) => v.split(".").map(Number);
      const [iMaj, iMin, iPat] = toNum(installedVersion);
      const [lMaj, lMin, lPat] = toNum(latest);
      const isNewer = lMaj > iMaj || lMaj === iMaj && lMin > iMin || lMaj === iMaj && lMin === iMin && lPat > iPat;
      if (!isNewer) return;
      const badge = document.getElementById("update-badge");
      if (badge) {
        badge.textContent = `🆕 v${latest} available`;
        badge.classList.add("show");
        badge.addEventListener("click", () => {
          void chrome.tabs.create({ url: data.releaseUrl ?? RELEASES_URL });
        });
      }
      const notice = document.createElement("div");
      notice.id = "update-notice";
      notice.style.cssText = [
        "margin:8px 12px 0",
        "background:#eff6ff",
        "border:1px solid #bfdbfe",
        "border-radius:8px",
        "padding:8px 12px",
        "font-size:11px",
        "color:#1e40af",
        "display:flex",
        "align-items:center",
        "justify-content:space-between",
        "gap:8px"
      ].join(";");
      notice.innerHTML = `
      <span>🆕 <strong>v${latest}</strong> is available — you have v${installedVersion}</span>
      <button id="update-now-btn"
              style="background:#1d4ed8;color:#fff;border:none;border-radius:6px;
                     padding:4px 10px;font-size:10px;font-weight:700;cursor:pointer;
                     white-space:nowrap">
        Update now →
      </button>`;
      const statusPill = document.getElementById("status-text");
      statusPill == null ? void 0 : statusPill.insertAdjacentElement("afterend", notice);
      (_a = document.getElementById("update-now-btn")) == null ? void 0 : _a.addEventListener("click", () => {
        void chrome.tabs.create({ url: data.releaseUrl ?? RELEASES_URL });
      });
    } catch {
    }
  }
  document.addEventListener("DOMContentLoaded", () => {
    var _a, _b, _c, _d, _e, _f;
    let installedVersion = "0.6.0";
    try {
      const manifest = chrome.runtime.getManifest();
      installedVersion = manifest.version;
      const vEl = document.getElementById("popup-version");
      if (vEl) vEl.textContent = `v${installedVersion}`;
    } catch {
    }
    void checkForUpdates(installedVersion);
    const upgradeLink = document.getElementById("upgrade-link");
    if (upgradeLink) {
      upgradeLink.href = UPGRADE_URL;
      upgradeLink.target = "_blank";
      upgradeLink.rel = "noopener noreferrer";
      upgradeLink.addEventListener("click", (e) => {
        e.preventDefault();
        openUpgrade();
      });
    }
    (_a = document.getElementById("upgrade-banner-btn")) == null ? void 0 : _a.addEventListener("click", openUpgrade);
    (_b = document.getElementById("agent-upgrade-btn")) == null ? void 0 : _b.addEventListener("click", openUpgrade);
    (_c = document.getElementById("tab-overview")) == null ? void 0 : _c.addEventListener("click", () => {
      activateTab("overview");
      void renderOverview();
    });
    (_d = document.getElementById("tab-shadow")) == null ? void 0 : _d.addEventListener("click", () => {
      activateTab("shadow");
      void renderShadowAi();
    });
    (_e = document.getElementById("tab-agent")) == null ? void 0 : _e.addEventListener("click", () => {
      activateTab("agent");
      void renderAgentTab();
    });
    (_f = document.getElementById("export-btn")) == null ? void 0 : _f.addEventListener("click", () => void exportCSV());
    activateTab("overview");
    void renderOverview();
  });
})();
