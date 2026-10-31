/**
 * @file extension.ts
 * AI CAGE VS Code Extension — Cage 4: Code Leak Protection.
 *
 * WHAT IT DOES:
 *   1. Scans code files on save for PII, secrets, and credentials.
 *   2. Shows inline diagnostic warnings (squiggly lines) for each finding.
 *   3. Provides a "Cage Selection" command — replaces selected PII with tokens,
 *      so you can safely paste the caged text into GitHub Copilot Chat or ChatGPT.
 *   4. Writes an immutable local audit log (VS Code globalState).
 *
 * SECURITY CONTRACT:
 *   - NEVER calls fetch(), http, or any network API.
 *   - All detection runs inside the VS Code extension host process — local only.
 *   - No telemetry. No reporting to any server including ours.
 *   - Original PII values are NEVER written to the audit log.
 *
 * SUPPORTED FILE TYPES (configurable via aiCage.fileGlob):
 *   .ts .js .py .env .json .yaml .yml .tf .sh .rb .go .java .cs .php .rs .toml .ini .conf
 */

import * as vscode from 'vscode';
import { cageText, logEvent, createMemoryAdapter } from '@ai-cage/core';
import { scanText } from '@ai-cage/presidio-lite';
import type { StorageAdapter, AuditEntry } from '@ai-cage/core';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const EXTENSION_ID   = 'ai-cage';
const DIAGNOSTIC_SRC = 'AI CAGE';

/** Entity types that should produce ERROR severity (must-fix). */
const CRITICAL_TYPES = new Set(['PRIVATE_KEY', 'API_KEY', 'GENERIC_SECRET']);
/** Entity types that produce WARNING severity. */
const HIGH_TYPES     = new Set(['CREDIT_CARD', 'IBAN', 'RIB_TN', 'MF_TN', 'PASSPORT_TN']);

// ---------------------------------------------------------------------------
// VS Code storage adapter — wraps ExtensionContext.globalState
// ---------------------------------------------------------------------------

function createVSCodeStorageAdapter(context: vscode.ExtensionContext): StorageAdapter {
  return {
    async getItem(key: string): Promise<string | null> {
      const val = context.globalState.get<string>(key);
      return val ?? null;
    },
    async setItem(key: string, value: string): Promise<void> {
      await context.globalState.update(key, value);
    },
  };
}

// ---------------------------------------------------------------------------
// Diagnostics
// ---------------------------------------------------------------------------

let diagnosticCollection: vscode.DiagnosticCollection;

/**
 * Scans a document and populates the diagnostic collection.
 */
async function scanDocument(
  document: vscode.TextDocument,
  storage: StorageAdapter,
): Promise<void> {
  const config    = vscode.workspace.getConfiguration('aiCage');
  const minScore  = config.get<number>('minScore', 0.7);
  const critOnly  = config.get<boolean>('criticalOnly', false);

  const text    = document.getText();
  const matches = scanText(text, { minScore });

  if (matches.length === 0) {
    diagnosticCollection.set(document.uri, []);
    return;
  }

  const diagnostics: vscode.Diagnostic[] = [];

  for (const match of matches) {
    if (critOnly && !CRITICAL_TYPES.has(match.type)) continue;

    // Calculate VS Code Range from character offsets
    const startPos = document.positionAt(match.start);
    const endPos   = document.positionAt(match.end);
    const range    = new vscode.Range(startPos, endPos);

    const severity = CRITICAL_TYPES.has(match.type)
      ? vscode.DiagnosticSeverity.Error
      : HIGH_TYPES.has(match.type)
        ? vscode.DiagnosticSeverity.Warning
        : vscode.DiagnosticSeverity.Information;

    const diag = new vscode.Diagnostic(
      range,
      `🔒 AI CAGE: ${match.type} detected (confidence ${(match.score * 100).toFixed(0)}%). ` +
      `This will be caged if you paste to an AI assistant. ` +
      `Run "AI CAGE: Cage Selection" to replace with a safe token.`,
      severity,
    );
    diag.source = DIAGNOSTIC_SRC;
    diag.code   = match.type;

    diagnostics.push(diag);
  }

  diagnosticCollection.set(document.uri, diagnostics);

  // Log to audit trail (no original values)
  if (matches.length > 0) {
    const counts: Record<string, number> = {};
    for (const m of matches) counts[m.type] = (counts[m.type] ?? 0) + 1;
    const site = vscode.workspace.asRelativePath(document.uri);
    await logEvent(
      { type: 'CODE_SCAN', site, counts, totalCount: matches.length },
      storage,
    );
  }
}

