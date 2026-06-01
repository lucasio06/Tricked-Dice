import { Component, OnInit, OnDestroy, NgZone, inject, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { SignalrService } from '../services/signalr.service';
import { ToastService } from '../services/toast.service';
import { ApiService } from '../services/api.service';
import { AuthService } from '../auth.service';
import { NavbarComponent } from '../shared/navbar/navbar.component';
import { RUTAS } from '../utils/rutas.const';

export interface PartidaBlackjack {
  email: string;
  nombreUsuario: string;
  monto: number;
  manoJugador: string[];
  terminada: boolean;
}

export interface MesaBlackjack {
  roomId: string;
  manoCrupier: string[];
  baraja: string[];
  manosJugadores: { [key: string]: PartidaBlackjack };
}

export interface ResultadoBlackjack {
  gano: boolean;
  premio: number;
  saldoActualizado: number;
  puntosJugador: number;
  puntosCrupier: number;
  montoApostado: number;
}

interface HistorialResultado {
  fecha: Date;
  resultado: 'win' | 'lose' | 'push';
  premio: number;
  puntuacionJugador: number;
  puntuacionCrupier: number;
  montoApostado: number;
}

export interface CartaDetalle {
  valor: string;
  palo: string;
  color: string;
  simbolo: string;
}

@Component({
  selector: 'app-blackjack',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, NavbarComponent],
  providers: [SignalrService],
  templateUrl: './blackjack.component.html',
  styleUrls: ['./blackjack.component.scss']
})
export class BlackjackComponent implements OnInit, OnDestroy {
  @Input() tableIdInput: string = '';

  tableId: string = '';
  mesa: MesaBlackjack | null = null;
  miPartidaId: string | null = null;
  montoApuesta: number = 10;
  cantidadesFijas: number[] = [1, 5, 10, 25, 50, 100, 500];
  saldoActual: number = 0;
  nombreUsuarioActual: string = '';
  currentUserEmail: string = '';

  mostrarModalResultado: boolean = false;
  mostrarConfirmacionSalir: boolean = false;
  esperandoSiguienteRonda: boolean = false;
  bloqueoApuesta: boolean = false;

  resultadoModal: { texto: string; premio: number; puntosJugador: number; puntosCrupier: number; monto: number; tipo: 'win' | 'lose' | 'push' } = 
    { texto: '', premio: 0, puntosJugador: 0, puntosCrupier: 0, monto: 0, tipo: 'push' };
  historialResultados: HistorialResultado[] = [];
  
  private tiempoLimpiarResultados: any = null;
  private timeoutReinicio: any = null;

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
      this.tableId = this.tableIdInput || params['mesa'] || '';
      if (!this.tableId) {
        const randomId = Math.random().toString(36).substring(2, 10);
        this.tableId = `SOLO_${randomId}`;
      }

      await this.signalrService.startConnection('/hubs/blackjack');
      await this.signalrService.invoke('JoinTable', this.tableId);

      this.signalrService.on('MesaActualizada', (mesa: MesaBlackjack) => {
        this.zone.run(() => { 
          this.mesa = mesa; 
          
          if (this.miPartidaId) {
            const misDatos = this.getJugadores().find(j => j.id === this.miPartidaId);
            if (misDatos && !misDatos.partida.terminada && this.esMiTurno()) {
              const valor = this.getValorMano(misDatos.partida.manoJugador);
              if (valor >= 21) {
                setTimeout(() => {
                  this.plantarse();
                }, 1000);
              }
            }
          }
        });
      });

      this.signalrService.on('MesaFinalizada', (data: { mesa: MesaBlackjack, resultados: { [email: string]: ResultadoBlackjack } }) => {
        this.zone.run(() => {
          this.mesa = data.mesa;
          this.bloqueoApuesta = false;

          let miResultado: ResultadoBlackjack | null = null;
          if (data.resultados) {
            const emailKey = Object.keys(data.resultados).find(key => 
              key.toLowerCase().trim() === this.currentUserEmail ||
              key.toLowerCase().trim() === this.nombreUsuarioActual.toLowerCase().trim()
            );
            if (emailKey) {
              miResultado = data.resultados[emailKey];
            }
          }

          if (miResultado) {
            const gano = miResultado.gano;
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
            this.authService.actualizarSaldoLocal(this.saldoActual);
            this.agregarAlHistorial(tipo, premio, puntosJugador, puntosCrupier, montoApostado);
          }

          if (this.timeoutReinicio) clearTimeout(this.timeoutReinicio);
          this.timeoutReinicio = setTimeout(() => {
            this.miPartidaId = null;
            this.mesa = null;
            this.esperandoSiguienteRonda = false;
          }, 3500);
        });
      });

      this.signalrService.on('PartidaIniciada', (data: { idPartida: string, saldo: number }) => {
        this.zone.run(() => {
          this.miPartidaId = data.idPartida;
          this.esperandoSiguienteRonda = false;
          this.bloqueoApuesta = false;
          this.saldoActual = data.saldo;
          this.authService.actualizarSaldoLocal(data.saldo);
        });
      });

