import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../auth.service';
import { ToastService } from '../services/toast.service';
import { NavbarComponent } from '../shared/navbar/navbar.component';
import { ApiService } from '../services/api.service';
import { RepartirResponse, CambiarResponse } from '../models/api-responses';

@Component({
  selector: 'app-video-poker',
  standalone: true,
  imports: [CommonModule, FormsModule, NavbarComponent],
  templateUrl: './video-poker.component.html',
  styleUrls: ['./video-poker.component.scss']
})
export class VideoPokerComponent implements OnInit {
  mano: string[] = [];
  cartasSeleccionadas: boolean[] = [false, false, false, false, false];
  montoApuesta: number = 10;
  saldo: number = 0;
  mensaje: string = '';
  cargando: boolean = false;
  juegoIniciado: boolean = false;
  premioActual: number = 0;
  animandoReparto: boolean = false;
  cambiando: boolean = false;

  private audioContext: AudioContext | null = null;

  constructor(
    private api: ApiService,
    private authService: AuthService,
    private toast: ToastService
  ) {}

  ngOnInit(): void {
    this.authService.usuario$.subscribe(usuario => {
      if (usuario) {
        this.saldo = usuario.saldo;
      }
    });
  }

  repartir(): void {
    if (this.montoApuesta <= 0 || this.montoApuesta > this.saldo) {
      this.toast.warning('Monto de apuesta inválido.');
      return;
    }

    this.cargando = true;
    this.mensaje = '';
    this.api.post<RepartirResponse>(
      '/videopoker/repartir',
      { monto: this.montoApuesta }
    ).subscribe({
      next: (res) => {
        this.mano = res.mano;
        this.saldo = res.saldoActualizado;
        this.authService.actualizarSaldo(res.saldoActualizado);
        this.cartasSeleccionadas = [false, false, false, false, false];
        this.juegoIniciado = true;
        this.premioActual = 0;
        this.mensaje = 'Selecciona las cartas que quieres cambiar';
        this.cargando = false;
        this.animarEntrada();
        this.sonidoRepartir();
      },
      error: (err) => {
        this.cargando = false;
        this.toast.error(err.error?.mensaje || 'Error al repartir');
      }
    });
  }

  cambiar(): void {
    if (!this.juegoIniciado) {
      this.toast.warning('Primero debes repartir una mano.');
      return;
    }

    const haySeleccionadas = this.cartasSeleccionadas.some(s => s);
    if (haySeleccionadas) {
      this.cambiando = true;
      setTimeout(() => {
        this.procesarCambio();
      }, 350);
    } else {
      this.procesarCambio();
    }
  }

  toggleSeleccion(index: number): void {
    if (this.juegoIniciado) {
      this.sonidoSeleccion();
      this.cartasSeleccionadas[index] = !this.cartasSeleccionadas[index];
    }
  }

  private procesarCambio(): void {
    const indices = this.cartasSeleccionadas
      .map((sel, i) => sel ? i : -1)
      .filter(i => i !== -1);

    this.cargando = true;
    this.api.post<CambiarResponse>(
      '/videopoker/cambiar',
      {
        mano: this.mano,
        indicesACambiar: indices,
        montoApostado: this.montoApuesta
      }
    ).subscribe({
      next: (res) => {
        this.mano = res.manoFinal;
        this.saldo = res.saldoActualizado;
        this.authService.actualizarSaldo(res.saldoActualizado);
        this.premioActual = res.premio;
        this.juegoIniciado = false;
        this.cambiando = false;
        this.animarEntrada();
        
        if (res.premio > 0) {
          this.mensaje = `¡${res.nombreMano}! Ganaste ${res.premio.toFixed(2)} €`;
          this.sonidoGanar();
          this.toast.win(`¡${res.nombreMano}! +${res.premio.toFixed(2)}€`);
        } else {
          this.mensaje = `Sin premio. ¡Mejor suerte la próxima!`;
          this.sonidoPerder();
          this.toast.lose(`Sin premio.`);
        }
        
        this.cargando = false;
      },
      error: (err) => {
        this.cambiando = false;
        this.cargando = false;
        this.toast.error(err.error?.mensaje || 'Error al cambiar cartas');
      }
    });
  }

  private animarEntrada(): void {
    this.animandoReparto = false;
    setTimeout(() => {
      this.animandoReparto = true;
    }, 10);
  }

  obtenerValor(carta: string): string {
    if (carta.length === 3) return carta.substring(0, 2);
    return carta.charAt(0);
  }

  obtenerPalo(carta: string): string {
    const ultimo = carta.charAt(carta.length - 1);
    switch (ultimo) {
      case 'C': return '♥';
      case 'D': return '♦';
      case 'T': return '♣';
      case 'P': return '♠';
      default: return '';
    }
  }

  esRojo(palo: string): boolean {
    return palo === 'C' || palo === 'D';
  }

  private getAudioContext(): AudioContext {
    if (!this.audioContext) {
      this.audioContext = new AudioContext();
    }
    return this.audioContext;
  }

  private sonidoSeleccion(): void {
    const ctx = this.getAudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = 'sine';
    osc.frequency.setValueAtTime(1000, ctx.currentTime);
    gain.gain.setValueAtTime(0.05, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.03);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.03);
  }

  private sonidoRepartir(): void {
    const ctx = this.getAudioContext();
    for (let i = 0; i < 5; i++) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = 'sine';
      const tiempo = ctx.currentTime + i * 0.08;
      osc.frequency.setValueAtTime(600 + i * 100, tiempo);
      gain.gain.setValueAtTime(0.06, tiempo);
      gain.gain.exponentialRampToValueAtTime(0.001, tiempo + 0.1);
      osc.start(tiempo);
      osc.stop(tiempo + 0.1);
    }
  }

  private sonidoGanar(): void {
    const ctx = this.getAudioContext();
    const notas = [523, 659, 784, 1047];
    notas.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = 'sine';
      const tiempo = ctx.currentTime + i * 0.12;
      osc.frequency.setValueAtTime(freq, tiempo);
      gain.gain.setValueAtTime(0.12, tiempo);
      gain.gain.exponentialRampToValueAtTime(0.001, tiempo + 0.2);
      osc.start(tiempo);
      osc.stop(tiempo + 0.2);
    });
  }

  private sonidoPerder(): void {
    const ctx = this.getAudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = 'sine';
    osc.frequency.setValueAtTime(300, ctx.currentTime);
    osc.frequency.linearRampToValueAtTime(150, ctx.currentTime + 0.4);
    gain.gain.setValueAtTime(0.1, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.4);
  }
}