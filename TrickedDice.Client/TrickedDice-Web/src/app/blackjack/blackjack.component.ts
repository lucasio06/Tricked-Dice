import { Component, OnInit, OnDestroy, NgZone, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { SignalrService } from '../services/signalr.service';
import { ToastService } from '../services/toast.service';
import { ApiService } from '../services/api.service';
import { AuthService } from '../auth.service';
import { NavbarComponent } from '../shared/navbar/navbar.component';
import { RUTAS } from '../utils/rutas.const';

interface HistorialResultado {
  fecha: Date;
  resultado: string;
  premio: number;
  puntuacionJugador: number;
  puntuacionCrupier: number;
  montoApostado: number;
}

@Component({
  selector: 'app-blackjack',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, NavbarComponent],
  templateUrl: './blackjack.component.html',
  styleUrls: ['./blackjack.component.scss']
})
export class BlackjackComponent implements OnInit, OnDestroy {
  tableId: string = '';
  mesa: any = null;
  miPartidaId: string | null = null;
  montoApuesta: number = 10;
  cantidadesFijas: number[] = [1, 5, 10, 25, 50, 100, 500];
  saldoActual: number = 0;
  nombreUsuarioActual: string = '';
  currentUserEmail: string = '';

  mostrarModalResultado: boolean = false;
  resultadoModal: { texto: string; premio: number; puntosJugador: number; puntosCrupier: number; monto: number } = 
    { texto: '', premio: 0, puntosJugador: 0, puntosCrupier: 0, monto: 0 };
  historialResultados: HistorialResultado[] = [];
  private tiempoLimpiarResultados: any = null;

