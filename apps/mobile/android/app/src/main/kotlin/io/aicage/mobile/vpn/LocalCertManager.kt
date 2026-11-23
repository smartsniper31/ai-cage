// Copyright (c) 2026 Frikha, Tunisia. All rights reserved.
// AI CAGE Mobile — Local Certificate Manager
// Licensed under Business Source License 1.1

package io.aicage.mobile.vpn

import android.util.Log
import org.bouncycastle.asn1.x500.X500Name
import org.bouncycastle.asn1.x509.BasicConstraints
import org.bouncycastle.asn1.x509.Extension
import org.bouncycastle.asn1.x509.GeneralName
import org.bouncycastle.asn1.x509.GeneralNames
import org.bouncycastle.asn1.x509.KeyUsage
import org.bouncycastle.cert.X509v3CertificateBuilder
import org.bouncycastle.cert.jcajce.JcaX509CertificateConverter
import org.bouncycastle.cert.jcajce.JcaX509v3CertificateBuilder
import org.bouncycastle.operator.jcajce.JcaContentSignerBuilder
import java.math.BigInteger
import java.security.*
import java.security.cert.X509Certificate
import java.util.*
import javax.net.ssl.*

/**
 * LocalCertManager — generates and manages the on-device self-signed CA.
 *
 * SECURITY CONTRACT:
 *   - The CA private key lives only in memory for the lifetime of the VPN
 *     service process. It is NEVER written to disk and NEVER exported.
 *   - The CA certificate is used ONLY to sign per-host certificates for
 *     known AI endpoints. The user must manually install the CA cert via
 *     Android Settings → Security → Install certificate (second consent gate).
 *   - Certificates are generated with BouncyCastle (bcpkix-jdk18on:1.78.1),
 *     declared in android/app/build.gradle.
 *   - CA validity: 10 years. Per-host validity: 1 year.
 *   - Per-host SSLContexts are cached in memory to avoid regenerating on
 *     every proxy connection.
 *
 * DEPENDENCIES (android/app/build.gradle):
 *   implementation("org.bouncycastle:bcpkix-jdk18on:1.78.1")
 *   implementation("org.bouncycastle:bcprov-jdk18on:1.78.1")
 */
class LocalCertManager {

    companion object {
        private const val TAG             = "AiCageCertManager"
        private const val KEY_SIZE        = 2048
        private const val SIGN_ALGORITHM  = "SHA256WithRSAEncryption"
        private const val VALIDITY_DAYS_CA   = 3650  // 10 years
        private const val VALIDITY_DAYS_HOST = 365   // 1 year
    }

    // Per-host SSLContexts — cached to avoid regenerating on every request
    private val hostContextCache = mutableMapOf<String, SSLContext>()

    // Lazily-generated CA keypair + certificate (in-memory, never written to disk)
    private val caPair: Pair<KeyPair, X509Certificate> by lazy { generateCa() }

    // ── Public API ────────────────────────────────────────────────────────────

    /**
     * Returns an [SSLContext] in server mode for [host], backed by a certificate
     * signed by our local CA. Used by [LocalMitmProxy.mitmHttps] to present
     * a trusted certificate to the intercepted HTTPS connection.
     */
    fun getSslContextForHost(host: String): SSLContext {
        return hostContextCache.getOrPut(host) {
            val (caKeyPair, caCert) = caPair
            val (hostKeyPair, hostCert) = generateHostCert(host, caKeyPair, caCert)
            buildSslContext(hostKeyPair, hostCert, caCert)
        }
    }

    /**
     * Returns [KeyManager]s for [host].
     * Called by [LocalMitmProxy.mitmHttps] when constructing the per-connection SSLContext.
     */
    fun getKeyManagers(host: String): Array<KeyManager> {
        val (caKeyPair, caCert) = caPair
        val (hostKeyPair, hostCert) = generateHostCert(host, caKeyPair, caCert)
        val ks = KeyStore.getInstance("PKCS12").apply {
            load(null, null)
            setKeyEntry("host", hostKeyPair.private, null, arrayOf(hostCert, caCert))
        }
        return KeyManagerFactory
            .getInstance(KeyManagerFactory.getDefaultAlgorithm())
            .apply { init(ks, null) }
            .keyManagers
    }

    /**
     * Returns the DER-encoded CA certificate bytes.
     * Used by [CageVpnModule.installCaCert] to open the Android cert installer.
     * The user must approve this in Settings for HTTPS interception to work.
     */
    fun getCaCertDer(): ByteArray = caPair.second.encoded

    // ── Certificate generation ────────────────────────────────────────────────

    private fun generateCa(): Pair<KeyPair, X509Certificate> {
        Log.i(TAG, "Generating on-device CA keypair (RSA-$KEY_SIZE, software key)")
        val keyPair = newRsaKeyPair()
        val cert = buildSelfSignedCert(
            subject   = "CN=AI CAGE Local CA, O=AI CAGE, C=TN",
            keyPair   = keyPair,
            validDays = VALIDITY_DAYS_CA,
            isCA      = true,
        )
        Log.i(TAG, "Local CA ready — serial ${cert.serialNumber}")
        return Pair(keyPair, cert)
    }

