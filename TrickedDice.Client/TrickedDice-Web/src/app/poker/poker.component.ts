import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../auth.service';
import { ToastService } from '../services/toast.service';
import { NavbarComponent } from '../shared/navbar/navbar.component';
import { SignalrService } from '../services/signalr.service';
import { RUTAS } from '../utils/rutas.const';

interface HistorialPoker {
  mano: string;
  premio: number;
  gano: boolean;
}

@Component({
  selector: 'app-poker',
  standalone: true,
  imports: [CommonModule, FormsModule, NavbarComponent],
  templateUrl: './poker.component.html',
  styleUrls: ['./poker.component.scss']
})
export class PokerComponent implements OnInit, OnDestroy {
  mano: string[] = [];
  cartasSeleccionadas: boolean[] = [false, false, false, false, false];
  animandoCards: boolean[] = [false, false, false, false, false];
  montoApuesta: number = 10;
  saldo: number = 0;
  mensaje: string = '';
  cargando: boolean = false;
  juegoIniciado: boolean = false;
  premioActual: number = 0;
  cambiando: boolean = false;
  nombreManoActual: string = '';
  historial: HistorialPoker[] = [];
  currentUserEmail: string = '';

  private audioContext: AudioContext | null = null;

  constructor(
    private signalrService: SignalrService,
    private authService: AuthService,
    private toast: ToastService,
    private router: Router
  ) {}

  async ngOnInit(): Promise<void> {
    this.authService.usuario$.subscribe(usuario => {
      if (usuario) {
        this.saldo = usuario.saldo;
        this.currentUserEmail = usuario.email || '';
      }
    });

    const conectado = await this.signalrService.startConnection('/hubs/poker');
    if (!conectado) {
      this.toast.error('No se pudo conectar al juego.');
      return;
    }

    this.signalrService.on("ForceLogout", (emailBaneado: string) => {
      if (this.currentUserEmail.toLowerCase() === emailBaneado.toLowerCase()) {
        this.authService.logout();
        this.toast.error("HAS SIDO BANEADO DEL SERVIDOR.");
      }
    });

    this.signalrService.on('ManoRepartida', (res: any) => {
      this.mano = res.mano;
      this.saldo = res.saldoActualizado;
      this.authService.actualizarSaldo(res.saldoActualizado);
      this.cartasSeleccionadas = [false, false, false, false, false];
      this.animandoCards = [true, true, true, true, true];
      this.juegoIniciado = true;
      this.premioActual = 0;
      
      this.nombreManoActual = this.traducirMano(res.nombreMano);

      this.mensaje = 'SELECCIONA LAS CARTAS QUE QUIERES DESCARTAR';
      this.cargando = false; 
      this.sonidoRepartir();
    });

    this.signalrService.on('CartasCambiadas', (res: any) => {
      this.mano = res.manoFinal;
      this.saldo = res.saldoActualizado;
      this.authService.actualizarSaldo(res.saldoActualizado);
      this.premioActual = res.premio;
      this.juegoIniciado = false;
      this.cambiando = false;
      
      this.animandoCards = [...this.cartasSeleccionadas];
      this.cartasSeleccionadas = [false, false, false, false, false];

      this.nombreManoActual = this.traducirMano(res.nombreMano);

      this.historial.unshift({
        mano: this.nombreManoActual,
        premio: res.premio,
        gano: res.premio > 0
      });
      if (this.historial.length > 10) this.historial.pop();

      if (res.premio > 0) {
        this.mensaje = `¡GANASTE ${res.premio.toFixed(2)} €!`;
        this.sonidoGanar();
        this.toast.win(`¡${this.nombreManoActual}! +${res.premio.toFixed(2)}€`);
      } else {
        this.mensaje = 'SIN PREMIO. ¡INTÉNTALO DE NUEVO!';
        this.sonidoPerder();
        this.toast.lose('Sin premio.');
      }
      this.cargando = false;
    });

    this.signalrService.on('Error', (mensaje: string) => {
      this.cargando = false;
      this.cambiando = false;
      this.toast.error(mensaje);
    });
  }

  ngOnDestroy(): void {
    this.signalrService.stopConnection();
  }

  async repartir(): Promise<void> {
    if (this.montoApuesta <= 0) {
      this.toast.warning('Monto de apuesta inválido.');
      return;
    }
    
    if (this.montoApuesta > this.saldo) {
      this.toast.warning('Saldo insuficiente.');
      return;
    }

    this.cargando = true;
    this.mensaje = '';
    this.nombreManoActual = '';
    this.mano = [];
    this.animandoCards = [false, false, false, false, false];
    this.cartasSeleccionadas = [false, false, false, false, false];
    this.cambiando = false;
    await this.signalrService.invoke('Repartir', this.montoApuesta);
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

  private async procesarCambio(): Promise<void> {
    const indices = this.cartasSeleccionadas
      .map((descartar, i) => descartar ? i : -1)
      .filter(i => i !== -1);

    this.cargando = true;
    this.animandoCards = [false, false, false, false, false];
    await this.signalrService.invoke('CambiarCartas', this.mano, indices, this.montoApuesta);
  }

  toggleSeleccion(index: number): void {
    if (this.juegoIniciado) {
      this.sonidoSeleccion();
      this.cartasSeleccionadas[index] = !this.cartasSeleccionadas[index];
    }
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

  private traducirMano(manoBackend: string): string {
    if (!manoBackend) return 'CARTA ALTA';
    const upper = manoBackend.toUpperCase();
    if (upper === 'JOTAS O MEJOR' || upper === 'JACKS OR BETTER') {
      return 'Pareja (Jotas o Mejor)';
    }
    return upper;
  }
  
  volverAlLobby(): void {
    this.router.navigate(['/']);
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