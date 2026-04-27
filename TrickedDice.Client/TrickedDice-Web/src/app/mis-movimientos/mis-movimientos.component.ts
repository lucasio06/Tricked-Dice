import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { TransaccionesService } from '../services/transacciones.service';
import { Transaccion } from '../models/api-responses';
import { AuthService } from '../auth.service';
import { UsuarioPerfil } from '../models/api-responses';
import { NavbarComponent } from '../shared/navbar/navbar.component';

@Component({
  selector: 'app-mis-movimientos',
  standalone: true,
  imports: [CommonModule, RouterLink, NavbarComponent],
  templateUrl: './mis-movimientos.component.html',
  styleUrls: ['./mis-movimientos.component.scss']
})
export class MisMovimientosComponent implements OnInit {
  transacciones: Transaccion[] = [];
  isLoading = true;
  error: string | null = null;
  usuarioActivo: UsuarioPerfil | null = null;

  constructor(
    private transaccionesService: TransaccionesService,
    private authService: AuthService
  ) {}

  ngOnInit(): void {
    this.authService.usuario$.subscribe(usuario => {
      this.usuarioActivo = usuario;
    });
    this.cargarTransacciones();
  }

  cargarTransacciones(): void {
    this.isLoading = true;
    this.transaccionesService.getMisTransacciones().subscribe({
      next: (data) => {
        this.transacciones = data;
        this.isLoading = false;
      },
      error: (err) => {
        console.error('Error al cargar transacciones', err);
        this.error = 'No se pudieron cargar los movimientos.';
        this.isLoading = false;
      }
    });
  }

  formatearFecha(fecha: string): string {
    const date = new Date(fecha);
    return date.toLocaleDateString('es-ES', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  getClaseCantidad(cantidad: number): string {
    if (cantidad > 0) return 'positivo';
    if (cantidad < 0) return 'negativo';
    return '';
  }
}