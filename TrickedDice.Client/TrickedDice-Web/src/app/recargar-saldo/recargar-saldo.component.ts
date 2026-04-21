import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService, UsuarioPerfil } from '../auth.service';
import { ToastService } from '../services/toast.service';

@Component({
  selector: 'app-recargar-saldo',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './recargar-saldo.component.html',
  styleUrls: ['./recargar-saldo.component.css']
})
export class RecargarSaldoComponent implements OnInit {
  cantidades = [10, 20, 50, 100, 200, 500];
  cantidadSeleccionada: number = 50;
  saldoActual: number = 0;
  recargando = false;

  constructor(
    private router: Router,
    private authService: AuthService,
    private toast: ToastService
  ) {}

  ngOnInit() {
    this.authService.usuario$.subscribe(usuario => {
      if (usuario) {
        this.saldoActual = usuario.saldo;
      }
    });
  }

  recargar() {
    const cantidad = parseFloat(this.cantidadSeleccionada.toString());
    if (isNaN(cantidad) || cantidad <= 0) {
      this.toast.warning('Selecciona una cantidad válida');
      return;
    }

    if (this.recargando) return;
    this.recargando = true;

    this.authService.recargarSaldo(cantidad).subscribe({
      next: (res) => {
        this.toast.success(`¡Has recargado ${cantidad.toFixed(2)} €! Nuevo saldo: ${res.saldo.toFixed(2)} €`);
        this.recargando = false;
        this.router.navigate(['/']);
      },
      error: (err) => {
        console.error(err);
        this.toast.error('Error al recargar saldo. Inténtalo de nuevo.');
        this.recargando = false;
      }
    });
  }

  volver() {
    this.router.navigate(['/']);
  }
}