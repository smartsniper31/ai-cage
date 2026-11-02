// Copyright (c) 2026 Frikha, Tunisia. All rights reserved.
// AI CAGE — Enterprise AI Data Protection
// https://github.com/smartsniper31/ai-cage
// Licensed under Business Source License 1.1 — see LICENSE for details.
// Commercial use requires a license: contact@ai-cage.io

/**
 * @file policy.ts
 * AI CAGE Agent Policy Engine — Cage 3: Agent Rogue.
 *
 * The policy engine defines WHAT an AI agent is allowed to do.
 * It is the authorisation layer that sits in front of every tool call.
 *
 * DESIGN PRINCIPLES:
 *   - Default-deny: anything not explicitly allowed is blocked.
 *   - Least privilege: the default PME policy allows only safe read operations.
 *   - Human-in-the-loop: dangerous operations require explicit approval.
 *   - Persistent: policies survive page reloads via StorageAdapter.
 *   - Zero network: no policy is fetched from any server.
 *
 * SECURITY CONTRACT:
 *   - NEVER calls fetch(), XMLHttpRequest, or any network primitive.
 *   - Policy is stored locally only (localStorage / chrome.storage.local).
 *   - Changing a policy is always logged to the audit trail.
 */

import type { StorageAdapter } from './auditLog.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * Risk tier for a tool. Determines default handling.
 */
export type ToolRiskTier =
  | 'safe'       // Always allow — read-only, no side effects
  | 'moderate'   // Require policy check, may need approval
  | 'dangerous'  // Require explicit human approval every time
  | 'blocked';   // Never allow under any policy

/**
 * The outcome of a policy check.
 */
export type PolicyDecision =
  | 'ALLOWED'           // Tool call is permitted, proceed
  | 'NEEDS_APPROVAL'    // Tool call requires human confirmation
  | 'BLOCKED'           // Tool call is denied by policy
  | 'BLOCKED_INJECTION' // Tool call blocked because arguments contain injection
  | 'BLOCKED_DOMAIN';   // Blocked because target domain is not whitelisted

/**
 * A single tool permission entry in the policy.
 */
export interface ToolPermission {
  /** Exact tool name or glob pattern (e.g. "read_file", "write_*"). */
  tool: string;
  /** How this tool is handled by default. */
  decision: PolicyDecision;
  /** Optional human-readable note shown in approval dialogs. */
  note?: string;
}

/**
 * The full agent policy for a workspace or user.
 */
export interface AgentPolicy {
  /** Policy schema version — for future migrations. */
  version: 1;
  /** Human-readable policy name (e.g. "PME Default", "Dev Workstation"). */
  name: string;
  /**
   * Tools that are explicitly allowed without any approval.
   * Supports exact names. Anything not listed defaults to NEEDS_APPROVAL.
   */
  allowedTools: string[];
  /**
   * Tools that require human approval before each execution.
   * Takes precedence over allowedTools.
   */
  requireApprovalFor: string[];
  /**
   * Tools that are completely blocked regardless of anything else.
   * Takes precedence over requireApprovalFor and allowedTools.
   */
  blockedTools: string[];
  /**
   * Allowed external domains for tool calls that make network requests.
   * Empty array = block ALL external domains (default — safest).
   * Use "*" as sole entry to allow all (not recommended).
   */
  allowedDomains: string[];
  /**
   * If true, scan all tool call arguments for prompt injection.
   * Block automatically if injection is detected.
   * @default true
   */
  blockInjections: boolean;
  /**
   * If true, log every tool call (allowed or blocked) to the audit log.
   * @default true
   */
  auditAllCalls: boolean;
  /**
   * ISO 8601 timestamp when this policy was last modified.
   */
  lastModified: string;
}

// ---------------------------------------------------------------------------
// Default policies
// ---------------------------------------------------------------------------

/**
 * The default PME policy — conservative, human-in-the-loop for anything
 * that has side effects.
 *
 * Philosophy:
 *   "If in doubt, ask. If dangerous, block."
 */
export function getDefaultPolicy(): AgentPolicy {
  return {
    version: 1,
    name: 'PME Default (Conservative)',
    allowedTools: [
      // Read-only, no side effects
      'read_file',
      'search',
      'search_web',
      'summarize',
      'list_files',
      'get_weather',
      'calculate',
      'translate',
      'explain',
      'analyze',
      'review_code',
    ],
    requireApprovalFor: [
      // Side effects — require human confirmation
      'send_email',
      'write_file',
      'create_file',
      'edit_file',
      'delete_file',
      'move_file',
      'external_fetch',
      'api_call',
      'post_message',
      'create_issue',
      'update_record',
      'insert_record',
      'run_query',
      'execute_code',
      'run_script',
      'install_package',
      'deploy',
      'push_code',
    ],
    blockedTools: [
      // Never allowed — zero exceptions
      'rm',
      'delete_all',
      'format_disk',
      'shutdown',
      'reboot',
      'sudo',
      'exec',
      'shell',
      'terminal',
      'system_call',
      'override_policy',
      'disable_cage',
    ],
    allowedDomains: [],   // Block all external domains by default
    blockInjections: true,
    auditAllCalls: true,
    lastModified: new Date().toISOString(),
  };
}

