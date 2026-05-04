import { describe, it, expect, beforeEach, vi } from 'vitest';
import { RuletaComponent } from './ruleta.component';
import { of } from 'rxjs';

describe('RuletaComponent', () => {
  let component: RuletaComponent;
  let apiServiceMock: any;
  let authServiceMock: any;
  let toastServiceMock: any;
  const routerMock = { navigate: vi.fn() };
  const ngZoneMock = { run: vi.fn((fn: Function) => fn()) };

  beforeEach(() => {
    apiServiceMock = {
      post: vi.fn(),
      get: vi.fn()
    };
    authServiceMock = {
      usuario$: of({ nombre: 'Test', email: 'test@test.com', saldo: 1000 }),
      actualizarSaldo: vi.fn()
    };
    toastServiceMock = {
      warning: vi.fn(),
      error: vi.fn(),
      win: vi.fn(),
      lose: vi.fn()
    };
    component = new RuletaComponent(
      apiServiceMock,
      authServiceMock as any,
      toastServiceMock as any,
      routerMock as any,
      ngZoneMock as any
    );
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should initialize saldo from auth service on ngOnInit', () => {
    component.ngOnInit();
    expect(component.saldo).toBe(1000);
  });

  it('should return false for invalid bet when monto is 0', () => {
    component.saldo = 100;
    component.montoApuesta = 0;
    expect(component.apuestaValida()).toBe(false);
  });

  it('should return false when monto exceeds saldo', () => {
    component.saldo = 100;
    component.montoApuesta = 200;
    expect(component.apuestaValida()).toBe(false);
  });

  it('should return true for valid color bet', () => {
    component.saldo = 100;
    component.montoApuesta = 10;
    component.tipoApuesta = 'color';
    component.valorApuesta = 'rojo';
    expect(component.apuestaValida()).toBe(true);
  });

  it('should set tipoApuesta and valorApuesta when selecting color', () => {
    component.seleccionarColor('negro');
    expect(component.tipoApuesta).toBe('color');
    expect(component.valorApuesta).toBe('negro');
  });

  it('should return true when number is red', () => {
    expect(component.esRojo(1)).toBe(true);
    expect(component.esRojo(3)).toBe(true);
    expect(component.esRojo(12)).toBe(true);
  });

  it('should return false when number is black', () => {
    expect(component.esRojo(2)).toBe(false);
    expect(component.esRojo(4)).toBe(false);
    expect(component.esRojo(15)).toBe(false);
  });

  it('should return false for zero', () => {
    expect(component.esRojo(0)).toBe(false);
  });
});