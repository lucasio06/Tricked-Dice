import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { AuthService } from '../auth.service';
import { ToastService } from '../services/toast.service';
import { NavbarComponent } from '../shared/navbar/navbar.component';

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

  constructor(
    private http: HttpClient,
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
    this.http.post<{ mano: string[], saldoActualizado: number }>(
      'http://localhost:5069/api/videopoker/repartir',
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

    const indices = this.cartasSeleccionadas
      .map((sel, i) => sel ? i : -1)
      .filter(i => i !== -1);

    this.cargando = true;
    this.http.post<{
      manoFinal: string[],
      premio: number,
      nombreMano: string,
      saldoActualizado: number
    }>('http://localhost:5069/api/videopoker/cambiar', {
      mano: this.mano,
      indicesACambiar: indices,
      montoApostado: this.montoApuesta
    }).subscribe({
      next: (res) => {
        this.mano = res.manoFinal;
        this.saldo = res.saldoActualizado;
        this.authService.actualizarSaldo(res.saldoActualizado);
        this.premioActual = res.premio;
        this.juegoIniciado = false;
        
        if (res.premio > 0) {
          this.mensaje = `¡${res.nombreMano}! Ganaste ${res.premio.toFixed(2)} €`;
          this.toast.win(`¡${res.nombreMano}! +${res.premio.toFixed(2)}€`);
        } else {
          this.mensaje = `Sin premio. ¡Mejor suerte la próxima!`;
          this.toast.lose(`Sin premio.`);
        }
        
        this.cargando = false;
      },
      error: (err) => {
        this.cargando = false;
        this.toast.error(err.error?.mensaje || 'Error al cambiar cartas');
      }
    });
  }

  toggleSeleccion(index: number): void {
    if (this.juegoIniciado) {
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
}