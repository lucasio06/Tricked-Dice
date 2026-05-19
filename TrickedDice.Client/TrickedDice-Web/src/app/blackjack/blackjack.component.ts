import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../auth.service';
import { ToastService } from '../services/toast.service';
import { NavbarComponent } from '../shared/navbar/navbar.component';
import { ApiService } from '../services/api.service';

@Component({
  selector: 'app-blackjack',
  standalone: true,
  imports: [CommonModule, FormsModule, NavbarComponent],
  templateUrl: './blackjack.component.html',
  styleUrls: ['./blackjack.component.scss']
})
export class BlackjackComponent implements OnInit, OnDestroy {
  montoApuesta: number = 10;
  saldo: number = 0;
  manoJugador: string[] = [];
  manoCrupier: string[] = [];
  idPartida: string = '';
  juegoIniciado: boolean = false;
  juegoTerminado: boolean = false;
  cargando: boolean = false;
  mensaje: string = '';
  resultado: string = '';
  animandoEntrada: boolean = false;

  private audioContext: AudioContext | null = null;

  constructor(
    private apiService: ApiService,
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

  ngOnDestroy(): void {}

  async repartir(): Promise<void> {
    if (this.montoApuesta <= 0 || this.montoApuesta > this.saldo) {
      this.toast.warning('Monto de apuesta inválido.');
      return;
    }

    this.cargando = true;
    this.mensaje = '';
    this.resultado = '';
    this.juegoTerminado = false;
    this.manoCrupier = [];
    this.manoJugador = [];

    try {
      const response: any = await this.apiService.post('/blackjack/repartir', { monto: this.montoApuesta }).toPromise();
      this.idPartida = response.idPartida;
      this.manoJugador = response.manoJugador;
      this.manoCrupier = response.manoCrupier;
      this.saldo = response.saldoActualizado;
      this.authService.actualizarSaldo(response.saldoActualizado);
      this.juegoIniciado = true;
      this.cargando = false;
      this.animarEntrada();
      this.sonidoRepartir();
    } catch (error: any) {
      this.cargando = false;
      this.toast.error(error.error?.mensaje || 'Error al repartir');
    }
  }

  async pedir(): Promise<void> {
    if (!this.juegoIniciado || this.juegoTerminado || this.cargando) return;
    this.cargando = true;
    this.sonidoSeleccion();

    try {
      const response: any = await this.apiService.post('/blackjack/pedir', { idPartida: this.idPartida }).toPromise();
      if (response.carta) {
        this.manoJugador = response.manoJugador;
        this.animarEntrada();
      }
      if (response.terminada) {
        this.juegoTerminado = true;
        this.juegoIniciado = false;
        this.resultado = 'derrota';
        this.mensaje = '¡Te has pasado de 21!';
        this.sonidoPerder();
        if (response.saldoActualizado) {
          this.saldo = response.saldoActualizado;
          this.authService.actualizarSaldo(response.saldoActualizado);
        }
      }
      this.cargando = false;
    } catch (error: any) {
      this.cargando = false;
      this.toast.error(error.error?.mensaje || 'Error al pedir carta');
    }
  }

  async plantarse(): Promise<void> {
    if (!this.juegoIniciado || this.juegoTerminado || this.cargando) return;
    this.cargando = true;
    this.sonidoSeleccion();

    try {
      const response: any = await this.apiService.post('/blackjack/plantarse', { idPartida: this.idPartida }).toPromise();
      this.manoCrupier = response.manoCrupier;
      this.saldo = response.saldoActualizado;
      this.authService.actualizarSaldo(response.saldoActualizado);
      this.juegoTerminado = true;
      this.juegoIniciado = false;
      this.cargando = false;
      this.animarEntrada();

      if (response.resultado === 'jugador') {
        this.resultado = 'victoria';
        this.mensaje = '¡Has ganado!';
        this.sonidoGanar();
      } else if (response.resultado === 'empate') {
        this.resultado = 'empate';
        this.mensaje = 'Empate. Recuperas tu apuesta.';
      } else {
        this.resultado = 'derrota';
        this.mensaje = 'El crupier gana.';
        this.sonidoPerder();
      }
    } catch (error: any) {
      this.cargando = false;
      this.toast.error(error.error?.mensaje || 'Error al plantarse');
    }
  }

  nuevaPartida(): void {
    this.manoJugador = [];
    this.manoCrupier = [];
    this.juegoIniciado = false;
    this.juegoTerminado = false;
    this.resultado = '';
    this.mensaje = '';
    this.idPartida = '';
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

  puntuacionMano(mano: string[]): number {
    let total = 0;
    let ases = 0;
    for (const carta of mano) {
      const valor = this.obtenerValor(carta);
      if (valor === 'A') {
        ases++;
        total += 11;
      } else if (['J', 'Q', 'K'].includes(valor)) {
        total += 10;
      } else {
        total += parseInt(valor);
      }
    }
    while (total > 21 && ases > 0) {
      total -= 10;
      ases--;
    }
    return total;
  }

  private animarEntrada(): void {
    this.animandoEntrada = false;
    setTimeout(() => {
      this.animandoEntrada = true;
    }, 10);
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
    osc.frequency.setValueAtTime(800, ctx.currentTime);
    gain.gain.setValueAtTime(0.05, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.05);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.05);
  }

  private sonidoRepartir(): void {
    const ctx = this.getAudioContext();
    for (let i = 0; i < 4; i++) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = 'sine';
      const tiempo = ctx.currentTime + i * 0.1;
      osc.frequency.setValueAtTime(500 + i * 150, tiempo);
      gain.gain.setValueAtTime(0.06, tiempo);
      gain.gain.exponentialRampToValueAtTime(0.001, tiempo + 0.12);
      osc.start(tiempo);
      osc.stop(tiempo + 0.12);
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