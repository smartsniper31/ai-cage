// Mock for @react-native-async-storage/async-storage in Jest (Node environment)
const store: Record<string, string> = {};
export default {
  getItem:    jest.fn((k: string) => Promise.resolve(store[k] ?? null)),
  setItem:    jest.fn((k: string, v: string) => { store[k] = v; return Promise.resolve(); }),
  removeItem: jest.fn((k: string) => { delete store[k]; return Promise.resolve(); }),
  clear:      jest.fn(() => { Object.keys(store).forEach(k => delete store[k]); return Promise.resolve(); }),
  getAllKeys:  jest.fn(() => Promise.resolve(Object.keys(store))),
};