// ---------------------------------------------------------------------------
// Commands
// ---------------------------------------------------------------------------

/**
 * "AI CAGE: Scan Current File" command.
 */
async function cmdScanCurrentFile(storage: StorageAdapter): Promise<void> {
  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    void vscode.window.showWarningMessage('AI CAGE: No active editor.');
    return;
  }
  await scanDocument(editor.document, storage);
  const count = diagnosticCollection.get(editor.document.uri)?.length ?? 0;
  if (count === 0) {
    void vscode.window.showInformationMessage('✅ AI CAGE: No PII or secrets detected.');
  } else {
    void vscode.window.showWarningMessage(
      `🔒 AI CAGE: ${count} PII/secret item(s) detected. See Problems panel.`,
      'Show Problems',
    ).then((sel) => {
      if (sel === 'Show Problems') {
        void vscode.commands.executeCommand('workbench.action.problems.focus');
      }
    });
  }
}

/**
 * "AI CAGE: Cage Selected Text" command.
 * Replaces selected text with caged tokens, copies original mapping to clipboard JSON.
 */
async function cmdCageSelection(storage: StorageAdapter): Promise<void> {
  const editor = vscode.window.activeTextEditor;
  if (!editor || editor.selection.isEmpty) {
    void vscode.window.showWarningMessage('AI CAGE: Please select text to cage.');
    return;
  }

  const selected = editor.document.getText(editor.selection);
  const { cagedText, entities, totalCaged } = cageText(selected);

  if (totalCaged === 0) {
    void vscode.window.showInformationMessage('✅ AI CAGE: No PII detected in selection.');
    return;
  }

  // Replace selection with caged text
  await editor.edit((builder) => {
    builder.replace(editor.selection, cagedText);
  });

  // Copy the entity map (tokens only, no originals) to clipboard as a reminder
  const tokenMap = entities.map((e) => `${e.placeholder} = [${e.type}]`).join('\n');
  await vscode.env.clipboard.writeText(
    `AI CAGE tokens (keep these to restore):\n${tokenMap}\n\nCaged text:\n${cagedText}`,
  );

  // Log (no original values)
  const counts: Record<string, number> = {};
  for (const e of entities) counts[e.type] = (counts[e.type] ?? 0) + 1;
  await logEvent(
    {
      type: 'PII_CAGED',
      site: vscode.workspace.asRelativePath(editor.document.uri),
      counts,
      totalCount: totalCaged,
    },
    storage,
  );

  void vscode.window.showInformationMessage(
    `🔒 AI CAGE: ${totalCaged} item(s) caged. Token map copied to clipboard.`,
  );
}

/**
 * "AI CAGE: Show Audit Log" command.
 * Opens a virtual document with the last 100 audit entries.
 */
function cmdShowAuditLog(context: vscode.ExtensionContext): void {
  const panel = vscode.window.createWebviewPanel(
    'ai-cage.auditLog',
    '🔒 AI CAGE — Audit Log',
    vscode.ViewColumn.Beside,
    { enableScripts: false },
  );

  const storage = createVSCodeStorageAdapter(context);
  void (async () => {
    const { getAuditLog, exportAuditLogCSV } = await import('@ai-cage/core');
    const entries: AuditEntry[] = await getAuditLog(storage);
    const csv = await exportAuditLogCSV(storage);

    const rows = [...entries].reverse().slice(0, 100).map((e) => `
      <tr>
        <td>${escHtml(formatDate(e.timestamp))}</td>
        <td><span class="badge">${escHtml(e.type)}</span></td>
        <td>${escHtml(e.site)}</td>
        <td>${e.totalCount}</td>
        <td>${escHtml(e.detail ?? formatCounts(e.counts))}</td>
      </tr>`).join('');

    panel.webview.html = buildAuditHtml(rows, entries.length, csv);
  })();
}

// ---------------------------------------------------------------------------
// Auto-scan on save
// ---------------------------------------------------------------------------

function registerOnSaveListener(
  context: vscode.ExtensionContext,
  storage: StorageAdapter,
): vscode.Disposable {
  return vscode.workspace.onDidSaveTextDocument(async (document) => {
    const config   = vscode.workspace.getConfiguration('aiCage');
    const enabled  = config.get<boolean>('enableOnSave', true);
    const glob     = config.get<string>('fileGlob', '**/*.{ts,js,py,env,json,yaml,yml,tf,sh}');

    if (!enabled) return;

    // Simple glob check using VS Code's built-in minimatch
    const relPath = vscode.workspace.asRelativePath(document.uri);
    const matched = await vscode.workspace.findFiles(glob, '**/node_modules/**', 1);
    const isMatch = matched.some((f) => f.fsPath === document.uri.fsPath) ||
                    isCodeFile(document.languageId);

    if (!isMatch) return;

    await scanDocument(document, storage);

    // Show status bar flash
    const count = diagnosticCollection.get(document.uri)?.length ?? 0;
    if (count > 0) {
      void vscode.window.setStatusBarMessage(
        `🔒 AI CAGE: ${count} PII item(s) detected — see Problems panel`,
        5000,
      );
    }
  });
}

