// Copyright (c) 2026 Frikha, Tunisia. All rights reserved.
// AI CAGE Mobile — Local MITM Proxy
// Licensed under Business Source License 1.1

package io.aicage.mobile.vpn

import android.util.Log
import java.io.FileDescriptor
import java.io.InputStream
import java.io.OutputStream
import java.net.InetSocketAddress
import java.net.ServerSocket
import java.net.Socket
import java.net.URL
import java.util.concurrent.ExecutorService
import java.util.concurrent.Executors
import java.util.concurrent.atomic.AtomicBoolean
import javax.net.ssl.*

/**
 * LocalMitmProxy — on-device HTTP/HTTPS proxy that intercepts traffic
 * destined for known AI endpoints, cages PII, and forwards the sanitised
 * request to the real destination.
 *
 * SECURITY CONTRACT:
 *   - Binds ONLY to 127.0.0.1 (loopback). Never reachable from the network.
 *   - The self-signed CA certificate is generated on first run, stored in
 *     Android Keystore (hardware-backed on supported devices), and never
 *     exported or transmitted.
 *   - PII replacement is performed in [CageBridge] via the JS engine.
 *   - Non-AI traffic is passed through unmodified (CONNECT tunnel, no MITM).
 *   - All connections are closed on error — no silent data leaks.
 *
 * THREADING:
 *   - Main accept loop runs on the calling thread (proxy thread from VpnService).
 *   - Each connection is handled on a thread from [threadPool] (max 32 threads).
 *
 * INTERCEPTED HOSTS (subset — full list in AiEndpointMatcher):
 *   api.openai.com, chat.openai.com, api.anthropic.com, claude.ai,
 *   generativelanguage.googleapis.com, api.mistral.ai, api.groq.com,
 *   api.perplexity.ai, api.deepseek.com, api.x.ai, grok.com, ...
 */
