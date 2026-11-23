// Copyright (c) 2026 Frikha, Tunisia. All rights reserved.
// AI CAGE Mobile — CageVpnModule (React Native NativeModule)
// Licensed under Business Source License 1.1

package io.aicage.mobile.vpn

import android.app.Activity
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.net.VpnService
import android.os.Environment
import android.security.KeyChain
import com.facebook.react.bridge.*
import com.facebook.react.modules.core.DeviceEventManagerModule
import java.io.File

/**
 * CageVpnModule — React Native NativeModule that exposes VPN control
 * and PII caging to the TypeScript layer.
 *
 * EXPOSED METHODS (callable from TypeScript via NativeModules.CageVpn):
 *   prepareVpn()          → Promise<boolean>  — requests Android VPN permission
 *   startVpn()            → Promise<void>     — starts the VPN service
 *   stopVpn()             → Promise<void>     — stops the VPN service
 *   getVpnStatus()        → Promise<boolean>  — returns current active state
 *   cageText(text)        → Promise<string>   — cages PII in a string (test helper)
 *   installCaCert()       → Promise<boolean|string> — writes .crt to Downloads, opens installer
 *
 * EVENTS emitted to JavaScript (via DeviceEventEmitter):
 *   'VpnStatusChanged'    — { active: boolean }
 *   'CageEvent'           — { caged: number, timestamp: number }
 *
 * CONSENT ENFORCEMENT:
 *   startVpn() will throw an error if prepareVpn() has not been called
 *   and returned true in the current app session. This enforces the
 *   double-consent model (app-level + Android system dialog).
 */
class CageVpnModule(private val reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext), ActivityEventListener {

    companion object {
        const val MODULE_NAME = "CageVpn"
        private const val VPN_REQUEST_CODE          = 7777
        private const val CERT_INSTALL_REQUEST_CODE = 7778
        private const val PREF_CONSENT_GIVEN = "ai_cage_vpn_consent_v1"

        // Thread-safe singleton — set when the RN module is constructed.
        // AiCageVpnService reads this to pass to LocalMitmProxy for PII caging.
        @Volatile
        var sharedCageNativeModule: CageNativeModule? = null
            private set
    }

    private var vpnPermissionPromise: Promise? = null
    private var consentGiven: Boolean = false
    private val certManager = LocalCertManager()
    private val cageNativeModule = CageNativeModule(reactContext).also {
        sharedCageNativeModule = it
    }
    private val cageBridge = CageBridge().also { it.setNativeModule(cageNativeModule) }

    // Status broadcast receiver — translates Android broadcast → RN event
    private val statusReceiver = object : BroadcastReceiver() {
        override fun onReceive(context: Context, intent: Intent) {
            val active = intent.getBooleanExtra("active", false)
            emitVpnStatusEvent(active)
        }
    }

    init {
        reactContext.addActivityEventListener(this)
        reactContext.registerReceiver(
            statusReceiver,
            IntentFilter("io.aicage.mobile.vpn.STATUS"),
            Context.RECEIVER_NOT_EXPORTED,
        )
    }

    override fun getName(): String = MODULE_NAME

    // ── prepareVpn ───────────────────────────────────────────────────────────

    /**
     * Requests Android's VPN permission dialog.
     * Must be called before startVpn().
     * Returns true if permission was already granted (no dialog shown).
     * Returns false while the system dialog is shown — the result arrives
     * via onActivityResult() and resolves the promise.
     */
    @ReactMethod
    fun prepareVpn(promise: Promise) {
        val activity = currentActivity ?: run {
            promise.reject("NO_ACTIVITY", "No active Android Activity")
            return
        }

        val intent = VpnService.prepare(activity)
        if (intent == null) {
            // Permission already granted
            consentGiven = true
            promise.resolve(true)
        } else {
            // Show system VPN dialog — result handled in onActivityResult
            vpnPermissionPromise = promise
            activity.startActivityForResult(intent, VPN_REQUEST_CODE)
        }
    }

    // ── startVpn ─────────────────────────────────────────────────────────────

    /**
     * Starts the AI CAGE VPN service.
     * Requires prepareVpn() to have resolved with true first.
     */
    @ReactMethod
    fun startVpn(promise: Promise) {
        if (!consentGiven) {
            promise.reject(
                "CONSENT_REQUIRED",
                "Call prepareVpn() and obtain user consent before starting the VPN."
            )
            return
        }

        try {
            val intent = Intent(reactContext, AiCageVpnService::class.java).apply {
                action = AiCageVpnService.ACTION_START
            }
            reactContext.startForegroundService(intent)
            promise.resolve(null)
        } catch (e: Exception) {
            promise.reject("VPN_START_FAILED", e.message ?: "Unknown error")
        }
    }