  private signalrService = inject(SignalrService);
  private toast = inject(ToastService);
  private apiService = inject(ApiService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private zone = inject(NgZone);
  private authService = inject(AuthService);

  async ngOnInit() {
    this.authService.usuario$.subscribe(usuario => {
      if (usuario) {
        this.saldoActual = usuario.saldo;
        this.nombreUsuarioActual = usuario.nombre;
        this.currentUserEmail = usuario.email?.toLowerCase().trim() || '';
      }
    });

    this.route.queryParams.subscribe(async params => {
      this.tableId = params['mesa'];
      if (!this.tableId) {
        this.tableId = 'SOLO_MODE_DEFAULT';
        this.toast.info('Entrando en modo solitario...');
      }

      await this.signalrService.startConnection('/hubs/blackjack');
      await this.signalrService.invoke('JoinTable', this.tableId);

      this.signalrService.on('MesaActualizada', (mesa: any) => {
        this.zone.run(() => { this.mesa = mesa; });
      });

      this.signalrService.on('MesaFinalizada', (data: any) => {
        this.zone.run(() => {
          const mesaData = data.mesa || data;
          const resultados = data.resultados;
          this.mesa = mesaData;

          let miResultado = null;
          if (resultados && typeof resultados === 'object') {
            const emailKey = Object.keys(resultados).find(key => 
              key.toLowerCase().trim() === this.currentUserEmail ||
              key.toLowerCase().trim() === this.nombreUsuarioActual.toLowerCase().trim()
            );
            if (emailKey) {
              miResultado = resultados[emailKey];
            }
          }

          if (miResultado) {
            const gano = miResultado.gano === true;
            const premio = miResultado.premio || 0;
            const puntosJugador = miResultado.puntosJugador || 0;
            const puntosCrupier = miResultado.puntosCrupier || 0;
            const montoApostado = miResultado.montoApostado || this.montoApuesta;

            let tipo: 'win' | 'lose' | 'push';
            if (gano) {
              tipo = 'win';
            } else if (premio === montoApostado) {
              tipo = 'push';
            } else {
              tipo = 'lose';
            }

            this.mostrarResultado(tipo, premio, puntosJugador, puntosCrupier, montoApostado);
            this.saldoActual = miResultado.saldoActualizado;
            this.authService.actualizarSaldo(this.saldoActual);
            this.agregarAlHistorial(tipo, premio, puntosJugador, puntosCrupier, montoApostado);
          } else {
            this.toast.warning('No se pudo obtener el resultado de tu partida. Revisa tu saldo.');
          }

          setTimeout(() => {
            this.miPartidaId = null;
            this.mesa = null;
          }, 5000);
        });
      });

      this.signalrService.on('PartidaIniciada', (data: any) => {
        this.zone.run(() => {
          this.miPartidaId = data.idPartida;
          this.apiService.getSaldo().subscribe(res => {
            this.saldoActual = res.saldo;
            this.authService.actualizarSaldo(res.saldo);
          });
          this.toast.success('¡Has entrado a la ronda!');
        });
      });

      this.signalrService.on('Error', (msg: string) => {
        this.zone.run(() => { this.toast.error(msg); });
      });
    });
  }

  ngOnDestroy() {
    this.signalrService.stopConnection();
    if (this.tiempoLimpiarResultados) clearTimeout(this.tiempoLimpiarResultados);
  }

  private agregarAlHistorial(resultado: string, premio: number, puntosJugador: number, puntosCrupier: number, monto: number): void {
    this.historialResultados.unshift({
      fecha: new Date(),
      resultado: resultado,
      premio: premio,
      puntuacionJugador: puntosJugador,
      puntuacionCrupier: puntosCrupier,
      montoApostado: monto
    });
    if (this.historialResultados.length > 20) this.historialResultados.pop();

    if (this.tiempoLimpiarResultados) clearTimeout(this.tiempoLimpiarResultados);
    this.tiempoLimpiarResultados = setTimeout(() => {
      this.historialResultados = [];
    }, 30000);
  }

  private mostrarResultado(tipo: 'win' | 'lose' | 'push', premio: number, puntosJugador: number, puntosCrupier: number, monto: number): void {
    let texto = '';
    if (tipo === 'win') texto = `¡GANASTE! +${premio}€`;
    else if (tipo === 'push') texto = `EMPATE (Recuperas ${monto}€)`;
    else texto = `PERDISTE ${monto}€`;

    this.resultadoModal = { 
      texto, 
      premio: tipo === 'win' ? premio : (tipo === 'push' ? 0 : -monto), 
      puntosJugador, 
      puntosCrupier, 
      monto 
    };
    this.mostrarModalResultado = true;

    if (tipo === 'win') this.toast.win(`¡Ganaste ${premio}€!`);
    else if (tipo === 'push') this.toast.info(`Empate, recuperas ${monto}€`);
    else this.toast.lose(`Perdiste ${monto}€`);

    setTimeout(() => this.cerrarModalResultado(), 4000);
  }

  cerrarModalResultado(): void {
    this.mostrarModalResultado = false;
    this.resultadoModal = { texto: '', premio: 0, puntosJugador: 0, puntosCrupier: 0, monto: 0 };
  }

  getJugadores(): any[] {
    return this.mesa && this.mesa.manosJugadores ? (Object.entries(this.mesa.manosJugadores) as any[]) : [];
  }

  getValorMano(mano: string[]): number {
    if (!mano || !Array.isArray(mano)) return 0;
    let total = 0;
    let ases = 0;
    for (const carta of mano.filter(c => c)) {
      let valor = carta.length === 3 ? carta.substring(0, 2) : carta.charAt(0);
      if (!isNaN(Number(valor))) { total += Number(valor); }
      else if (valor === 'A') { ases++; total += 11; }
      else { total += 10; }
    }
    while (total > 21 && ases > 0) { total -= 10; ases--; }
    return total;
  }

  obtenerDetallesCarta(carta: string): { valor: string, palo: string, color: string } {
    if (!carta || carta === '?' || carta === 'reverso' || carta === 'hidden') {
      return { valor: '', palo: '', color: 'reverso' };
    }

    const valor = carta.length === 3 ? carta.substring(0, 2) : carta.charAt(0);
    const paloChar = carta.charAt(carta.length - 1).toUpperCase();

    let palo = '';
    let color = 'negra';

    switch (paloChar) {
      case 'H': palo = '♥'; color = 'roja'; break;
      case 'D': palo = '♦'; color = 'roja'; break;
      case 'S': palo = '♠'; color = 'negra'; break;
      case 'C': palo = '♣'; color = 'negra'; break;
      case 'P': palo = '♠'; color = 'negra'; break;
      case 'T': palo = '♣'; color = 'negra'; break;
      case '♥': palo = '♥'; color = 'roja'; break;
      case '♦': palo = '♦'; color = 'roja'; break;
      case '♠': palo = '♠'; color = 'negra'; break;
      case '♣': palo = '♣'; color = 'negra'; break;
      default: palo = paloChar; color = 'negra'; break;
    }

    return { valor, palo, color };
  }

  async apostarYJugar() {
    if (this.montoApuesta <= 0 || this.montoApuesta > this.saldoActual) {
      this.toast.error('Apuesta no válida o saldo insuficiente');
      return;
    }
    await this.signalrService.invoke('Repartir', this.tableId, this.montoApuesta);
    setTimeout(() => {
      this.apiService.getSaldo().subscribe(res => {
        this.saldoActual = res.saldo;
        this.authService.actualizarSaldo(res.saldo);
      });
    }, 500);
  }

  async pedirCarta() {
    if (!this.miPartidaId) return;
    await this.signalrService.invoke('PedirCarta', this.miPartidaId, this.tableId);
  }

  async plantarse() {
    if (!this.miPartidaId) return;
    await this.signalrService.invoke('Plantarse', this.miPartidaId, this.tableId);
  }

  volverAlLobby(): void {
    if (this.tableId && this.tableId !== 'SOLO_MODE_DEFAULT') {
      const mesas = JSON.parse(localStorage.getItem('mesasActivas') || '[]');
      const actualizadas = mesas.filter((m: any) => m.id !== this.tableId);
      localStorage.setItem('mesasActivas', JSON.stringify(actualizadas));
    }
    this.router.navigate([RUTAS.lobby]);
  }
}