import '@angular/compiler';
import 'zone.js';

const fakeLocalStorage = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, value: string) => { store[key] = value; },
    removeItem: (key: string) => { delete store[key]; },
    clear: () => { store = {}; },
    get length() { return Object.keys(store).length; },
    key: (index: number) => Object.keys(store)[index] ?? null
  };
})();

Object.defineProperty(globalThis, 'localStorage', {
  value: fakeLocalStorage,
  writable: true
});

class FakeAudioContext {
  sampleRate = 44100;
  destination = { maxChannelCount: 2 };
  currentTime = 0;
  state: AudioContextState = 'running';
  onstatechange: ((this: AudioContext, ev: Event) => any) | null = null;

  createOscillator() {
    return {
      type: 'sine',
      frequency: { setValueAtTime: () => {}, linearRampToValueAtTime: () => {} },
      connect: () => {},
      start: () => {},
      stop: () => {},
    };
  }
  createGain() {
    return {
      gain: { setValueAtTime: () => {}, linearRampToValueAtTime: () => {}, exponentialRampToValueAtTime: () => {} },
      connect: () => {},
    };
  }
  close() {}
}

Object.defineProperty(globalThis, 'AudioContext', {
  value: FakeAudioContext,
  writable: true
});