(function() {
  "use strict";
  const EMBEDDED_KEY = "ai-cage-verification-v1-7f3a9b2e8c1d4a6f";
  const FREE_FEATURES = {
    maxPiiTypes: 15,
    maxMonthlyCages: 100,
    customPolicy: false,
    auditExport: false,
    shadowAi: true,
    // Shadow AI detection is free — it's a safety feature
    agentCage: false,
    mcpMonitor: false,
    sso: false,
    siem: false,
    centralisedPolicy: false
  };
  const PRO_FEATURES = {
    maxPiiTypes: -1,
    // unlimited
    maxMonthlyCages: -1,
    customPolicy: true,
    auditExport: true,
    shadowAi: true,
    agentCage: true,
    mcpMonitor: true,
    sso: false,
    siem: false,
    centralisedPolicy: false
  };
  const ENTERPRISE_FEATURES = {
    maxPiiTypes: -1,
    maxMonthlyCages: -1,
    customPolicy: true,
    auditExport: true,
    shadowAi: true,
    agentCage: true,
    mcpMonitor: true,
    sso: true,
    siem: true,
    centralisedPolicy: true
  };
  function getTierFeatures(tier) {
    switch (tier) {
      case "FREE":
        return { ...FREE_FEATURES };
      case "PRO":
        return { ...PRO_FEATURES };
      case "ENTERPRISE":
        return { ...ENTERPRISE_FEATURES };
    }
  }
  function base64UrlDecode(str) {
    let s = str.replace(/-/g, "+").replace(/_/g, "/");
    while (s.length % 4) s += "=";
    return atobSafe(s);
  }
  function atobSafe(str) {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
    const lookup = /* @__PURE__ */ new Map();
    for (let i = 0; i < chars.length; i++) {
      lookup.set(chars[i] ?? "", i);
    }
    let result = "";
    let buffer = 0;
    let bits = 0;
    for (const ch of str) {
      if (ch === "=") break;
      const val = lookup.get(ch);
      if (val === void 0) continue;
      buffer = buffer << 6 | val;
      bits += 6;
      if (bits >= 8) {
        bits -= 8;
        result += String.fromCharCode(buffer >> bits & 255);
      }
    }
    return result;
  }
  function djb2Hash(str) {
    let hash = 5381;
    for (let i = 0; i < str.length; i++) {
      hash = (hash << 5) + hash + str.charCodeAt(i) | 0;
    }
    return (hash >>> 0).toString(16).padStart(8, "0");
  }
  function computeSignature(payloadB64) {
    return djb2Hash(payloadB64 + EMBEDDED_KEY);
  }
  function parseLicenseKey(key) {
    if (!key || !key.includes(".")) return null;
    const parts = key.split(".");
    if (parts.length !== 2) return null;
    const [payloadB64Raw, sig] = parts;
    if (!payloadB64Raw || !sig) return null;
    const payloadB64 = payloadB64Raw;
    const expectedSig = computeSignature(payloadB64);
    if (sig !== expectedSig) return null;
    try {
      const json = base64UrlDecode(payloadB64);
      const payload = JSON.parse(json);
      if (!payload.tier || !payload.expiresAt || !payload.issuedAt) return null;
      return payload;
    } catch {
      return null;
    }
  }
  const LICENSE_KEY = "ai-cage:license-key";
  async function checkLicense(storage, monthlyCageCount) {
    const rawKey = await storage.getItem(LICENSE_KEY);
    if (!rawKey) {
      const features2 = getTierFeatures("FREE");
      return {
        status: "NONE",
        tier: "FREE",
        payload: null,
        features: features2,
        message: "Free tier active — 100 cages/month limit",
        monthlyCageCount,
        limitReached: monthlyCageCount >= features2.maxMonthlyCages
      };
    }
    const payload = parseLicenseKey(rawKey);
    if (!payload) {
      const features2 = getTierFeatures("FREE");
      return {
        status: "TAMPERED",
        tier: "FREE",
        payload: null,
        features: features2,
        message: "⚠️ License key is invalid or tampered — using free tier",
        monthlyCageCount,
        limitReached: monthlyCageCount >= features2.maxMonthlyCages
      };
    }
    const now = /* @__PURE__ */ new Date();
    const expires = new Date(payload.expiresAt);
    if (now > expires) {
      const features2 = getTierFeatures("FREE");
      return {
        status: "EXPIRED",
        tier: "FREE",
        payload,
        features: features2,
        message: `License expired on ${payload.expiresAt.slice(0, 10)} — using free tier`,
        monthlyCageCount,
        limitReached: monthlyCageCount >= features2.maxMonthlyCages
      };
    }
    const features = getTierFeatures(payload.tier);
    const limitReached = features.maxMonthlyCages > 0 && monthlyCageCount >= features.maxMonthlyCages;
    return {
      status: "VALID",
      tier: payload.tier,
      payload,
      features,
      message: `${payload.tier} license valid until ${payload.expiresAt.slice(0, 10)} — ${payload.customer}`,
      monthlyCageCount,
      limitReached
    };
  }
  async function activateLicense(key, storage) {
    const payload = parseLicenseKey(key);
    if (!payload) return false;
    if (new Date(payload.expiresAt) < /* @__PURE__ */ new Date()) return false;
    await storage.setItem(LICENSE_KEY, key);
    return true;
  }
  async function deactivateLicense(storage) {
    await storage.setItem(LICENSE_KEY, "");
  }
  const STRIPE_URL = "https://buy.stripe.com/test_4gMeVe82mf3AaGacIs9AA00";
  const RELEASES_URL = "https://github.com/smartsniper31/ai-cage/releases";
  const VERSION_URL = "https://ai-cage-gamma.vercel.app/version.json";
  const FREE_LIMIT = 100;
  const WARN_AT = 80;
  const UPGRADE_URL = STRIPE_URL;
  const chromeStorageAdapter = {
    async getItem(key) {
      const result = await chrome.storage.local.get(key);
      const val = result[key];
      return typeof val === "string" ? val : null;
    },
    async setItem(key, value) {
      await chrome.storage.local.set({ [key]: value });
    }
  };
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
      const licInfo = await checkLicense(chromeStorageAdapter, 0);
      const isPro = licInfo.tier === "PRO" || licInfo.tier === "ENTERPRISE";
      lockedEl.style.display = !isPro && agentEvents.length === 0 ? "block" : "none";
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
  async function renderAccountTab() {
    var _a;
    const resp = await chrome.runtime.sendMessage({ type: "GET_STATS", tabId: 0 }).catch(() => null);
    const monthly = (resp == null ? void 0 : resp.monthlyPiiCaged) ?? 0;
    const info = await checkLicense(chromeStorageAdapter, monthly);
    const badgeEl = document.getElementById("plan-badge");
    const detailEl = document.getElementById("plan-details");
    const activationSection = document.getElementById("activation-section");
    const proActiveSection = document.getElementById("pro-active-section");
    document.getElementById("free-progress-wrap");
    const watermark = document.getElementById("watermark");
    const freeProgressWrap = document.getElementById("free-progress-wrap");
    if (info.tier === "PRO" || info.tier === "ENTERPRISE") {
      if (badgeEl) {
        badgeEl.textContent = info.tier;
        badgeEl.className = "plan-badge pro";
      }
      if (detailEl) {
        detailEl.textContent = info.message;
      }
      if (activationSection) activationSection.style.display = "none";
      if (proActiveSection) proActiveSection.style.display = "block";
      const expiresEl = document.getElementById("pro-expires");
      if (expiresEl && info.payload) {
        const expDate = info.payload.expiresAt.slice(0, 10);
        expiresEl.textContent = `License valid until ${expDate} — ${info.payload.customer}`;
      }
      if (freeProgressWrap) freeProgressWrap.style.display = "none";
      if (watermark) watermark.style.display = "none";
      (_a = document.getElementById("upgrade-banner")) == null ? void 0 : _a.classList.remove("show");
      document.getElementById("agent-locked-notice") && (document.getElementById("agent-locked-notice").style.display = "none");
    } else {
      if (badgeEl) {
        badgeEl.textContent = info.status === "EXPIRED" ? "EXPIRED" : "FREE";
        badgeEl.className = info.status === "EXPIRED" ? "plan-badge exp" : "plan-badge free";
      }
      if (detailEl) {
        detailEl.innerHTML = info.status === "EXPIRED" ? `⚠️ Your license expired — <strong>renew to keep Pro features</strong>.` : `Free tier: <strong>${monthly} / 100</strong> cages used this month.`;
      }
      if (activationSection) activationSection.style.display = "block";
      if (proActiveSection) proActiveSection.style.display = "none";
      if (freeProgressWrap) freeProgressWrap.style.display = "block";
    }
  }
  function setLicenseMsg(text, type) {
    const el = document.getElementById("license-msg");
    if (!el) return;
    el.textContent = text;
    el.className = `license-msg show ${type}`;
  }
  function wireAccountTab() {
    var _a, _b, _c;
    (_a = document.getElementById("license-activate-btn")) == null ? void 0 : _a.addEventListener("click", async () => {
      const input = document.getElementById("license-input");
      const key = (input == null ? void 0 : input.value.trim()) ?? "";
      if (!key) {
        setLicenseMsg("Please paste your license key.", "warn");
        input == null ? void 0 : input.focus();
        return;
      }
      const btn = document.getElementById("license-activate-btn");
      btn.disabled = true;
      btn.textContent = "⏳ Validating…";
      const ok = await activateLicense(key, chromeStorageAdapter);
      if (ok) {
        input.value = "";
        input == null ? void 0 : input.classList.remove("error");
        input == null ? void 0 : input.classList.add("success");
        setLicenseMsg("✅ Pro license activated! Unlimited cages unlocked.", "ok");
        btn.textContent = "✅ Activate Pro";
        btn.disabled = false;
        await renderAccountTab();
        await renderOverview();
      } else {
        input == null ? void 0 : input.classList.add("error");
        setLicenseMsg(
          "❌ Invalid or expired key. Check your email or contact support@ai-cage.io",
          "error"
        );
        btn.textContent = "✅ Activate Pro";
        btn.disabled = false;
      }
    });
    (_b = document.getElementById("license-deactivate-btn")) == null ? void 0 : _b.addEventListener("click", async () => {
      const confirmed = confirm(
        "Remove your Pro license key? You will revert to the Free tier (100 cages/month)."
      );
      if (!confirmed) return;
      await deactivateLicense(chromeStorageAdapter);
      setLicenseMsg("License removed. You are now on the Free tier.", "warn");
      await renderAccountTab();
      await renderOverview();
    });
    (_c = document.getElementById("buy-pro-btn")) == null ? void 0 : _c.addEventListener("click", () => {
      void chrome.tabs.create({ url: STRIPE_URL });
    });
  }
  document.addEventListener("DOMContentLoaded", () => {
    var _a, _b, _c, _d, _e, _f, _g;
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
    (_f = document.getElementById("tab-account")) == null ? void 0 : _f.addEventListener("click", () => {
      activateTab("account");
      void renderAccountTab();
    });
    wireAccountTab();
    (_g = document.getElementById("export-btn")) == null ? void 0 : _g.addEventListener("click", () => void exportCSV());
    activateTab("overview");
    void renderOverview();
  });
})();
