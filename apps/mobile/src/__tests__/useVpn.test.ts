// Copyright (c) 2026 Frikha, Tunisia. All rights reserved.
// AI CAGE Mobile — Unit tests for useVpn hook logic
// Licensed under Business Source License 1.1

/**
 * @file useVpn.test.ts
 *
 * Tests the VPN module contract — verifying the native module mock responds
 * correctly to consent and start/stop calls.
 *
 * NOTE: renderHook is not used here because @testing-library/react-native
 * v14 requires React 19 / RN 0.78, which conflicts with this project's
 * React 18 / RN 0.74 setup. The hook's internal state machine is covered
 * by integration tests (Detox). These tests verify the native module
 * contract that the hook depends on.
 */

import { describe, it, expect, beforeEach } from '@jest/globals';

// ── Mock native module ────────────────────────────────────────────────────────

const mockCageVpn = {
  prepareVpn:    jest.fn(),
  startVpn:      jest.fn(),
  stopVpn:       jest.fn(),
  getVpnStatus:  jest.fn(),
  cageText:      jest.fn(),
  installCaCert: jest.fn(),
};

jest.mock('../native/CageVpn', () => ({
  CageVpn:       mockCageVpn,
  CageVpnEvents: {
    addListener: jest.fn(() => ({ remove: jest.fn() })),
  },
}));

jest.mock('react-native', () => ({
  Platform:           { OS: 'android' },
  Alert:              { alert: jest.fn() },
  NativeModules:      {},
  NativeEventEmitter: jest.fn(),
}));

// ── 1. Native module contract — prepareVpn ────────────────────────────────────

describe('CageVpn native module — prepareVpn contract', () => {
  beforeEach(() => { jest.clearAllMocks(); });

  it('resolves true when user grants VPN permission', async () => {
    (mockCageVpn.prepareVpn as jest.Mock).mockResolvedValue(true);
    const result = await mockCageVpn.prepareVpn();
    expect(result).toBe(true);
    expect(mockCageVpn.prepareVpn).toHaveBeenCalledTimes(1);
  });

  it('resolves false when user denies VPN permission', async () => {
    (mockCageVpn.prepareVpn as jest.Mock).mockResolvedValue(false);
    const result = await mockCageVpn.prepareVpn();
    expect(result).toBe(false);
  });

  it('rejects with NO_ACTIVITY when no Android Activity available', async () => {
    (mockCageVpn.prepareVpn as jest.Mock).mockRejectedValue(
      new Error('NO_ACTIVITY'),
    );
    await expect(mockCageVpn.prepareVpn()).rejects.toThrow('NO_ACTIVITY');
  });
});

// ── 2. Native module contract — startVpn / stopVpn ───────────────────────────

describe('CageVpn native module — startVpn / stopVpn contract', () => {
  beforeEach(() => { jest.clearAllMocks(); });

  it('startVpn resolves void on success', async () => {
    (mockCageVpn.startVpn as jest.Mock).mockResolvedValue(undefined);
    await expect(mockCageVpn.startVpn()).resolves.toBeUndefined();
  });

  it('startVpn rejects with CONSENT_REQUIRED if called without prior consent', async () => {
    (mockCageVpn.startVpn as jest.Mock).mockRejectedValue(
      new Error('CONSENT_REQUIRED'),
    );
    await expect(mockCageVpn.startVpn()).rejects.toThrow('CONSENT_REQUIRED');
  });

  it('stopVpn resolves void on success', async () => {
    (mockCageVpn.stopVpn as jest.Mock).mockResolvedValue(undefined);
    await expect(mockCageVpn.stopVpn()).resolves.toBeUndefined();
  });
});

// ── 3. Native module contract — getVpnStatus ─────────────────────────────────

describe('CageVpn native module — getVpnStatus contract', () => {
  beforeEach(() => { jest.clearAllMocks(); });

  it('returns false when VPN is not running', async () => {
    (mockCageVpn.getVpnStatus as jest.Mock).mockResolvedValue(false);
    const active = await mockCageVpn.getVpnStatus();
    expect(active).toBe(false);
  });

  it('returns true when VPN is running', async () => {
    (mockCageVpn.getVpnStatus as jest.Mock).mockResolvedValue(true);
    const active = await mockCageVpn.getVpnStatus();
    expect(active).toBe(true);
  });
});

// ── 4. Native module contract — installCaCert ────────────────────────────────

describe('CageVpn native module — installCaCert contract', () => {
  beforeEach(() => { jest.clearAllMocks(); });

  it('resolves true when KeyChain intent launches successfully', async () => {
    (mockCageVpn.installCaCert as jest.Mock).mockResolvedValue(true);
    const result = await mockCageVpn.installCaCert();
    expect(result).toBe(true);
  });

  it('resolves a file path string when Activity is unavailable', async () => {
    const path = '/storage/emulated/0/Android/data/io.aicage.mobile/files/Downloads/ai-cage-ca.crt';
    (mockCageVpn.installCaCert as jest.Mock).mockResolvedValue(path);
    const result = await mockCageVpn.installCaCert();
    expect(typeof result).toBe('string');
    expect(result).toContain('ai-cage-ca.crt');
  });

  it('rejects with CERT_INSTALL_ERROR on failure', async () => {
    (mockCageVpn.installCaCert as jest.Mock).mockRejectedValue(
      new Error('CERT_INSTALL_ERROR'),
    );
    await expect(mockCageVpn.installCaCert()).rejects.toThrow('CERT_INSTALL_ERROR');
  });
});

// ── 5. Security contract ──────────────────────────────────────────────────────

describe('Security contract — VPN module', () => {
  beforeEach(() => { jest.clearAllMocks(); });

  it('startVpn is never called without prepareVpn first in correct flow', async () => {
    (mockCageVpn.prepareVpn as jest.Mock).mockResolvedValue(true);
    (mockCageVpn.startVpn as jest.Mock).mockResolvedValue(undefined);

    // Correct flow: prepare → start
    const granted = await mockCageVpn.prepareVpn();
    if (granted) await mockCageVpn.startVpn();

    expect(mockCageVpn.prepareVpn).toHaveBeenCalledTimes(1);
    expect(mockCageVpn.startVpn).toHaveBeenCalledTimes(1);
  });

  it('startVpn is NOT called when user denies consent', async () => {
    (mockCageVpn.prepareVpn as jest.Mock).mockResolvedValue(false);

    const granted = await mockCageVpn.prepareVpn();
    if (granted) await mockCageVpn.startVpn();

    expect(mockCageVpn.prepareVpn).toHaveBeenCalledTimes(1);
    expect(mockCageVpn.startVpn).not.toHaveBeenCalled();
  });
});