/**
 * A permissive policy for development/testing environments.
 * Still blocks genuinely dangerous tools.
 */
export function getDevPolicy(): AgentPolicy {
  return {
    version: 1,
    name: 'Development (Permissive)',
    allowedTools: [
      'read_file', 'write_file', 'create_file', 'edit_file',
      'list_files', 'search', 'search_web', 'summarize',
      'execute_code', 'run_script', 'run_query', 'api_call',
      'external_fetch', 'install_package',
    ],
    requireApprovalFor: [
      'send_email', 'delete_file', 'push_code', 'deploy',
    ],
    blockedTools: [
      'rm', 'delete_all', 'format_disk', 'shutdown',
      'reboot', 'sudo', 'disable_cage',
    ],
    allowedDomains: ['*'],  // All domains allowed in dev
    blockInjections: true,
    auditAllCalls: true,
    lastModified: new Date().toISOString(),
  };
}

// ---------------------------------------------------------------------------
// Policy evaluation
// ---------------------------------------------------------------------------

/**
 * Evaluates what decision applies to a given tool name under a policy.
 * Precedence: blockedTools > requireApprovalFor > allowedTools > NEEDS_APPROVAL
 *
 * @param toolName - Exact tool name to check.
 * @param policy   - The active policy to evaluate against.
 * @returns The policy decision for this tool.
 *
 * @example
 * ```ts
 * const decision = evaluateTool('send_email', getDefaultPolicy());
 * // 'NEEDS_APPROVAL'
 * const decision2 = evaluateTool('rm', getDefaultPolicy());
 * // 'BLOCKED'
 * const decision3 = evaluateTool('read_file', getDefaultPolicy());
 * // 'ALLOWED'
 * ```
 */
export function evaluateTool(
  toolName: string,
  policy: AgentPolicy,
): PolicyDecision {
  const name = toolName.toLowerCase().trim();

  if (policy.blockedTools.map((t) => t.toLowerCase()).includes(name)) {
    return 'BLOCKED';
  }
  if (policy.requireApprovalFor.map((t) => t.toLowerCase()).includes(name)) {
    return 'NEEDS_APPROVAL';
  }
  if (policy.allowedTools.map((t) => t.toLowerCase()).includes(name)) {
    return 'ALLOWED';
  }
  // Default-deny for anything not explicitly listed
  return 'NEEDS_APPROVAL';
}

/**
 * Checks whether a URL's hostname is permitted by the policy's domain list.
 *
 * @param url    - Full URL to check (e.g. "https://api.example.com/v1/data").
 * @param policy - Active policy.
 * @returns true if the domain is allowed, false if it should be blocked.
 */
export function isDomainAllowed(url: string, policy: AgentPolicy): boolean {
  if (policy.allowedDomains.includes('*')) return true;
  if (policy.allowedDomains.length === 0) return false;

  // Parse hostname without DOM URL API (core lib is ES2022 only, no DOM)
  const m = /^https?:\/\/([^/:?#\s]+)/i.exec(url);
  if (!m?.[1]) return false;
  const hostname = m[1].toLowerCase();

  return policy.allowedDomains.some((allowed) => {
    const a = allowed.toLowerCase();
    return hostname === a || hostname.endsWith(`.${a}`);
  });
}

// ---------------------------------------------------------------------------
// Persistence
// ---------------------------------------------------------------------------

const POLICY_KEY = 'ai-cage:agent-policy';

/**
 * Saves the current policy to the storage adapter.
 *
 * @param policy  - The policy to persist.
 * @param storage - Storage adapter (localStorage / chrome.storage.local / memory).
 */
export async function savePolicy(
  policy: AgentPolicy,
  storage: StorageAdapter,
): Promise<void> {
  const updated: AgentPolicy = {
    ...policy,
    lastModified: new Date().toISOString(),
  };
  await storage.setItem(POLICY_KEY, JSON.stringify(updated));
}

/**
 * Loads the active policy from storage.
 * Falls back to the default PME policy if no policy has been saved.
 *
 * @param storage - Storage adapter.
 * @returns The active {@link AgentPolicy}.
 */
export async function loadPolicy(storage: StorageAdapter): Promise<AgentPolicy> {
  const raw = await storage.getItem(POLICY_KEY);
  if (!raw) return getDefaultPolicy();
  try {
    return JSON.parse(raw) as AgentPolicy;
  } catch {
    return getDefaultPolicy();
  }
}

/**
 * Resets the policy to the default PME policy.
 *
 * @param storage - Storage adapter.
 */
export async function resetToDefaultPolicy(
  storage: StorageAdapter,
): Promise<AgentPolicy> {
  const policy = getDefaultPolicy();
  await savePolicy(policy, storage);
  return policy;
}
