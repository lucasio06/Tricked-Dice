import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AuthService } from './auth.service';
import { ApiService } from './services/api.service';
import { of } from 'rxjs';

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

describe('AuthService', () => {
  let service: AuthService;
  let apiServiceMock: any;
  let routerMock: any;

  beforeEach(() => {
    fakeLocalStorage.clear();

    apiServiceMock = {
      get: vi.fn(),
      post: vi.fn(),
      put: vi.fn(),
      delete: vi.fn()
    };

    routerMock = {
      navigate: vi.fn()
    };

    service = new AuthService(apiServiceMock, routerMock);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should return false when not logged in', () => {
    expect(service.isLoggedIn()).toBe(false);
  });

  it('should return true when token exists', () => {
    fakeLocalStorage.setItem('token', 'test-token');
    expect(service.isLoggedIn()).toBe(true);
  });

  it('should call login endpoint and store token', () => {
    const mockResponse = { token: 'abc123', nombre: 'Test', saldo: 100 };
    apiServiceMock.post.mockReturnValue(of(mockResponse));

    service.login('test@test.com', 'password').subscribe();

    expect(apiServiceMock.post).toHaveBeenCalledWith('/usuarios/login', {
      Email: 'test@test.com',
      Password: 'password'
    });
    expect(fakeLocalStorage.getItem('token')).toBe('abc123');
  });

  it('should clear storage and navigate on logout', () => {
    fakeLocalStorage.setItem('token', 'test-token');
    service.logout();

    expect(fakeLocalStorage.getItem('token')).toBeNull();
    expect(fakeLocalStorage.getItem('user_cache')).toBeNull();
    expect(routerMock.navigate).toHaveBeenCalledWith(['/']);
  });

  it('should return null for getUsuarioActual when not logged in', () => {
    expect(service.getUsuarioActual()).toBeNull();
  });

  it('should return null for getToken when no token exists', () => {
    expect(service.getToken()).toBeNull();
  });

  it('should return token when it exists', () => {
    fakeLocalStorage.setItem('token', 'test-token');
    expect(service.getToken()).toBe('test-token');
  });
});