import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subscription } from 'rxjs';
import { Router } from '@angular/router';

import { SignalrService } from '../services/signalr.service';
import { AuthService } from '../auth.service';
import { NavbarComponent } from '../shared/navbar/navbar.component';

export interface JugadorPoker {
  email: string;
  nombreUsuario: string;
  saldo: number;
  mano: string[];
  apuestaActual: number;
  folded: boolean;
  allIn: boolean;
  haActuado: boolean;
}

export interface MesaPoker {
  roomId: string;
  cartasComunitarias: string[];
  jugadores: { [key: string]: JugadorPoker };
  bote: number;
  apuestaActual: number;
  fase: number;
  turnoActualEmail: string;
}

@Component({
  selector: 'app-poker',
  standalone: true,
  imports: [CommonModule, FormsModule, NavbarComponent],
  templateUrl: './poker.component.html',
  styleUrls: ['./poker.component.scss']
})
export class PokerComponent implements OnInit, OnDestroy {
  mesa: MesaPoker | null = null;
  miEmail: string = '';
  roomId: string = 'sala-poker-1';
  buyIn: number = 1000;
  cantidadRaise: number = 0;

  procesando: boolean = false;
  mostrarConfirmacionSalir: boolean = false;

  private authSub: Subscription | null = null;

  constructor(
    private signalR: SignalrService,
    private authService: AuthService,
    private router: Router
  ) {}

  ngOnInit() {
    this.authSub = this.authService.usuario$.subscribe((u: any) => {
      if (u) this.miEmail = u.email;
    });
    this.conectarSignalR();
  }

  async conectarSignalR() {
    const conectado = await this.signalR.startConnection('/pokerHub');
    if (conectado) {
      this.signalR.on('MesaActualizada', (mesaActualizada: MesaPoker) => {
        this.mesa = mesaActualizada;
        this.calcularMinimoRaise();
        this.procesando = false;
      });
      this.signalR.invoke('UnirseMesa', this.roomId);
    }
  }

  ngOnDestroy() {
    this.authSub?.unsubscribe();
    this.signalR.off('MesaActualizada');
  }

  obtenerDetallesCarta(carta: string) {
    if (!carta) return null;
    const palo = carta.slice(-1);
    const valor = carta.slice(0, -1);

    let color = 'black';
    let simbolo = '';

    switch(palo) {
      case 'C': simbolo = '♥'; color = 'red'; break;
      case 'D': simbolo = '♦'; color = 'red'; break;
      case 'P': simbolo = '♠'; color = 'black'; break;
      case 'T': simbolo = '♣'; color = 'black'; break;
    }

    return { valor, palo: simbolo, color };
  }

  volverAlLobby() {
    this.router.navigate(['/juegos']);
  }

  confirmarSalir() {
    this.mostrarConfirmacionSalir = false;
    this.volverAlLobby();
  }

  sentarse() {
    this.procesando = true;
    this.signalR.invoke('Sentarse', this.roomId, this.buyIn);
  }

  iniciarMano() {
    this.procesando = true;
    this.signalR.invoke('IniciarMano', this.roomId);
  }

  enviarAccion(accion: string) {
    if (this.procesando) return;
    this.procesando = true;
    let cantidad = accion === 'raise' ? this.cantidadRaise : 0;
    this.signalR.invoke('AccionJugador', this.roomId, accion, cantidad);
  }

  aumentarRaise() {
    this.cantidadRaise = Number(this.cantidadRaise) + 10;
  }

  disminuirRaise() {
    let nuevoValor = Number(this.cantidadRaise) - 10;
    let min = this.mesa?.apuestaActual || 0;
    this.cantidadRaise = nuevoValor < min ? min : nuevoValor;
  }

  get soyJugador(): boolean {
    return this.mesa?.jugadores[this.miEmail] !== undefined;
  }

  get esMiTurno(): boolean {
    return this.mesa?.turnoActualEmail === this.miEmail;
  }

  get miJugador(): JugadorPoker | null {
    return this.mesa ? this.mesa.jugadores[this.miEmail] : null;
  }

  get jugadoresLista(): JugadorPoker[] {
    return this.mesa ? Object.values(this.mesa.jugadores) : [];
  }

  calcularMinimoRaise() {
    if (this.mesa) {
      this.cantidadRaise = this.mesa.apuestaActual > 0 ? this.mesa.apuestaActual * 2 : 50;
    }
  }

  trackByIndex(index: number): number {
    return index;
  }
}