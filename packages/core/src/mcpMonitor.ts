/**
 * @file mcpMonitor.ts
 * MCP (Model Context Protocol) Monitor — Cage 3: Agent Rogue.
 *
 * MCP is the protocol used by Claude Desktop, VS Code agents, and other
 * AI tools to call local tools (read_file, shell, browser, etc.).
 * It uses JSON-RPC 2.0 over stdio or SSE.
 *
 * This module intercepts MCP JSON-RPC messages BEFORE they are forwarded
 * to the local tool host, allowing AI CAGE to:
 *   1. Parse the tool call
 *   2. Scan arguments for prompt injection
 *   3. Apply the agent policy
 *   4. Log the audit event
 *   5. Return a structured result that the caller uses to allow/block
 *
 * SECURITY CONTRACT:
 *   - NEVER calls fetch(), XMLHttpRequest, or any network primitive.
 *   - Never stores tool argument values in the audit log.
 *   - All parsing is defensive — malformed JSON is handled gracefully.
 *
 * JSON-RPC 2.0 / MCP message format:
 *   Request:  { jsonrpc: "2.0", id: 1, method: "tools/call",
 *               params: { name: "read_file", arguments: { path: "/etc/passwd" } } }
 *   Response: { jsonrpc: "2.0", id: 1, result: { content: [...] } }
 *   Error:    { jsonrpc: "2.0", id: 1, error: { code: -32600, message: "..." } }
 */

import { scanForInjection, isCriticalInjection } from '@ai-cage/presidio-lite';
import type { InjectionMatch } from '@ai-cage/presidio-lite';
import { logEvent } from './auditLog.js';
import type { StorageAdapter } from './auditLog.js';
import { evaluateTool } from './policy.js';
import type { AgentPolicy, PolicyDecision } from './policy.js';

// ---------------------------------------------------------------------------
// MCP message types (subset used by Cage 3)
// ---------------------------------------------------------------------------

export interface McpRequest {
  jsonrpc: '2.0';
  id: number | string;
  method: string;
  params?: Record<string, unknown>;
}

export interface McpResponse {
  jsonrpc: '2.0';
  id: number | string;
  result?: unknown;
  error?: { code: number; message: string; data?: unknown };
}

export type McpMessage = McpRequest | McpResponse;

/** Parsed tool call extracted from an MCP tools/call request. */
export interface McpToolCall {
  /** The tool name (e.g. "read_file", "shell", "browser_navigate"). */
  name: string;
  /** The raw arguments object. */
  arguments: Record<string, unknown>;
  /** Original JSON-RPC id for correlation. */
  requestId: number | string;
}

// ---------------------------------------------------------------------------
// Audit result
// ---------------------------------------------------------------------------

/**
 * The result of auditing a single MCP message.
 */
export interface McpAuditResult {
  /** The parsed tool call, if this was a tools/call message. */
  toolCall: McpToolCall | null;
  /** The policy decision. */
  decision: PolicyDecision | 'NOT_A_TOOL_CALL' | 'PARSE_ERROR';
  /** Whether the tool call should be blocked. */
  blocked: boolean;
  /** Any injection matches found in the tool arguments. */
  injections: InjectionMatch[];
  /** Human-readable reason for the decision. */
  reason: string;
  /** Audit log entry id, or undefined if no storage provided. */
  auditId?: number | undefined;
  /** ISO timestamp of the audit event. */
  timestamp: string;
}

// ---------------------------------------------------------------------------
// Known high-risk MCP tool names
// ---------------------------------------------------------------------------

/**
 * MCP tools that are considered high-risk regardless of policy.
 * These map to common MCP server implementations (filesystem, shell, browser).
 */
export const HIGH_RISK_MCP_TOOLS: ReadonlySet<string> = new Set([
  // Filesystem (MCP filesystem server)
  'read_file', 'write_file', 'create_file', 'delete_file',
  'move_file', 'copy_file', 'list_directory', 'make_directory',

  // Shell execution (MCP shell server)
  'run_command', 'execute_command', 'shell', 'bash', 'powershell',
  'run_script', 'execute_code',

  // Browser control (Puppeteer / Playwright MCP servers)
  'browser_navigate', 'browser_click', 'browser_type', 'browser_screenshot',
  'puppeteer_navigate', 'playwright_navigate',

  // Network (fetch MCP server)
  'fetch', 'http_request', 'curl',

  // Git
  'git_commit', 'git_push', 'git_clone',

  // Email (SMTP MCP server)
  'send_email', 'send_message',

  // Database
  'execute_query', 'run_query', 'db_query',
]);

// ---------------------------------------------------------------------------
// Core parsing
// ---------------------------------------------------------------------------

/**
 * Parses a raw JSON-RPC string into an McpMessage.
 * Returns null if parsing fails.
 *
 * @param raw - Raw string received from MCP stdio/SSE stream.
 */
export function parseMcpMessage(raw: string): McpMessage | null {
  if (!raw || !raw.trim()) return null;

  try {
    const parsed: unknown = JSON.parse(raw.trim());
    if (typeof parsed !== 'object' || parsed === null) return null;

    const obj = parsed as Record<string, unknown>;
    if (obj['jsonrpc'] !== '2.0') return null;

    return obj as unknown as McpMessage;
  } catch {
    return null;
  }
}

/**
 * Extracts the tool call from an MCP tools/call request.
 * Returns null if the message is not a tools/call.
 */