    private fun generateHostCert(
        host: String,
        caKeyPair: KeyPair,
        caCert: X509Certificate,
    ): Pair<KeyPair, X509Certificate> {
        val hostKeyPair = newRsaKeyPair()
        val cert = buildSignedCert(
            subject   = "CN=$host, O=AI CAGE Local Proxy, C=TN",
            san       = host,
            publicKey = hostKeyPair.public,
            issuer    = caCert,
            signerKey = caKeyPair.private,
            validDays = VALIDITY_DAYS_HOST,
        )
        return Pair(hostKeyPair, cert)
    }

    // ── BouncyCastle implementations ──────────────────────────────────────────

    /**
     * Builds a self-signed X.509 v3 certificate using BouncyCastle.
     *
     * Extensions added:
     *   - BasicConstraints: cA=true, pathLenConstraint=0
     *   - KeyUsage: keyCertSign + cRLSign
     *
     * @param subject  X.500 distinguished name string, e.g. "CN=AI CAGE Local CA, O=AI CAGE, C=TN"
     * @param keyPair  RSA keypair; the public key goes in the cert, private key signs it.
     * @param validDays Certificate validity in days from now.
     * @param isCA     Whether to set BasicConstraints.cA = true.
     */
    private fun buildSelfSignedCert(
        subject: String,
        keyPair: KeyPair,
        validDays: Int,
        isCA: Boolean,
    ): X509Certificate {
        val now     = Date()
        val notAfter = Date(now.time + validDays.toLong() * 86_400_000L)
        val serial  = BigInteger.valueOf(SecureRandom().nextLong().and(Long.MAX_VALUE))

        val x500Name = X500Name(subject)

        val builder = JcaX509v3CertificateBuilder(
            /* issuer     */ x500Name,
            /* serial     */ serial,
            /* notBefore  */ now,
            /* notAfter   */ notAfter,
            /* subject    */ x500Name,
            /* publicKey  */ keyPair.public,
        )

        // BasicConstraints — mark as CA so the cert can sign end-entity certs
        builder.addExtension(
            Extension.basicConstraints,
            /* critical */ true,
            BasicConstraints(/* isCA */ isCA),
        )

        // KeyUsage — keyCertSign allows signing end-entity certs; cRLSign for completeness
        if (isCA) {
            builder.addExtension(
                Extension.keyUsage,
                /* critical */ true,
                KeyUsage(KeyUsage.keyCertSign or KeyUsage.cRLSign),
            )
        }

        val signer = JcaContentSignerBuilder(SIGN_ALGORITHM).build(keyPair.private)
        return JcaX509CertificateConverter().getCertificate(builder.build(signer))
    }

    /**
     * Builds an end-entity X.509 v3 certificate signed by [issuer] / [signerKey].
     *
     * Extensions added:
     *   - BasicConstraints: cA=false
     *   - SubjectAlternativeName: dNSName=[san]  — required for modern TLS validation
     *
     * @param subject   X.500 name for the end-entity (e.g. the AI hostname).
     * @param san       DNS name for the SubjectAlternativeName extension (the intercepted host).
     * @param publicKey The end-entity's public key (goes in the cert).
     * @param issuer    The CA certificate that will sign this cert.
     * @param signerKey The CA's private key used to sign.
     * @param validDays Certificate validity in days from now.
     */
    private fun buildSignedCert(
        subject: String,
        san: String,
        publicKey: PublicKey,
        issuer: X509Certificate,
        signerKey: PrivateKey,
        validDays: Int,
    ): X509Certificate {
        val now      = Date()
        val notAfter = Date(now.time + validDays.toLong() * 86_400_000L)
        val serial   = BigInteger.valueOf(SecureRandom().nextLong().and(Long.MAX_VALUE))

        val builder = JcaX509v3CertificateBuilder(
            /* issuer    */ issuer,
            /* serial    */ serial,
            /* notBefore */ now,
            /* notAfter  */ notAfter,
            /* subject   */ X500Name(subject),
            /* publicKey */ publicKey,
        )

        // Not a CA
        builder.addExtension(
            Extension.basicConstraints,
            /* critical */ true,
            BasicConstraints(/* isCA */ false),
        )

        // SubjectAlternativeName — required by modern browsers and TLS stacks;
        // without this the SSL handshake will fail on Android 9+
        val sanExtension = GeneralNames(
            GeneralName(GeneralName.dNSName, san)
        )
        builder.addExtension(
            Extension.subjectAlternativeName,
            /* critical */ false,
            sanExtension,
        )

        val signer = JcaContentSignerBuilder(SIGN_ALGORITHM).build(signerKey)
        return JcaX509CertificateConverter().getCertificate(builder.build(signer))
    }

    // ── Helper: SSLContext from keypair + cert chain ──────────────────────────

    private fun buildSslContext(
        keyPair: KeyPair,
        cert: X509Certificate,
        caCert: X509Certificate,
    ): SSLContext {
        val ks = KeyStore.getInstance("PKCS12").apply {
            load(null, null)
            setKeyEntry("proxy", keyPair.private, null, arrayOf(cert, caCert))
        }
        val kmf = KeyManagerFactory
            .getInstance(KeyManagerFactory.getDefaultAlgorithm())
            .apply { init(ks, null) }
        return SSLContext.getInstance("TLS").apply {
            init(kmf.keyManagers, null, null)
        }
    }

    // ── Helper: RSA keypair ───────────────────────────────────────────────────

    private fun newRsaKeyPair(): KeyPair {
        val gen = KeyPairGenerator.getInstance("RSA")
        gen.initialize(KEY_SIZE, SecureRandom())
        return gen.generateKeyPair()
    }
}
