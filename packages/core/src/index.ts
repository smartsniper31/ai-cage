/**
 * @file index.ts
 * Public API for @ai-cage/core — v0.6.0
 *
 * This is the only module consumers (extension, desktop, VS Code, CLI) import.
 */

// ── Version (single source of truth) ─────────────────────────────────────
export { VERSION } from './version.js';

// ── Caging engine (Phase 1) ──────────────────────────────────────────────
export { cageText, uncageText, summariseCaged, SESSION_SALT, detectQuasiIdentifiers } from './cage.js';
export type { CageResult, CagedEntity, CageOptions, InferenceRisk } from './types.js';

// ── Shadow AI catalogue (Phase 2) ────────────────────────────────────────
export {
  ALL_AI_ENDPOINTS,
  matchAiEndpoint,
  getEndpointsByCategory,
  getEndpointsByRisk,
} from './shadowAiList.js';
export type { AiEndpoint } from './shadowAiList.js';

// ── Audit log (Phase 2) ──────────────────────────────────────────────────
export {
  logEvent,
  getAuditLog,
  getAuditSummary,
  exportAuditLogCSV,
  generatePlainReport,
  clearAuditLog,
  getClearHistory,
  localStorageAdapter,
  createMemoryAdapter,
} from './auditLog.js';
export type {
  AuditEntry,
  AuditEventType,
  StorageAdapter,
  PlainReportOptions,
  PlainReportResult,
} from './auditLog.js';

// ── Policy engine (Phase 3) ──────────────────────────────────────────────
export {
  getDefaultPolicy,
  getDevPolicy,
  evaluateTool,
  isDomainAllowed,
  savePolicy,
  loadPolicy,
  resetToDefaultPolicy,
} from './policy.js';
export type {
  AgentPolicy,
  PolicyDecision,
  ToolRiskTier,
  ToolPermission,
} from './policy.js';

// ── Agent cage engine (Phase 3) ──────────────────────────────────────────
export { cageAgentOutput, cageToolCall } from './agentCage.js';
export type {
  AgentCageResult,
  AgentOutputCageOptions,
  ToolCageResult,
} from './agentCage.js';

// ── MCP monitor (Phase 3) ────────────────────────────────────────────────
export {
  parseMcpMessage,
  extractToolCall,
  auditMcpCall,
  buildMcpBlockedResponse,
  HIGH_RISK_MCP_TOOLS,
} from './mcpMonitor.js';
export type {
  McpRequest,
  McpResponse,
  McpMessage,
  McpToolCall,
  McpAuditResult,
} from './mcpMonitor.js';

// ── Licensing engine (Phase 4) ───────────────────────────────────────────
export {
  checkLicense,
  activateLicense,
  deactivateLicense,
  generateLicenseKey,
  parseLicenseKey,
  generateDemoLicense,
  getTierFeatures,
} from './license.js';
export type {
  LicenseTier,
  LicenseStatus,
  LicenseFeatures,
  LicensePayload,
  LicenseInfo,
} from './license.js';

// ── Cage 5: Voice/Video transcript caging (Phase 4) ──────────────────────
export { cageTranscript, uncageTranscript } from './cageTranscript.js';
export type { TranscriptCageResult } from './cageTranscript.js';

// ── Re-export EntityType ──────────────────────────────────────────────────
export type { EntityType } from '@ai-cage/presidio-lite';