    // ── stopVpn ──────────────────────────────────────────────────────────────

    @ReactMethod
    fun stopVpn(promise: Promise) {
        try {
            val intent = Intent(reactContext, AiCageVpnService::class.java).apply {
                action = AiCageVpnService.ACTION_STOP
            }
            reactContext.startService(intent)
            promise.resolve(null)
        } catch (e: Exception) {
            promise.reject("VPN_STOP_FAILED", e.message ?: "Unknown error")
        }
    }

    // ── getVpnStatus ─────────────────────────────────────────────────────────

    @ReactMethod
    fun getVpnStatus(promise: Promise) {
        // Check if VPN service is running by checking the shared pref set by the service
        val prefs = reactContext.getSharedPreferences("ai_cage_vpn_state", Context.MODE_PRIVATE)
        val active = prefs.getBoolean("vpn_active", false)
        promise.resolve(active)
    }

    // ── cageText (test helper) ────────────────────────────────────────────────

    @ReactMethod
    fun cageText(text: String, promise: Promise) {
        try {
            val result = cageBridge.cageRequestBody(text)
            promise.resolve(result)
        } catch (e: Exception) {
            promise.reject("CAGE_ERROR", e.message ?: "Cage failed")
        }
    }

    // ── installCaCert ─────────────────────────────────────────────────────────

    /**
     * Writes the local CA certificate to Downloads and opens the Android cert installer.
     *
     * RETURN VALUES (Promise):
     *   true            — KeyChain intent launched successfully (Android 14+)
     *   "<absolute/path/ai-cage-ca.crt>" — no Activity available; JS must call
     *                     Linking.openSettings() and show the manual guide
     *
     * The .crt file is always written to getExternalFilesDir(DIRECTORY_DOWNLOADS)
     * regardless of the intent outcome, so the user can install it manually.
     *
     * ANDROID VERSION BEHAVIOUR:
     *   Android 14+ — KeyChain.createInstallIntent() is the supported path
     *   Android 11–13 — same intent, different system UI, works identically
     *   Android < 11  — not targeted (minSdk = 26), covered by same intent
     */
    @ReactMethod
    fun installCaCert(promise: Promise) {
        try {
            val certDer = certManager.getCaCertDer()

            // Step 1 — Write the .crt to external Downloads so the user can
            // also install it manually from Settings → Security → Certificates.
            // getExternalFilesDir() is app-scoped — no WRITE_EXTERNAL_STORAGE
            // permission needed. Readable by the cert installer via FileProvider.
            val downloadsDir = reactApplicationContext
                .getExternalFilesDir(Environment.DIRECTORY_DOWNLOADS)
                ?: reactApplicationContext.cacheDir  // fallback: internal cache

            val certFile = File(downloadsDir, "ai-cage-ca.crt")
            certFile.writeBytes(certDer)

            // Step 2 — Build the KeyChain install intent (Android 14+ canonical path;
            // also works on Android 7+ / API 26 which is our minSdk).
            val intent = KeyChain.createInstallIntent().apply {
                putExtra(KeyChain.EXTRA_CERTIFICATE, certDer)
                putExtra(KeyChain.EXTRA_NAME, "AI CAGE Local CA")
            }

            // Step 3 — Launch intent if Activity is available, otherwise return
            // the file path so the JS layer can guide the user manually.
            val activity = currentActivity
            if (activity != null) {
                activity.startActivityForResult(intent, CERT_INSTALL_REQUEST_CODE)
                promise.resolve(true)
            } else {
                // No Activity (app backgrounded). The .crt is on disk —
                // JS resolves with the path and calls Linking.openSettings().
                promise.resolve(certFile.absolutePath)
            }
        } catch (e: Exception) {
            promise.reject("CERT_INSTALL_ERROR", e.message ?: "Certificate install failed")
        }
    }

    // ── ActivityEventListener ────────────────────────────────────────────────

    override fun onActivityResult(
        activity: Activity,
        requestCode: Int,
        resultCode: Int,
        data: Intent?,
    ) {
        if (requestCode != VPN_REQUEST_CODE) return
        val promise = vpnPermissionPromise ?: return
        vpnPermissionPromise = null

        if (resultCode == Activity.RESULT_OK) {
            consentGiven = true
            promise.resolve(true)
        } else {
            // User declined the system VPN dialog
            consentGiven = false
            promise.resolve(false)
        }
    }

    override fun onNewIntent(intent: Intent?) {}

    // ── Event emitter ────────────────────────────────────────────────────────

    private fun emitVpnStatusEvent(active: Boolean) {
        reactContext
            .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
            .emit("VpnStatusChanged", Arguments.createMap().apply {
                putBoolean("active", active)
            })
    }
}
