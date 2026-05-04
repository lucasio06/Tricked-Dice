import { describe, it, expect, beforeEach, vi } from 'vitest';
import { BlackjackComponent } from './blackjack.component';
import { of } from 'rxjs';

describe('BlackjackComponent', () => {
  let component: BlackjackComponent;
  let apiServiceMock: any;
  let authServiceMock: any;
  let toastServiceMock: any;

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
    component = new BlackjackComponent(
      apiServiceMock,
      authServiceMock as any,
      toastServiceMock as any
    );
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should initialize saldo from auth service on ngOnInit', () => {
    component.ngOnInit();
    expect(component.saldo).toBe(1000);
  });

  it('should show warning when betting more than saldo', () => {
    component.saldo = 100;
    component.montoApuesta = 2000;
    component.repartir();
    expect(toastServiceMock.warning).toHaveBeenCalledWith('Monto de apuesta inválido.');
    expect(apiServiceMock.post).not.toHaveBeenCalled();
  });

  it('should call repartir endpoint with correct monto', () => {
    const mockResponse = {
      idPartida: 'abc123',
      manoJugador: ['AC', '5D'],
      manoCrupier: ['KT'],
      saldoActualizado: 990
    };
    apiServiceMock.post.mockReturnValue(of(mockResponse));
    component.saldo = 1000;
    component.montoApuesta = 10;
    component.repartir();

    expect(apiServiceMock.post).toHaveBeenCalledWith('/blackjack/repartir', { monto: 10 });
    expect(component.manoJugador).toEqual(['AC', '5D']);
    expect(component.saldo).toBe(990);
  });

  it('should calculate hand value correctly with numbers', () => {
    expect(component.puntuacionMano(['5C', '8D'])).toBe(13);
  });

  it('should calculate with face cards', () => {
    expect(component.puntuacionMano(['KP', 'JD'])).toBe(20);
  });

  it('should calculate with Ace as 11', () => {
    expect(component.puntuacionMano(['AC', '5D'])).toBe(16);
  });

  it('should calculate with Ace as 1 when over 21', () => {
    expect(component.puntuacionMano(['AC', '5D', 'KT'])).toBe(16);
  });

  it('should calculate with double Ace', () => {
    expect(component.puntuacionMano(['AC', 'AD'])).toBe(12);
  });

  it('should detect red cards', () => {
    expect(component.esRojo('C')).toBe(true);
    expect(component.esRojo('D')).toBe(true);
    expect(component.esRojo('T')).toBe(false);
    expect(component.esRojo('P')).toBe(false);
  });

  it('should reset all state on nuevaPartida', () => {
    component.manoJugador = ['AC'];
    component.manoCrupier = ['KT'];
    component.juegoIniciado = true;
    component.juegoTerminado = true;
    component.resultado = 'victoria';
    component.mensaje = 'test';
    component.nuevaPartida();

    expect(component.manoJugador).toEqual([]);
    expect(component.manoCrupier).toEqual([]);
    expect(component.juegoIniciado).toBe(false);
    expect(component.juegoTerminado).toBe(false);
    expect(component.resultado).toBe('');
    expect(component.mensaje).toBe('');
  });
});