class LocalMitmProxy(
    private val vpnFd: FileDescriptor,
    private val proxyPort: Int,
    private val running: AtomicBoolean,
    private val protect: (Socket) -> Boolean,
    private val cageNativeModule: CageNativeModule?,
) {

    companion object {
        private const val TAG = "AiCageMitmProxy"
        private const val MAX_THREADS = 32
        private const val CONNECT_TIMEOUT_MS = 15_000
        private const val READ_TIMEOUT_MS    = 30_000
        private const val MAX_BODY_BYTES     = 2 * 1024 * 1024  // 2 MB safety cap
    }

    private val threadPool: ExecutorService = Executors.newFixedThreadPool(MAX_THREADS)
    private val certManager = LocalCertManager()
    private val endpointMatcher = AiEndpointMatcher()
    private val cageBridge = CageBridge().also {
        cageNativeModule?.let { nm -> it.setNativeModule(nm) }
    }

    // ── Main accept loop ─────────────────────────────────────────────────────

    fun run() {
        Log.i(TAG, "Local MITM proxy starting on 127.0.0.1:$proxyPort")
        try {
            ServerSocket(proxyPort, 50, java.net.InetAddress.getByName("127.0.0.1")).use { server ->
                server.soTimeout = 1000  // 1s accept timeout so we can check running flag
                while (running.get()) {
                    try {
                        val client = server.accept()
                        threadPool.submit { handleConnection(client) }
                    } catch (_: java.net.SocketTimeoutException) {
                        // Normal — just loop and check running flag again
                    }
                }
            }
        } catch (e: Exception) {
            if (running.get()) {
                Log.e(TAG, "Proxy accept loop crashed: ${e.message}")
            }
        } finally {
            threadPool.shutdown()
            Log.i(TAG, "Proxy stopped")
        }
    }

    // ── Per-connection handler ────────────────────────────────────────────────

    private fun handleConnection(client: Socket) {
        client.soTimeout = READ_TIMEOUT_MS
        try {
            val input  = client.getInputStream().bufferedReader()
            val output = client.getOutputStream()

            // Read the first line: "CONNECT host:port HTTP/1.1" or "POST /v1/... HTTP/1.1"
            val requestLine = input.readLine() ?: return
            Log.d(TAG, "Request: $requestLine")

            if (requestLine.startsWith("CONNECT ")) {
                handleConnect(requestLine, client, input, output)
            } else {
                handlePlainHttp(requestLine, client, input, output)
            }
        } catch (e: Exception) {
            Log.w(TAG, "Connection error: ${e.message}")
        } finally {
            runCatching { client.close() }
        }
    }

    /**
     * Handles CONNECT tunnelling (HTTPS).
     * If the target host is a known AI endpoint, we MITM it.
     * Otherwise we pass through as a blind tunnel (no inspection).
     */
    private fun handleConnect(
        requestLine: String,
        client: Socket,
        input: java.io.BufferedReader,
        output: OutputStream,
    ) {
        // Parse "CONNECT api.openai.com:443 HTTP/1.1"
        val parts = requestLine.split(" ")
        if (parts.size < 2) return
        val hostPort = parts[1].split(":")
        val host = hostPort[0]
        val port = hostPort.getOrElse(1) { "443" }.toIntOrNull() ?: 443

        // Drain remaining headers
        while (true) {
            val line = input.readLine() ?: break
            if (line.isEmpty()) break
        }

        if (endpointMatcher.isAiEndpoint(host)) {
            // MITM: respond 200 and present our CA cert
            output.write("HTTP/1.1 200 Connection Established\r\n\r\n".toByteArray())
            output.flush()
            mitmHttps(host, port, client)
        } else {
            // Pass-through: blind tunnel, no inspection
            output.write("HTTP/1.1 200 Connection Established\r\n\r\n".toByteArray())
            output.flush()
            blindTunnel(host, port, client)
        }
    }

    /**
     * Handles plain HTTP (rare — most AI APIs use HTTPS).
     */
    private fun handlePlainHttp(
        requestLine: String,
        client: Socket,
        input: java.io.BufferedReader,
        output: OutputStream,
    ) {
        // Parse "POST https://api.openai.com/v1/chat/completions HTTP/1.1"
        val parts = requestLine.split(" ")
        if (parts.size < 2) return
        val urlStr = parts[1]

        try {
            val url = URL(urlStr)
            if (!endpointMatcher.isAiEndpoint(url.host, url.path)) {
                // Not an AI endpoint — 400 (plain HTTP to AI is unexpected, refuse)
                output.write("HTTP/1.1 400 Bad Request\r\n\r\n".toByteArray())
                return
            }
            // Read headers + body, cage PII, forward
            val headers = mutableMapOf<String, String>()
            while (true) {
                val line = input.readLine() ?: break
                if (line.isEmpty()) break
                val idx = line.indexOf(':')
                if (idx > 0) headers[line.substring(0, idx).trim()] = line.substring(idx + 1).trim()
            }
            val contentLength = headers["Content-Length"]?.toIntOrNull() ?: 0
            val bodyChars = CharArray(contentLength.coerceAtMost(MAX_BODY_BYTES))
            input.read(bodyChars)
            val body = String(bodyChars)
            val cagedBody = cageBridge.cageRequestBody(body)
            forwardHttp(url, parts[0], headers, cagedBody, output)
        } catch (e: Exception) {
            Log.w(TAG, "Plain HTTP handler error: ${e.message}")
            output.write("HTTP/1.1 502 Bad Gateway\r\n\r\n".toByteArray())
        }
    }

    /**
     * MITM HTTPS: wrap the client socket in TLS using our CA cert,
     * read and cage the request body, forward to real server, return response.
     *
     * We wrap the existing [client] socket directly — no new ServerSocket is opened.
     * The SSLContext is initialised with the per-host KeyManagers from [LocalCertManager],
     * which present a certificate for [host] signed by our on-device CA.
     */
    private fun mitmHttps(host: String, port: Int, client: Socket) {
        try {
            // Wrap the existing plain socket into a server-side SSLSocket.
            // SSLSocketFactory.createSocket(existingSocket, host, port, autoClose=true)
            // upgrades the connection in-place — no new port is bound.
            val clientSsl = SSLContext.getInstance("TLS").apply {
                init(certManager.getKeyManagers(host), null, null)
            }.socketFactory.createSocket(
                client, client.inetAddress.hostAddress, client.port, true
            ) as SSLSocket

            clientSsl.useClientMode = false
            clientSsl.startHandshake()

            val sslInput  = clientSsl.inputStream.bufferedReader()
            val sslOutput = clientSsl.outputStream

            // Read the HTTP request from the now-decrypted stream
            val requestLine = sslInput.readLine() ?: return
            val method = requestLine.split(" ").firstOrNull() ?: "POST"

            val headers = mutableMapOf<String, String>()
            while (true) {
                val line = sslInput.readLine() ?: break
                if (line.isEmpty()) break
                val idx = line.indexOf(':')
                if (idx > 0) headers[line.substring(0, idx).trim()] = line.substring(idx + 1).trim()
            }

            val contentLength = headers["Content-Length"]?.toIntOrNull() ?: 0
            val bodyChars = CharArray(contentLength.coerceAtMost(MAX_BODY_BYTES))
            sslInput.read(bodyChars)
            val rawBody = String(bodyChars)

            // Cage PII in the request body before forwarding
            val cagedBody = cageBridge.cageRequestBody(rawBody)

            // Forward to real AI server (bypassing our VPN via protect())
            val realSocket = Socket()
            protect(realSocket)
            realSocket.connect(InetSocketAddress(host, port), CONNECT_TIMEOUT_MS)

            val realSsl = (SSLSocketFactory.getDefault() as SSLSocketFactory)
                .createSocket(realSocket, host, port, true) as SSLSocket
            realSsl.startHandshake()

            // Send caged request
            val reqBuilder = StringBuilder()
            reqBuilder.append("$method ${requestLine.split(" ").getOrElse(1) { "/" }} HTTP/1.1\r\n")
            headers["Host"] = host
            headers["Content-Length"] = cagedBody.toByteArray().size.toString()
            headers.forEach { (k, v) -> reqBuilder.append("$k: $v\r\n") }
            reqBuilder.append("\r\n")
            reqBuilder.append(cagedBody)
            realSsl.outputStream.write(reqBuilder.toString().toByteArray())
            realSsl.outputStream.flush()

            // Stream response back to client
            val responseBytes = realSsl.inputStream.readBytes()
            sslOutput.write(responseBytes)
            sslOutput.flush()

            realSsl.close()
            clientSsl.close()

        } catch (e: Exception) {
            Log.w(TAG, "MITM HTTPS error for $host: ${e.message}")
        }
    }

    /**
     * Blind tunnel: forward raw bytes between client and server without inspection.
     * Used for non-AI endpoints to avoid any performance impact.
     */
    private fun blindTunnel(host: String, port: Int, client: Socket) {
        try {
            val server = Socket()
            protect(server)
            server.connect(InetSocketAddress(host, port), CONNECT_TIMEOUT_MS)

            val c2s = Thread { relay(client.inputStream, server.outputStream) }
            val s2c = Thread { relay(server.inputStream, client.outputStream) }
            c2s.isDaemon = true
            s2c.isDaemon = true
            c2s.start()
            s2c.start()
            c2s.join(60_000)
            s2c.join(60_000)

            server.close()
        } catch (e: Exception) {
            Log.w(TAG, "Blind tunnel error for $host: ${e.message}")
        }
    }

    private fun forwardHttp(
        url: URL,
        method: String,
        headers: Map<String, String>,
        body: String,
        output: OutputStream,
    ) {
        val conn = url.openConnection() as java.net.HttpURLConnection
        conn.requestMethod = method
        conn.doOutput = body.isNotEmpty()
        conn.connectTimeout = CONNECT_TIMEOUT_MS
        conn.readTimeout = READ_TIMEOUT_MS
        headers.forEach { (k, v) -> conn.setRequestProperty(k, v) }
        if (body.isNotEmpty()) {
            conn.outputStream.write(body.toByteArray())
        }
        val responseCode = conn.responseCode
        val responseBody = conn.inputStream.readBytes()
        output.write("HTTP/1.1 $responseCode ${conn.responseMessage}\r\n".toByteArray())
        output.write("Content-Length: ${responseBody.size}\r\n\r\n".toByteArray())
        output.write(responseBody)
        output.flush()
    }

    private fun relay(input: InputStream, out: OutputStream) {
        try {
            val buf = ByteArray(8192)
            var n: Int
            while (input.read(buf).also { n = it } != -1) {
                out.write(buf, 0, n)
                out.flush()
            }
        } catch (_: Exception) {}
    }
}
