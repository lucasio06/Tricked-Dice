import { Component, OnInit, OnDestroy, NgZone } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { SignalrService } from '../services/signalr.service';
import { ToastService } from '../services/toast.service';
import { NavbarComponent } from '../shared/navbar/navbar.component';
import { RUTAS } from '../utils/rutas.const';
import { ApiService } from '../services/api.service';

@Component({
  selector: 'app-blackjack',
  standalone: true,
  imports: [CommonModule, FormsModule, NavbarComponent],
  templateUrl: './blackjack.component.html',
  styleUrls: ['./blackjack.component.scss']
})
export class BlackjackComponent implements OnInit, OnDestroy {
  tableId: string = '';
  mesa: any = null;
  miPartidaId: string | null = null;
  apuestaActual: number = 10;
  saldoActual: number = 0;
  nombreUsuarioActual: string = '';

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private signalrService: SignalrService,
    private toast: ToastService,
    private apiService: ApiService,
    private zone: NgZone
  ) {}

  async ngOnInit() {
    this.obtenerNombreUsuario();
    this.apiService.getSaldo().subscribe(res => { this.saldoActual = res.saldo; });

    this.route.queryParams.subscribe(async params => {
      this.tableId = params['mesa'];
      if (!this.tableId) {
        this.toast.error('Mesa no especificada');
        this.router.navigate([RUTAS.lobby]);
        return;
      }
      
      await this.signalrService.startConnection('/hubs/blackjack');
      await this.signalrService.invoke('JoinTable', this.tableId);

      this.signalrService.on('MesaActualizada', (mesa: any) => {
        this.zone.run(() => { this.mesa = mesa; });
      });

      this.signalrService.on('MesaFinalizada', (mesa: any) => {
        this.zone.run(() => {
          this.mesa = mesa;
          this.toast.info('La ronda ha terminado. Comprobando resultados...');
          setTimeout(() => {
            this.miPartidaId = null;
            this.mesa = null;
            this.apiService.getSaldo().subscribe(res => { this.saldoActual = res.saldo; });
          }, 5000);
        });
      });

      this.signalrService.on('PartidaIniciada', (data: any) => {
        this.zone.run(() => {
          this.miPartidaId = data.idPartida;
          this.saldoActual = data.saldo;
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
  }

  obtenerNombreUsuario() {
    const usuarioStr = localStorage.getItem('usuario');
    if (usuarioStr) {
      const userObj = JSON.parse(usuarioStr);
      this.nombreUsuarioActual = userObj.nombreUsuario || userObj.nombre || '';
    }
  }

  getJugadores(): any[] {
    return this.mesa && this.mesa.manosJugadores ? (Object.entries(this.mesa.manosJugadores) as any[]) : [];
  }

  getValorMano(mano: string[]): number {
    let total = 0;
    let ases = 0;
    for (const carta of mano) {
        let valor = carta.length === 3 ? carta.substring(0, 2) : carta.charAt(0);
        if (!isNaN(Number(valor))) { total += Number(valor); }
        else if (valor === 'A') { ases++; total += 11; }
        else { total += 10; }
    }
    while (total > 21 && ases > 0) { total -= 10; ases--; }
    return total;
  }

  async apostarYJugar() {
    if (this.apuestaActual <= 0 || this.apuestaActual > this.saldoActual) {
      this.toast.error('Apuesta no válida o saldo insuficiente');
      return;
    }
    await this.signalrService.invoke('Repartir', this.tableId, this.apuestaActual);
  }

  async pedirCarta() {
    if (!this.miPartidaId) return;
    await this.signalrService.invoke('PedirCarta', this.miPartidaId, this.tableId);
  }

  async plantarse() {
    if (!this.miPartidaId) return;
    await this.signalrService.invoke('Plantarse', this.miPartidaId, this.tableId);
  }

  obtenerRutaCarta(carta: string): string {
    return `assets/cartas/${carta}.png`;
  }
}