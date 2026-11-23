// Copyright (c) 2026 Frikha, Tunisia. All rights reserved.
// AI CAGE Mobile — Android VPN Service
// Licensed under Business Source License 1.1

package io.aicage.mobile.vpn

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Intent
import android.net.VpnService
import android.os.ParcelFileDescriptor
import android.util.Log
import java.io.FileInputStream
import java.io.FileOutputStream
import java.net.InetSocketAddress
import java.nio.ByteBuffer
import java.nio.channels.DatagramChannel
import java.util.concurrent.atomic.AtomicBoolean

/**
 * AiCageVpnService — Local VPN that intercepts outbound traffic to AI endpoints.
 *
 * SECURITY CONTRACT:
 *   - Zero data sent to any external server. All processing is on-device.
 *   - VPN tunnel is 127.0.0.1 loopback only — traffic goes to local proxy.
 *   - Requires explicit user consent (VpnService.prepare()) before start.
 *   - User can revoke at any time via Android system settings.
 *
 * ARCHITECTURE:
 *   App → VpnService (tun0 interface) → LocalMitmProxy (127.0.0.1:8899)
 *       → PII engine (cageText) → AI endpoint (HTTPS, real dest)
 *       ← AI response → uncageText → App
 *
 * HOW IT WORKS:
 *   1. We create a TUN interface and route all traffic through it.
 *   2. For packets destined to known AI endpoints (by hostname), we redirect
 *      to LocalMitmProxy running on localhost:8899.
 *   3. LocalMitmProxy holds a self-signed CA cert (generated on first run,
 *      never leaves device). It terminates the TLS session, reads the body,
 *      runs cageText() via JNI bridge, then re-encrypts and forwards.
 *   4. For all other traffic, packets pass through unmodified.
 */
class AiCageVpnService : VpnService() {

    companion object {
        private const val TAG = "AiCageVpnService"
        const val ACTION_START = "io.aicage.mobile.vpn.START"
        const val ACTION_STOP  = "io.aicage.mobile.vpn.STOP"
        const val NOTIFICATION_CHANNEL_ID = "ai_cage_vpn"
        const val NOTIFICATION_ID = 1001
        const val LOCAL_PROXY_PORT = 8899
        const val VPN_ADDRESS     = "10.0.0.2"
        const val VPN_ROUTE       = "0.0.0.0"
        const val VPN_PREFIX_LEN  = 0
        const val MTU             = 1500
    }

    private val running = AtomicBoolean(false)
    private var vpnInterface: ParcelFileDescriptor? = null
    private var proxyThread: Thread? = null

    // ── Lifecycle ────────────────────────────────────────────────────────────

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        return when (intent?.action) {
            ACTION_START -> {
                if (!running.get()) startVpn()
                START_STICKY
            }
            ACTION_STOP -> {
                stopVpn()
                START_NOT_STICKY
            }
            else -> START_NOT_STICKY
        }
    }

    override fun onRevoke() {
        // Android calls this when the user disables the VPN from system settings.
        // We MUST honour this — no reconnection attempt without fresh user consent.
        Log.i(TAG, "VPN revoked by user via system settings")
        stopVpn()
        super.onRevoke()
    }

    override fun onDestroy() {
        stopVpn()
        super.onDestroy()
    }

    // ── Start / Stop ─────────────────────────────────────────────────────────

    private fun startVpn() {
        if (running.getAndSet(true)) return

        Log.i(TAG, "Starting AI CAGE VPN service")
        startForeground(NOTIFICATION_ID, buildNotification())

        // Build the TUN interface
        val builder = Builder()
            .setSession("AI CAGE")
            .setMtu(MTU)
            .addAddress(VPN_ADDRESS, 32)
            .addRoute(VPN_ROUTE, VPN_PREFIX_LEN)
            .addDnsServer("1.1.1.1")
            // Allow our own app to bypass the VPN (prevents routing loops)
            .addDisallowedApplication(packageName)

        try {
            vpnInterface = builder.establish()
                ?: throw IllegalStateException("VpnService.establish() returned null — permission not granted")
        } catch (e: Exception) {
            Log.e(TAG, "Failed to establish VPN interface: ${e.message}")
            running.set(false)
            stopSelf()
            return
        }

        // Start the local MITM proxy on a background thread
        proxyThread = Thread({
            LocalMitmProxy(
                vpnFd            = vpnInterface!!.fileDescriptor,
                proxyPort         = LOCAL_PROXY_PORT,
                running           = running,
                protect           = { socket -> protect(socket) },
                cageNativeModule  = CageVpnModule.sharedCageNativeModule,
            ).run()
        }, "ai-cage-proxy").also { it.isDaemon = true; it.start() }

        Log.i(TAG, "VPN interface established — proxy running on 127.0.0.1:$LOCAL_PROXY_PORT")
        broadcastStatus(true)
    }

    private fun stopVpn() {
        if (!running.getAndSet(false)) return
        Log.i(TAG, "Stopping AI CAGE VPN service")

        proxyThread?.interrupt()
        proxyThread = null

        try {
            vpnInterface?.close()
        } catch (e: Exception) {
            Log.w(TAG, "Error closing VPN interface: ${e.message}")
        }
        vpnInterface = null

        stopForeground(STOP_FOREGROUND_REMOVE)
        stopSelf()
        broadcastStatus(false)
        Log.i(TAG, "VPN stopped cleanly")
    }

    // ── Status broadcast (consumed by React Native module) ──────────────────

    private fun broadcastStatus(active: Boolean) {
        val intent = Intent("io.aicage.mobile.vpn.STATUS")
        intent.putExtra("active", active)
        sendBroadcast(intent)
    }

    // ── Foreground notification ───────────────────────────────────────────────

    private fun buildNotification(): Notification {
        val nm = getSystemService(NOTIFICATION_SERVICE) as NotificationManager
        val channel = NotificationChannel(
            NOTIFICATION_CHANNEL_ID,
            "AI CAGE VPN",
            NotificationManager.IMPORTANCE_LOW
        ).apply {
            description = "AI CAGE is protecting your AI prompts"
            setShowBadge(false)
        }
        nm.createNotificationChannel(channel)

        // Tapping the notification opens the main app activity
        val launchIntent = packageManager.getLaunchIntentForPackage(packageName)
        val pendingIntent = PendingIntent.getActivity(
            this, 0, launchIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        return Notification.Builder(this, NOTIFICATION_CHANNEL_ID)
            .setContentTitle("AI CAGE Active")
            .setContentText("Your AI prompts are protected")
            .setSmallIcon(android.R.drawable.ic_lock_lock)
            .setContentIntent(pendingIntent)
            .setOngoing(true)
            .build()
    }
}