      this.signalrService.on('Error', (msg: string) => {
        this.zone.run(() => { 
          this.toast.error(msg); 
          this.bloqueoApuesta = false;
        });
      });
    });
  }

  ngOnDestroy() {
    this.signalrService.stopConnection();
    if (this.tiempoLimpiarResultados) clearTimeout(this.tiempoLimpiarResultados);
    if (this.timeoutReinicio) clearTimeout(this.timeoutReinicio);
  }

  trackByIndex(index: number, obj: any): any {
    return index;
  }

  trackById(index: number, obj: { id: string, partida: PartidaBlackjack }): string {
    return obj.id;
  }

  private agregarAlHistorial(resultado: 'win' | 'lose' | 'push', premio: number, puntosJugador: number, puntosCrupier: number, monto: number): void {
    this.historialResultados.unshift({
      fecha: new Date(),
      resultado: resultado,
      premio: premio,
      puntuacionJugador: puntosJugador,
      puntuacionCrupier: puntosCrupier,
      montoApostado: monto
    });
    if (this.historialResultados.length > 15) this.historialResultados.pop();

    if (this.tiempoLimpiarResultados) clearTimeout(this.tiempoLimpiarResultados);
    this.tiempoLimpiarResultados = setTimeout(() => {
      this.historialResultados = [];
    }, 45000);
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
      monto,
      tipo
    };
    this.mostrarModalResultado = true;
    setTimeout(() => this.cerrarModalResultado(), 3200);
  }

  cerrarModalResultado(): void {
    this.mostrarModalResultado = false;
    this.resultadoModal = { texto: '', premio: 0, puntosJugador: 0, puntosCrupier: 0, monto: 0, tipo: 'push' };
  }

  noApostar(): void {
    this.esperandoSiguienteRonda = true;
  }

  getJugadores(): { id: string, partida: PartidaBlackjack }[] {
    if (!this.mesa || !this.mesa.manosJugadores) return [];
    return Object.entries(this.mesa.manosJugadores)
      .map(([id, partida]) => ({ id, partida }))
      .sort((a, b) => a.id.localeCompare(b.id));
  }

  get isSoloMode(): boolean {
    return this.tableId.startsWith('SOLO_');
  }

  getTurnoActualId(): string | null {
    if (!this.mesa || !this.mesa.manosJugadores) return null;
    const jugando = this.getJugadores().filter(j => j.partida.manoJugador && j.partida.manoJugador.length > 0);
    if (jugando.length === 0) return null;

    const jugadorActivo = jugando.find(j => !j.partida.terminada);
    return jugadorActivo ? jugadorActivo.id : null;
  }

  esMiTurno(): boolean {
    if (!this.miPartidaId) return false;
    return this.miPartidaId === this.getTurnoActualId();
  }

  getNombreTurnoActual(): string {
    const id = this.getTurnoActualId();
    if (!id) return '';
    const j = this.getJugadores().find(j => j.id === id);
    return j ? j.partida.nombreUsuario : '';
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

  obtenerDetallesCarta(carta: string): CartaDetalle {
    if (!carta || carta === '?' || carta === 'reverso' || carta === 'hidden') {
      return { valor: '', palo: '', color: 'reverso', simbolo: '' };
    }
    const valor = carta.length === 3 ? carta.substring(0, 2) : carta.charAt(0);
    const paloChar = carta.charAt(carta.length - 1).toUpperCase();
    let palo = '';
    let simbolo = '';
    let color = 'negra';

    switch (paloChar) {
      case 'H': case '♥': palo = 'corazones'; simbolo = '♥'; color = 'roja'; break;
      case 'D': case '♦': palo = 'diamantes'; simbolo = '♦'; color = 'roja'; break;
      case 'S': case '♠': palo = 'picas'; simbolo = '♠'; color = 'negra'; break;
      case 'C': case '♣': palo = 'treboles'; simbolo = '♣'; color = 'negra'; break;
      case 'P': palo = 'picas'; simbolo = '♠'; color = 'negra'; break;
      case 'T': palo = 'treboles'; simbolo = '♣'; color = 'negra'; break;
      default: palo = paloChar; simbolo = paloChar; color = 'negra'; break;
    }
    return { valor, palo, color, simbolo };
  }

  async apostarYJugar() {
    if (this.bloqueoApuesta) return;
    if (this.montoApuesta <= 0 || this.montoApuesta > this.saldoActual) {
      this.toast.error('Apuesta no válida o saldo insuficiente');
      return;
    }
    this.bloqueoApuesta = true;
    await this.signalrService.invoke('Repartir', this.tableId, this.montoApuesta);
    
    setTimeout(() => {
      this.bloqueoApuesta = false;
    }, 2000);
  }

  async pedirCarta() {
    if (!this.miPartidaId || !this.esMiTurno()) return;
    await this.signalrService.invoke('PedirCarta', this.miPartidaId, this.tableId);
  }

  async plantarse() {
    if (!this.miPartidaId || !this.esMiTurno()) return;
    await this.signalrService.invoke('Plantarse', this.miPartidaId, this.tableId);
  }

  confirmarSalir(): void {
    this.mostrarConfirmacionSalir = false;
    if (this.tableId && !this.tableId.startsWith('SOLO_')) {
      const mesas: any[] = JSON.parse(localStorage.getItem('mesasActivas') || '[]');
      const actualizadas = mesas.filter((m: any) => m.id !== this.tableId);
      localStorage.setItem('mesasActivas', JSON.stringify(actualizadas));
    }
    this.router.navigate([RUTAS.home]);
  }

  volverAlLobby(): void {
    if (this.tableId && !this.tableId.startsWith('SOLO_')) {
      const mesas: any[] = JSON.parse(localStorage.getItem('mesasActivas') || '[]');
      const actualizadas = mesas.filter((m: any) => m.id !== this.tableId);
      localStorage.setItem('mesasActivas', JSON.stringify(actualizadas));
    }
    this.router.navigate([RUTAS.home]);
  }
}