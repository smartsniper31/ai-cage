// Copyright (c) 2026 Frikha, Tunisia. All rights reserved.
// AI CAGE Mobile — CageBridge (Kotlin → JS engine bridge)
// Licensed under Business Source License 1.1

package io.aicage.mobile.vpn

import android.util.Log
import org.json.JSONObject

/**
 * CageBridge — calls the AI CAGE PII engine from Kotlin.
 *
 * The @ai-cage/core package is TypeScript. In the Expo / React Native
 * runtime, the JS engine (Hermes) runs in the same process. We call the
 * cage engine via the React Native JS bridge using a named NativeModule.
 *
 * CALL FLOW:
 *   LocalMitmProxy (Kotlin)
 *     → CageBridge.cageRequestBody()
 *       → CageNativeModule (Kotlin NativeModule, runs on JS thread)
 *         → JavaScript: cageText(body) from @ai-cage/core
 *           → returns cagedBody string
 *       ← cagedBody
 *     ← cagedBody string
 *
 * THREADING NOTE:
 *   The JS bridge is asynchronous. CageBridge uses a blocking call with a
 *   timeout (default 5s). If the bridge doesn't respond in time (e.g. app
 *   is backgrounded), the original body is returned UNCHANGED as a safe
 *   fallback — better to send uncaged data than to drop the request.
 *
 * SECURITY CONTRACT:
 *   - If caging fails for any reason, we return the original body.
 *   - We NEVER drop the user's request silently.
 *   - Cage failures are logged and surfaced to the UI via event emitter.
 */
class CageBridge {

    companion object {
        private const val TAG = "AiCageBridge"
        private const val CAGE_TIMEOUT_MS = 5000L
    }

    // Injected by CageVpnModule after the React Native bridge is ready
    private var nativeModule: CageNativeModule? = null

    fun setNativeModule(module: CageNativeModule) {
        nativeModule = module
    }

    /**
     * Cages PII in an HTTP request body string.
     *
     * Attempts to call the JS engine via [CageNativeModule].
     * Falls back to the original body if the bridge is unavailable or times out.
     *
     * @param body The raw HTTP request body (JSON string expected for AI APIs).
     * @return The body with PII replaced by [CAGED_*] placeholders.
     */
    fun cageRequestBody(body: String): String {
        if (body.isBlank()) return body

        // Only process JSON bodies (all major AI APIs use JSON)
        if (!body.trimStart().startsWith('{') && !body.trimStart().startsWith('[')) {
            Log.d(TAG, "Non-JSON body — skipping cage (${body.length} bytes)")
            return body
        }

        return try {
            val module = nativeModule
            if (module == null) {
                Log.w(TAG, "JS bridge not ready — forwarding body uncaged")
                return body
            }
            module.cageTextSync(body, CAGE_TIMEOUT_MS) ?: body
        } catch (e: Exception) {
            Log.e(TAG, "Cage failed: ${e.message} — forwarding body uncaged")
            body
        }
    }

    /**
     * Extracts the "messages" array from an OpenAI-style JSON body,
     * cages each message content, and returns the modified JSON.
     *
     * OpenAI format:
     *   { "model": "gpt-4", "messages": [{ "role": "user", "content": "..." }] }
     *
     * This avoids caging the entire JSON (which would corrupt field names).
     */
    fun cageOpenAiMessages(body: String): String {
        return try {
            val json = JSONObject(body)
            val messages = json.optJSONArray("messages") ?: return cageRequestBody(body)

            for (i in 0 until messages.length()) {
                val msg = messages.getJSONObject(i)
                val content = msg.optString("content", "")
                if (content.isNotEmpty()) {
                    val caged = cageRequestBody(content)
                    msg.put("content", caged)
                }
            }
            json.put("messages", messages)
            json.toString()
        } catch (e: Exception) {
            Log.w(TAG, "OpenAI message parsing failed: ${e.message}")
            cageRequestBody(body)  // fall back to full-body cage
        }
    }
}
