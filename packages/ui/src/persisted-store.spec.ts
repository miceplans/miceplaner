import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

class FakeStorage {
  data = new Map<string, string>();
  getItem = (key: string) => this.data.get(key) ?? null;
  setItem = (key: string, value: string) => void this.data.set(key, value);
  removeItem = (key: string) => void this.data.delete(key);
}

const strings = (raw: unknown): string[] => (Array.isArray(raw) ? raw.filter((v): v is string => typeof v === 'string') : ['기본']);

let local: FakeStorage;
let session: FakeStorage;
let target: EventTarget;

/** 다른 탭이 저장소를 바꿨을 때의 storage 이벤트. */
const storageEvent = (key: string | null) => target.dispatchEvent(Object.assign(new Event('storage'), { key, storageArea: local }));

async function load() {
  vi.resetModules();
  return import('./persisted-store');
}

beforeEach(() => {
  vi.useFakeTimers();
  local = new FakeStorage();
  session = new FakeStorage();
  target = new EventTarget();
  vi.stubGlobal('window', Object.assign(target, { localStorage: local, sessionStorage: session }));
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('createPersistedStore', () => {
  it('hydration 전에는 기본값이고, 이후 기존 형식의 저장값을 읽는다', async () => {
    const { createPersistedStore } = await load();
    local.setItem('k', '["a","b"]');
    const store = createPersistedStore({ key: 'k', fallback: ['기본'], decode: strings });
    expect(store.api.getState().value).toEqual(['기본']);
    store.hydrate();
    expect(store.api.getState().value).toEqual(['a', 'b']);
    expect(store.api.getInitialState().value).toEqual(['기본']);
    expect(local.getItem('k')).toBe('["a","b"]');
  });

  it('읽기 전에 갱신해도 저장값을 덮어쓰지 않고, 값 그대로 저장한다', async () => {
    const { createPersistedStore } = await load();
    local.setItem('k', '["a"]');
    const store = createPersistedStore({ key: 'k', fallback: [] as string[], decode: strings });
    store.set((prev) => [...prev, 'b']);
    expect(local.getItem('k')).toBe('["a","b"]');
  });

  it('깨진 저장값은 기본값으로 돌아간다', async () => {
    const { createPersistedStore } = await load();
    local.setItem('k', '{');
    const store = createPersistedStore({ key: 'k', fallback: ['기본'], decode: strings });
    expect(store.get()).toEqual(['기본']);
  });

  it('지연 쓰기는 마지막 값만 쓰고, pagehide 때 비운다', async () => {
    const { createPersistedStore } = await load();
    const store = createPersistedStore({ key: 'k', fallback: [] as string[], decode: strings, delay: 400 });
    store.set(['a']);
    store.set(['b']);
    expect(local.getItem('k')).toBeNull();
    vi.advanceTimersByTime(400);
    expect(local.getItem('k')).toBe('["b"]');
    store.set(['c']);
    target.dispatchEvent(new Event('pagehide'));
    expect(local.getItem('k')).toBe('["c"]');
  });

  it('다른 탭의 변경을 읽되, 쓰기 대기 중인 내 변경은 유지한다', async () => {
    const { createPersistedStore } = await load();
    const store = createPersistedStore({ key: 'k', fallback: [] as string[], decode: strings, delay: 400 });
    store.hydrate();
    local.setItem('k', '["다른 탭"]');
    storageEvent('k');
    expect(store.get()).toEqual(['다른 탭']);

    store.set(['내 변경']);
    local.setItem('k', '["또 다른 탭"]');
    storageEvent('k');
    expect(store.get()).toEqual(['내 변경']);
    vi.advanceTimersByTime(400);
    expect(local.getItem('k')).toBe('["내 변경"]');

    local.removeItem('k');
    storageEvent(null);
    expect(store.get()).toEqual(['기본']);
  });

  it('encode가 undefined를 돌려주면 키를 지운다', async () => {
    const { createPersistedStore } = await load();
    local.setItem('k', '["a"]');
    const store = createPersistedStore<string[] | null>({ key: 'k', fallback: null, decode: strings, encode: (v) => v ?? undefined });
    store.set(null);
    expect(local.getItem('k')).toBeNull();
  });

  it('저장소를 쓸 수 없어도 값은 메모리에 남는다', async () => {
    const { createPersistedStore } = await load();
    local.getItem = local.setItem = () => {
      throw new Error('차단됨');
    };
    const store = createPersistedStore({ key: 'k', fallback: [] as string[], decode: strings });
    store.set(['a']);
    expect(store.get()).toEqual(['a']);
  });

  it('session 영역은 sessionStorage에 저장한다', async () => {
    const { createPersistedStore } = await load();
    const store = createPersistedStore({ key: 'k', fallback: [] as string[], decode: strings, area: 'session' });
    store.set(['a']);
    expect(session.getItem('k')).toBe('["a"]');
    expect(local.getItem('k')).toBeNull();
  });
});

it('scopedStores는 범위마다 같은 스토어를 돌려준다', async () => {
  const { scopedStores } = await load();
  const storeOf = scopedStores((scope) => ({ scope }));
  expect(storeOf('a')).toBe(storeOf('a'));
  expect(storeOf('a')).not.toBe(storeOf('b'));
});
