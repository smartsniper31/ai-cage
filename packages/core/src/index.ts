/**
 * @file index.ts
 * Public API for @ai-cage/core — v0.3.0
 *
 * This is the only module consumers (extension, desktop, VS Code, CLI) import.
 */

// ── Caging engine (Phase 1) ──────────────────────────────────────────────
export { cageText, uncageText, summariseCaged } from './cage.js';
export type { CageResult, CagedEntity, CageOptions } from './types.js';

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
  clearAuditLog,
  getClearHistory,
  localStorageAdapter,
  createMemoryAdapter,
} from './auditLog.js';
export type {
  AuditEntry,
  AuditEventType,
  StorageAdapter,
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

// ── Re-export EntityType ──────────────────────────────────────────────────
export type { EntityType } from '@ai-cage/presidio-lite';