export function extractToolCall(msg: McpMessage): McpToolCall | null {
  if (!('method' in msg)) return null;          // It's a response, not a request
  const req = msg as McpRequest;
  if (req.method !== 'tools/call') return null;

  const params = req.params;
  if (!params) return null;

  const name = params['name'];
  if (typeof name !== 'string' || !name.trim()) return null;

  const rawArgs = params['arguments'];
  const args: Record<string, unknown> =
    rawArgs && typeof rawArgs === 'object' && !Array.isArray(rawArgs)
      ? (rawArgs as Record<string, unknown>)
      : {};

  return {
    name:       name.trim(),
    arguments:  args,
    requestId:  (req as McpRequest).id,
  };
}

// ---------------------------------------------------------------------------
// auditMcpCall()
// ---------------------------------------------------------------------------

/**
 * Audits a raw MCP message string.
 *
 * This is the main entry point. It:
 *   1. Parses the JSON-RPC message
 *   2. Extracts the tool call (if any)
 *   3. Scans arguments for prompt injection
 *   4. Applies the agent policy
 *   5. Logs to audit trail (no arg values stored)
 *   6. Returns a structured {@link McpAuditResult}
 *
 * @param raw     - Raw MCP message string (single JSON-RPC object).
 * @param policy  - The active agent policy.
 * @param storage - Optional storage adapter for audit logging.
 * @returns {@link McpAuditResult}
 *
 * @example
 * ```ts
 * const raw = JSON.stringify({
 *   jsonrpc: '2.0', id: 1, method: 'tools/call',
 *   params: { name: 'read_file', arguments: { path: '/etc/passwd' } }
 * });
 * const result = await auditMcpCall(raw, getDefaultPolicy(), adapter);
 * // result.blocked  === true  (path /etc/passwd triggers injection scan)
 * // result.decision === 'BLOCKED_INJECTION'
 * ```
 */
export async function auditMcpCall(
  raw: string,
  policy: AgentPolicy,
  storage?: StorageAdapter,
): Promise<McpAuditResult> {
  const timestamp = new Date().toISOString();

  // ── Parse ─────────────────────────────────────────────────────────────────
  const msg = parseMcpMessage(raw);
  if (!msg) {
    return {
      toolCall: null, decision: 'PARSE_ERROR',
      blocked: false, injections: [], reason: 'Could not parse MCP message.',
      timestamp,
    };
  }

  // ── Extract tool call ─────────────────────────────────────────────────────
  const toolCall = extractToolCall(msg);
  if (!toolCall) {
    return {
      toolCall: null, decision: 'NOT_A_TOOL_CALL',
      blocked: false, injections: [], reason: 'Message is not a tools/call request.',
      timestamp,
    };
  }

  // ── Serialise args for scanning (never stored) ────────────────────────────
  let argsText = '';
  try { argsText = JSON.stringify(toolCall.arguments); } catch { argsText = ''; }

  // ── Injection scan ────────────────────────────────────────────────────────
  const injections = policy.blockInjections
    ? scanForInjection(argsText, { minConfidence: 0.85 })
    : [];

  // ── Policy decision ───────────────────────────────────────────────────────
  let decision: PolicyDecision = evaluateTool(toolCall.name, policy);

  if (injections.length > 0 && isCriticalInjection(injections)) {
    decision = 'BLOCKED_INJECTION';
  }

  const blocked =
    decision === 'BLOCKED' ||
    decision === 'BLOCKED_INJECTION' ||
    decision === 'BLOCKED_DOMAIN';

  // ── Reason ────────────────────────────────────────────────────────────────
  const reasonParts: string[] = [];
  if (decision === 'BLOCKED')           reasonParts.push(`Tool "${toolCall.name}" is blocked by policy.`);
  if (decision === 'BLOCKED_INJECTION') reasonParts.push(`Injection in args: ${injections.map((i) => i.type).join(', ')}.`);
  if (decision === 'NEEDS_APPROVAL')    reasonParts.push(`Tool "${toolCall.name}" requires human approval.`);
  if (decision === 'ALLOWED')           reasonParts.push(`Tool "${toolCall.name}" is permitted by policy.`);
  if (HIGH_RISK_MCP_TOOLS.has(toolCall.name)) {
    reasonParts.push(`Note: "${toolCall.name}" is a high-risk MCP tool.`);
  }

  // ── Audit log ─────────────────────────────────────────────────────────────
  let auditId: number | undefined;
  if (storage && policy.auditAllCalls) {
    const entry = await logEvent(
      {
        type: 'AGENT_TOOL_CALL' as never,
        site: 'mcp-monitor',
        counts: {
          [toolCall.name]: 1,
          injections_found: injections.length,
          blocked: blocked ? 1 : 0,
        },
        totalCount: 1,
        detail: `mcp tool=${toolCall.name} decision=${decision} injections=${injections.length}`,
      },
      storage,
    );
    auditId = entry.id;
  }

  return {
    toolCall,
    decision,
    blocked,
    injections,
    reason: reasonParts.join(' '),
    ...(auditId !== undefined ? { auditId } : {}),
    timestamp,
  };
}

/**
 * Builds a JSON-RPC error response to send back to the MCP client
 * when a tool call is blocked.
 *
 * @param requestId  - The id from the original request.
 * @param reason     - Human-readable reason for the block.
 * @returns JSON string ready to send on the MCP channel.
 */
export function buildMcpBlockedResponse(
  requestId: number | string,
  reason: string,
): string {
  const response: McpResponse = {
    jsonrpc: '2.0',
    id: requestId,
    error: {
      code: -32000,
      message: `[AI CAGE] Tool call blocked: ${reason}`,
    },
  };
  return JSON.stringify(response);
}
