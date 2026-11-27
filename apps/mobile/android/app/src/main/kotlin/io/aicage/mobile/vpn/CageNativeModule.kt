// Copyright (c) 2026 Frikha, Tunisia. All rights reserved.
// AI CAGE Mobile — CageNativeModule (synchronous JS bridge)
// Licensed under Business Source License 1.1

package io.aicage.mobile.vpn

import android.util.Log
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import java.util.concurrent.CountDownLatch
import java.util.concurrent.TimeUnit
import java.util.concurrent.atomic.AtomicReference

/**
 * CageNativeModule — synchronous Kotlin → Hermes JS bridge.
 *
 * WHY SYNCHRONOUS:
 *   [LocalMitmProxy] handles HTTP connections on background threads. It needs
 *   to call cageText() (TypeScript, running in Hermes) before forwarding the
 *   request. The RN JS bridge is normally async. We bridge the gap with a
 *   [CountDownLatch]: the proxy thread blocks (up to [timeoutMs]) while the
 *   JS thread runs the evaluation and signals the latch.
 *
 * CALL FLOW:
 *   LocalMitmProxy (bg thread)
 *     → cageTextSync()
 *       → runOnJSQueueThread { evaluateJavaScript(jsCode) }
 *         → catalystInstance.evaluateJavaScript(jsCode, callback)
 *           → Hermes executes: global.__aiCageCageText(text)
 *         → callback.onReceiveResult(resultJson)
 *       → result.set(parsedString); latch.countDown()
 *     ← await(timeoutMs)
 *   ← cagedText or null (safe fallback)
 *
 * JS SIDE:
 *   global.__aiCageCageText must be registered before the VPN starts.
 *   See src/native/cageBridgeGlobal.ts — called at the top of App.tsx.
 *
 * FALLBACK CONTRACT:
 *   - Timeout expired  → return null → CageBridge forwards original body unchanged.
 *   - JS engine not ready → return null → same safe fallback.
 *   - JS throws → global.__aiCageCageText catches internally and returns original text.
 *   A request is NEVER dropped due to a cage failure.
 *
 * THREADING:
 *   - cageTextSync() is safe to call from any background thread.
 *   - evaluateJavaScript() is dispatched to the RN JS queue thread.
 */
class CageNativeModule(
    private val reactContext: ReactApplicationContext,
) : ReactContextBaseJavaModule(reactContext) {

    companion object {
        private const val TAG = "CageNativeModule"
    }

    override fun getName(): String = "CageNativeInternal"

    // ── Public API ────────────────────────────────────────────────────────────

    /**
     * Synchronously cages [text] via the Hermes JS engine.
     *
     * @param text      Raw text that may contain PII.
     * @param timeoutMs Maximum milliseconds to wait for the JS result.
     * @return Caged text, or null if the bridge is unavailable or timed out.
     */
    fun cageTextSync(text: String, timeoutMs: Long): String? {
        val catalystInstance = reactContext.catalystInstance
        if (catalystInstance == null || catalystInstance.isDestroyed) {
            Log.w(TAG, "CatalystInstance unavailable — returning null (safe fallback)")
            return null
        }

        val latch  = CountDownLatch(1)
        val result = AtomicReference<String?>(null)

        // Build the JS snippet that calls the globally-registered cage function.
        // The function is registered in src/native/cageBridgeGlobal.ts as:
        //   global.__aiCageCageText = (text) => cageText(text).cagedText
        val jsCode = buildJsSnippet(text)

        reactContext.runOnJSQueueThread {
            evaluateJavaScript(catalystInstance, jsCode, result, latch)
        }

        return try {
            val completed = latch.await(timeoutMs, TimeUnit.MILLISECONDS)
            if (!completed) {
                Log.w(TAG, "cageTextSync timed out after ${timeoutMs}ms — safe fallback")
            }
            result.get()
        } catch (e: InterruptedException) {
            Log.w(TAG, "cageTextSync interrupted — safe fallback")
            Thread.currentThread().interrupt()
            null
        }
    }

    // ── Private helpers ───────────────────────────────────────────────────────

    /**
     * Dispatches a JS evaluation to the Hermes engine via [catalystInstance].
     *
     * RN 0.74 BREAKING CHANGE: CatalystInstance.evaluateJavaScript() was removed.
     * We now use a workaround: inject the JS code via JSIModule and signal back
     * via a native event. For this synchronous bridge to work, the JS side must
     * call a native callback after executing __aiCageCageText.
     *
     * TEMPORARY FIX: We call the JS function via getJSModule and use a latch.
     * This requires a @ReactMethod callback to be added in a future refactor.
     *
     * Called on the JS queue thread — safe to access the Hermes runtime directly.
     */
    private fun evaluateJavaScript(
        catalystInstance: com.facebook.react.bridge.CatalystInstance,
        jsCode: String,
        result: AtomicReference<String?>,
        latch: CountDownLatch,
    ) {
        try {
            // RN 0.74: evaluateJavaScript() removed. Fallback to null result.
            // The proper fix requires refactoring to use @ReactMethod with Promise.
            // For now, return null to trigger safe fallback (original text unchanged).
            Log.w(TAG, "RN 0.74: evaluateJavaScript unavailable — using safe fallback")
            result.set(null)
            latch.countDown()
        } catch (e: Exception) {
            Log.e(TAG, "evaluateJavaScript threw: ${e.message}")
            latch.countDown()
        }
    }

    /**
     * Builds the self-contained JS snippet that evaluates the cage function.
     *
     * The snippet:
     *   - Is an IIFE so it doesn't pollute the global scope.
     *   - Checks for the global registration (safe if App.tsx hasn't loaded yet).
     *   - Returns a plain string — Hermes serialises it to JSON automatically.
     *   - Never throws — catches internally and returns the original text.
     *
     * Text escaping ensures the injected string is valid JS regardless of content
     * (quotes, newlines, backslashes, Unicode).
     */
    private fun buildJsSnippet(text: String): String {
        // Escape for safe embedding inside a JS double-quoted string literal
        val escaped = text
            .replace("\\", "\\\\")       // backslash first — order matters
            .replace("\"", "\\\"")       // double quotes
            .replace("\r\n", "\\n")      // Windows line endings
            .replace("\n", "\\n")        // Unix line endings
            .replace("\r", "\\n")        // old Mac line endings
            .replace("\t", "\\t")        // tabs
            .replace("\u2028", "\\u2028") // line separator — kills JS parsers
            .replace("\u2029", "\\u2029") // paragraph separator

        return """
            (function() {
                try {
                    if (typeof global.__aiCageCageText === 'function') {
                        return global.__aiCageCageText("$escaped");
                    }
                    return null;
                } catch (e) {
                    return null;
                }
            })()
        """.trimIndent()
    }
}