// ---------------------------------------------------------------------------
// Extension activate / deactivate
// ---------------------------------------------------------------------------

export function activate(context: vscode.ExtensionContext): void {
  // Use a fallback in-memory adapter if globalState fails
  const storage: StorageAdapter = (() => {
    try {
      return createVSCodeStorageAdapter(context);
    } catch {
      return createMemoryAdapter();
    }
  })();

  diagnosticCollection = vscode.languages.createDiagnosticCollection(EXTENSION_ID);
  context.subscriptions.push(diagnosticCollection);

  // Register commands
  context.subscriptions.push(
    vscode.commands.registerCommand(
      'ai-cage.scanCurrentFile',
      () => void cmdScanCurrentFile(storage),
    ),
    vscode.commands.registerCommand(
      'ai-cage.cageSelection',
      () => void cmdCageSelection(storage),
    ),
    vscode.commands.registerCommand(
      'ai-cage.showAuditLog',
      () => cmdShowAuditLog(context),
    ),
    vscode.commands.registerCommand(
      'ai-cage.clearDiagnostics',
      () => diagnosticCollection.clear(),
    ),
    registerOnSaveListener(context, storage),
  );

  // Status bar item
  const statusBarItem = vscode.window.createStatusBarItem(
    vscode.StatusBarAlignment.Right,
    100,
  );
  statusBarItem.text  = '$(shield) AI CAGE';
  statusBarItem.tooltip = 'AI CAGE: Code Leak Protection Active';
  statusBarItem.command = 'ai-cage.scanCurrentFile';
  statusBarItem.show();
  context.subscriptions.push(statusBarItem);

  void vscode.window.setStatusBarMessage('🔒 AI CAGE: Code Leak Protection active.', 3000);
}

export function deactivate(): void {
  diagnosticCollection?.dispose();
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function isCodeFile(langId: string): boolean {
  const CODE_LANGS = new Set([
    'typescript','javascript','python','shellscript','json','yaml',
    'terraform','ruby','go','java','csharp','php','rust','toml',
    'ini','properties','dotenv','plaintext',
  ]);
  return CODE_LANGS.has(langId);
}

function escHtml(s: string): string {
  return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

function formatDate(iso: string): string {
  try { return new Date(iso).toLocaleString(); } catch { return iso; }
}

function formatCounts(counts: Record<string, number>): string {
  return Object.entries(counts).map(([k,v]) => `${k}:${v}`).join(', ');
}

function buildAuditHtml(rows: string, total: number, csv: string): string {
  const csvEncoded = encodeURIComponent(csv);
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<style>
  body { font-family: var(--vscode-font-family); font-size: 13px; color: var(--vscode-foreground); background: var(--vscode-editor-background); padding: 16px; }
  h1 { font-size: 16px; margin-bottom: 4px; }
  p  { color: var(--vscode-descriptionForeground); margin-bottom: 12px; font-size: 12px; }
  table { width: 100%; border-collapse: collapse; }
  th { text-align: left; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; color: var(--vscode-descriptionForeground); padding: 6px 8px; border-bottom: 1px solid var(--vscode-panel-border); }
  td { padding: 5px 8px; border-bottom: 1px solid var(--vscode-panel-border); font-size: 12px; }
  .badge { background: var(--vscode-badge-background); color: var(--vscode-badge-foreground); border-radius: 3px; padding: 1px 5px; font-size: 10px; font-weight: 700; }
  a { color: var(--vscode-textLink-foreground); }
</style>
</head>
<body>
<h1>🔒 AI CAGE — Audit Log</h1>
<p>${total} total entries. Last 100 shown. No original PII values are stored.
  <a href="data:text/csv;charset=utf-8,${csvEncoded}" download="ai-cage-audit.csv">Download CSV</a>
</p>
<table>
  <thead><tr><th>Time</th><th>Event</th><th>File/Site</th><th>Count</th><th>Detail</th></tr></thead>
  <tbody>${rows || '<tr><td colspan="5" style="text-align:center;padding:20px">No events recorded yet.</td></tr>'}</tbody>
</table>
</body>
</html>`;
}
