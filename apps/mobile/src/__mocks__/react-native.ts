// Minimal react-native mock for Jest (Node environment)
// Only provides the APIs used by AI CAGE mobile tests.
export const Platform = {
  OS: 'android' as const,
  Version: 33,
  select: (obj: Record<string, unknown>) => obj['android'],
};
export const Alert   = { alert: jest.fn() };
export const Linking = {
  openSettings: jest.fn(() => Promise.resolve()),
  openURL:      jest.fn(() => Promise.resolve()),
  canOpenURL:   jest.fn(() => Promise.resolve(true)),
};
export const NativeModules = {
  CageVpn: {
    prepareVpn:    jest.fn(() => Promise.resolve(false)),
    startVpn:      jest.fn(() => Promise.resolve()),
    stopVpn:       jest.fn(() => Promise.resolve()),
    getVpnStatus:  jest.fn(() => Promise.resolve(false)),
    cageText:      jest.fn((t: string) => Promise.resolve(t)),
    installCaCert: jest.fn(() => Promise.resolve(true)),
  },
};
export const NativeEventEmitter = jest.fn().mockImplementation(() => ({
  addListener:        jest.fn(() => ({ remove: jest.fn() })),
  removeAllListeners: jest.fn(),
}));
export default {};
