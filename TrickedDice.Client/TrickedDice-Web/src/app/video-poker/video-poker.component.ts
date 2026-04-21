import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-video-poker',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './video-poker.component.html',
  styleUrls: ['./video-poker.component.scss']
})
export class VideoPokerComponent {
  mano: string[] = [];
  cartasSeleccionadas: boolean[] = [false, false, false, false, false];
  montoApuesta: number = 10;
  saldo: number = 0;
  mensaje: string = '';

  repartir(): void {
    // TODO: Conectar con el backend
    this.mano = ['AC', 'KD', '7T', '3P', '9C'];
    this.cartasSeleccionadas = [false, false, false, false, false];
    this.mensaje = 'Selecciona cartas para cambiar';
  }

  cambiar(): void {
    // TODO: Conectar con el backend
    for (let i = 0; i < this.mano.length; i++) {
      if (this.cartasSeleccionadas[i]) {
        this.mano[i] = '??';
      }
    }
    this.mensaje = '¡Buena suerte!';
  }

  toggleSeleccion(index: number): void {
    this.cartasSeleccionadas[index] = !this.cartasSeleccionadas[index];
  }
}