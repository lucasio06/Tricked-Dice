import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../auth.service';

@Component({
  selector: 'app-recargar-saldo',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './recargar-saldo.component.html',
  styleUrls: ['./recargar-saldo.component.css']
})
export class RecargarSaldoComponent {
  cantidades = [10, 20, 50, 100, 200, 500];
  cantidadSeleccionada: number = 50;
  saldoActual: number = 0;
  recargando = false;

  constructor(
    private router: Router,
    private authService: AuthService
  ) {
    this.cargarSaldoActual();
  }

  cargarSaldoActual() {
    const usuario = this.authService.getUsuario();
    if (usuario) {
      this.saldoActual = usuario.saldo;
    }
  }

  recargar() {
    const cantidad = parseFloat(this.cantidadSeleccionada.toString());
  
  if (isNaN(cantidad) || cantidad <= 0) {
    alert('Selecciona una cantidad válida');
    return;
  }

    if (this.recargando) return;
    this.recargando = true;

    this.authService.recargarSaldo(cantidad).subscribe({
      next: (res) => {
        const usuario = this.authService.getUsuario();
        if (usuario) {
          usuario.saldo = res.saldo;
          localStorage.setItem('usuario', JSON.stringify(usuario));
        }
        
        alert(`¡Has recargado ${cantidad} €! Nuevo saldo: ${res.saldo} €`);
        this.recargando = false;
        this.router.navigate(['/']);
      },
      error: (err) => {
        console.error(err);
        alert('Error al recargar saldo. Inténtalo de nuevo.');
        this.recargando = false;
      }
    });
  }

  volver() {
    this.router.navigate(['/']);
  }
}