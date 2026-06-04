import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subscription } from 'rxjs';
import { Router, ActivatedRoute } from '@angular/router';

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
  ultimoMensaje: string;
  ordenJugadores?: string[];
  indiceDealer?: number;
  ciegaGrandeValor?: number;
  emailSB: string;
  emailBB: string;
  turnoId: string;
  creadorEmail: string;
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
  roomId: string = '';
  buyIn: number = 1000;
  cantidadRaise: number = 0;

  procesando: boolean = false;
  mostrarConfirmacionSalir: boolean = false;
  mostrarTutorial: boolean = false;
  mostrarRanking: boolean = false;

  historialManos: { id: number, texto: string }[] = [];
  ultimoMensajeRegistrado: string = '';
  manoCounter: number = 0;

  private authSub: Subscription | null = null;

  constructor(
    private signalR: SignalrService,
    private authService: AuthService,
    private router: Router,
    private route: ActivatedRoute
  ) {}

  ngOnInit() {
    this.authSub = this.authService.usuario$.subscribe((u: any) => {
      if (u) {
        this.miEmail = u.email || u['http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress'] || u.name || '';
      }
    });

    try {
      const token = localStorage.getItem('token');
      if (token) {
        const payload = JSON.parse(atob(token.split('.')[1]));
        this.miEmail = payload.email || payload['http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress'] || this.miEmail;
      }
    } catch(e) {}

    this.route.queryParams.subscribe(params => {
      const randomId = Math.random().toString(36).substring(2, 10);
      this.roomId = params['mesa'] || `SALA_${randomId}`;
      this.conectarSignalR();
    });
  }

  async conectarSignalR() {
    const conectado = await this.signalR.startConnection('/pokerHub');
    if (conectado) {
      this.signalR.on('MesaActualizada', (mesaActualizada: MesaPoker) => {
        this.mesa = mesaActualizada;

        if (!this.miEmail && this.mesa.jugadores) {
           const listaJugadores = Object.values(this.mesa.jugadores);
           if (listaJugadores.length === 1) {
             this.miEmail = listaJugadores[0].email;
           }
        }

        this.calcularMinimoRaise();
        this.procesando = false;

        if (this.mesa.ultimoMensaje && this.mesa.ultimoMensaje !== this.ultimoMensajeRegistrado) {
          this.manoCounter++;
          this.historialManos.unshift({ id: this.manoCounter, texto: this.mesa.ultimoMensaje });
          this.ultimoMensajeRegistrado = this.mesa.ultimoMensaje;
        }
        if (!this.mesa.ultimoMensaje) {
          this.ultimoMensajeRegistrado = '';
        }
      });
      this.signalR.invoke('UnirseMesa', this.roomId);
    }
  }

  ngOnDestroy() {
    this.authSub?.unsubscribe();
    this.signalR.off('MesaActualizada');
  }

  recargarMesa() {
    if (this.roomId) {
      this.signalR.invoke('UnirseMesa', this.roomId);
    }
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

  obtenerMejorJugada(manoJugador: string[], comunitarias: string[]): { texto: string, cartas: string[] } | null {
    if (!manoJugador || manoJugador.length === 0) return null;
    const todas = [...manoJugador, ...(comunitarias || [])].filter(c => c);
    if (todas.length < 2) return null;

    const getVal = (c: string) => {
      let v = c.slice(0, -1);
      if (v === 'J') return 11;
      if (v === 'Q') return 12;
      if (v === 'K') return 13;
      if (v === 'A') return 14;
      return parseInt(v) || 0;
    };
    const numStr = (v: number) => {
      if (v === 14) return 'A';
      if (v === 13) return 'K';
      if (v === 12) return 'Q';
      if (v === 11) return 'J';
      return v.toString();
    };

    todas.sort((a, b) => getVal(b) - getVal(a));

    const counts: { [key: number]: string[] } = {};
    todas.forEach(c => {
      const v = getVal(c);
      if (!counts[v]) counts[v] = [];
      counts[v].push(c);
    });

    const grupos = Object.keys(counts).map(k => ({ val: parseInt(k), cartas: counts[parseInt(k)], freq: counts[parseInt(k)].length }))
      .sort((a, b) => b.freq - a.freq || b.val - a.val);

    const palosCounts: { [key: string]: string[] } = {};
    todas.forEach(c => {
      const p = c.slice(-1);
      if (!palosCounts[p]) palosCounts[p] = [];
      palosCounts[p].push(c);
    });

    let colorCartas: string[] = [];
    for (const p in palosCounts) {
      if (palosCounts[p].length >= 5) {
        colorCartas = palosCounts[p].slice(0, 5);
        break;
      }
    }

    const unicos = [...new Set(todas.map(c => getVal(c)))];
    let escaleraCartas: string[] = [];
    for (let i = 0; i <= unicos.length - 5; i++) {
      if (unicos[i] - 4 === unicos[i + 4]) {
        for (let j = 0; j < 5; j++) {
          escaleraCartas.push(todas.find(c => getVal(c) === unicos[i + j])!);
        }
        break;
      }
    }
    if (escaleraCartas.length === 0 && unicos.includes(14) && unicos.includes(5) && unicos.includes(4) && unicos.includes(3) && unicos.includes(2)) {
      escaleraCartas.push(todas.find(c => getVal(c) === 5)!);
      escaleraCartas.push(todas.find(c => getVal(c) === 4)!);
      escaleraCartas.push(todas.find(c => getVal(c) === 3)!);
      escaleraCartas.push(todas.find(c => getVal(c) === 2)!);
      escaleraCartas.push(todas.find(c => getVal(c) === 14)!);
    }

    let escaleraColorCartas: string[] = [];
    if (colorCartas.length >= 5) {
      const colorVals = [...new Set(colorCartas.map(c => getVal(c)))];
      for (let i = 0; i <= colorVals.length - 5; i++) {
        if (colorVals[i] - 4 === colorVals[i + 4]) {
          for (let j = 0; j < 5; j++) {
            escaleraColorCartas.push(colorCartas.find(c => getVal(c) === colorVals[i + j])!);
          }
          break;
        }
      }
      if (escaleraColorCartas.length === 0 && colorVals.includes(14) && colorVals.includes(5) && colorVals.includes(4) && colorVals.includes(3) && colorVals.includes(2)) {
        escaleraColorCartas.push(colorCartas.find(c => getVal(c) === 5)!);
        escaleraColorCartas.push(colorCartas.find(c => getVal(c) === 4)!);
        escaleraColorCartas.push(colorCartas.find(c => getVal(c) === 3)!);
        escaleraColorCartas.push(colorCartas.find(c => getVal(c) === 2)!);
        escaleraColorCartas.push(colorCartas.find(c => getVal(c) === 14)!);
      }
    }

    if (escaleraColorCartas.length === 5) return { texto: `ESCALERA DE COLOR AL ${numStr(getVal(escaleraColorCartas[0]))}`, cartas: escaleraColorCartas };
    if (grupos[0].freq === 4) return { texto: `PÓKER DE ${numStr(grupos[0].val)}`, cartas: grupos[0].cartas };
    if (grupos[0].freq === 3 && grupos.length > 1 && grupos[1].freq >= 2) return { texto: `FULL HOUSE DE ${numStr(grupos[0].val)} Y ${numStr(grupos[1].val)}`, cartas: [...grupos[0].cartas, ...grupos[1].cartas.slice(0, 2)] };
    if (colorCartas.length === 5) return { texto: `COLOR AL ${numStr(getVal(colorCartas[0]))}`, cartas: colorCartas };
    if (escaleraCartas.length === 5) return { texto: `ESCALERA AL ${numStr(getVal(escaleraCartas[0]))}`, cartas: escaleraCartas };
    if (grupos[0].freq === 3) return { texto: `TRÍO DE ${numStr(grupos[0].val)}`, cartas: grupos[0].cartas };
    if (grupos[0].freq === 2 && grupos.length > 1 && grupos[1].freq >= 2) return { texto: `DOBLE PAREJA DE ${numStr(grupos[0].val)} Y ${numStr(grupos[1].val)}`, cartas: [...grupos[0].cartas, ...grupos[1].cartas] };
    if (grupos[0].freq === 2) return { texto: `PAREJA DE ${numStr(grupos[0].val)}`, cartas: grupos[0].cartas };

    return { texto: `CARTA ALTA ${numStr(grupos[0].val)}`, cartas: [grupos[0].cartas[0]] };
  }

  abrirTutorial() { this.mostrarTutorial = true; }
  cerrarTutorial() { this.mostrarTutorial = false; }
  toggleRanking() { this.mostrarRanking = !this.mostrarRanking; }
  volverAlLobby() { this.router.navigate(['/juegos']); }
  confirmarSalir() { this.mostrarConfirmacionSalir = false; this.volverAlLobby(); }

  sentarse() {
    if (this.buyIn <= 0) return;
    this.buyIn = Math.floor(Number(this.buyIn));
    this.procesando = true;
    this.signalR.invoke('Sentarse', this.roomId, this.buyIn).catch(err => console.error(err));
    setTimeout(() => {
      this.procesando = false;
      this.recargarMesa();
    }, 1000);
  }

  iniciarMano() {
    this.procesando = true;
    this.signalR.invoke('IniciarMano', this.roomId).catch(err => console.error(err));
    setTimeout(() => { this.procesando = false; }, 2000);
  }

  enviarAccion(accion: string) {
    if (this.procesando) return;
    this.procesando = true;
    let cantidad = accion === 'raise' ? Math.floor(Number(this.cantidadRaise)) : 0;
    this.signalR.invoke('AccionJugador', this.roomId, accion, cantidad).catch(err => console.error(err));
    setTimeout(() => { this.procesando = false; }, 2000);
  }

  hacerAllIn() {
    if (this.procesando || !this.miJugador) return;
    this.procesando = true;
    const cantidadAllIn = this.miJugador.saldo + this.miJugador.apuestaActual;
    this.signalR.invoke('AccionJugador', this.roomId, 'raise', cantidadAllIn).catch(err => console.error(err));
    setTimeout(() => { this.procesando = false; }, 2000);
  }

  aumentarRaise() { this.cantidadRaise = Number(this.cantidadRaise) + 10; }
  disminuirRaise() {
    let nuevoValor = Number(this.cantidadRaise) - 10;
    let min = this.mesa?.apuestaActual || 0;
    this.cantidadRaise = nuevoValor < min ? min : nuevoValor;
  }

  get soyJugador(): boolean { 
    return !!this.mesa?.jugadores && this.mesa.jugadores[this.miEmail] !== undefined; 
  }
  
  get esMiTurno(): boolean { 
    return this.mesa?.turnoActualEmail === this.miEmail; 
  }
  
  get miJugador(): JugadorPoker | null { 
    return this.mesa?.jugadores ? this.mesa.jugadores[this.miEmail] : null; 
  }
  
  get rivales(): JugadorPoker[] {
    if (!this.mesa?.jugadores) return [];
    return Object.values(this.mesa.jugadores).filter(j => (j.email || (j as any).Email) !== this.miEmail);
  }

  get jugadoresLista(): JugadorPoker[] {
    if (!this.mesa?.jugadores) return [];
    return Object.values(this.mesa.jugadores);
  }

  get nombreFaseActual(): string {
    if (!this.mesa) return 'ESPERANDO';
    switch (this.mesa.fase) {
      case 0: return 'PREFLOP';
      case 1: return 'THE FLOP';
      case 2: return 'THE TURN';
      case 3: return 'THE RIVER';
      case 4: return 'SHOWDOWN';
      default: return 'PREPARANDO...';
    }
  }

  get dealerEmail(): string {
    if (!this.mesa || !this.mesa.ordenJugadores || this.mesa.indiceDealer === undefined || this.mesa.indiceDealer === -1) return '';
    return this.mesa.ordenJugadores[this.mesa.indiceDealer];
  }

  get boteTotalVisual(): number {
    if (!this.mesa) return 0;
    const sumaApuestas = Object.values(this.mesa.jugadores).reduce((acc, j) => acc + j.apuestaActual, 0);
    return this.mesa.bote + sumaApuestas;
  }

  get esCreador(): boolean {
    return this.mesa?.creadorEmail === this.miEmail;
  }

  get numeroJugadoresActivos(): number {
    if (!this.mesa || !this.mesa.jugadores) return 0;
    return Object.values(this.mesa.jugadores).filter(j => j.saldo > 0).length;
  }

  calcularMinimoRaise() {
    if (this.mesa) {
      this.cantidadRaise = this.mesa.apuestaActual > 0 ? this.mesa.apuestaActual * 2 : 50;
    }
  }

  trackByIndex(index: number): number { return index; }
}