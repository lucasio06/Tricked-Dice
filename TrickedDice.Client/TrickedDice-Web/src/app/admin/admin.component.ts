import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AdminService } from '../services/admin.service';
import { UsuarioAdmin, TransaccionAdmin, Estadisticas } from '../models/api-responses';
import { ToastService } from '../services/toast.service';
import { NavbarComponent } from '../shared/navbar/navbar.component';
import { SignalrService } from '../services/signalr.service'; // Asegúrate de tener este import
import { ApiService } from '../services/api.service';

@Component({
  selector: 'app-admin',
  standalone: true,
  imports: [CommonModule, NavbarComponent],
  templateUrl: './admin.component.html',
  styleUrls: ['./admin.component.scss']
})
export class AdminComponent implements OnInit {
  pestanaActiva: string = 'estadisticas';
  usuarios: UsuarioAdmin[] = [];
  transacciones: TransaccionAdmin[] = [];
  estadisticas: Estadisticas | null = null;
  cargando: boolean = false;

  constructor(
    private adminService: AdminService,
    private toast: ToastService,
    private apiService: ApiService // Inyectado para forzar la desconexión
  ) {}

  ngOnInit(): void {
    this.cargarEstadisticas();
  }

  cambiarPestana(pestana: string): void {
    this.pestanaActiva = pestana;
    if (pestana === 'usuarios' && this.usuarios.length === 0) {
      this.cargarUsuarios();
    } else if (pestana === 'transacciones' && this.transacciones.length === 0) {
      this.cargarTransacciones();
    } else if (pestana === 'estadisticas' && !this.estadisticas) {
      this.cargarEstadisticas();
    }
  }

  cargarUsuarios(): void {
    this.cargando = true;
    this.adminService.getUsuarios().subscribe({
      next: (data) => {
        this.usuarios = data;
        this.cargando = false;
      },
      error: () => {
        this.cargando = false;
      }
    });
  }

  cargarTransacciones(idUsuario?: number): void {
    this.cargando = true;
    this.adminService.getTransacciones(idUsuario).subscribe({
      next: (data) => {
        this.transacciones = data;
        this.cargando = false;
      },
      error: () => {
        this.cargando = false;
      }
    });
  }

  cargarEstadisticas(): void {
    this.cargando = true;
    this.adminService.getEstadisticas().subscribe({
      next: (data) => {
        this.estadisticas = data;
        this.cargando = false;
      },
      error: () => {
        this.cargando = false;
      }
    });
  }

  banearUsuario(idUsuario: number): void {
    this.adminService.banearUsuario(idUsuario, true).subscribe({
      next: () => {
        this.toast.success('Usuario baneado y desconectado correctamente.');
        this.cargarUsuarios();
      },
      error: () => {
        this.toast.error('Error al banear usuario.');
      }
    });
  }

  desbanearUsuario(idUsuario: number): void {
    this.adminService.banearUsuario(idUsuario, false).subscribe({
      next: () => {
        this.toast.success('Usuario desbaneado correctamente.');
        this.cargarUsuarios();
      },
      error: () => {
        this.toast.error('Error al desbanear usuario.');
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
}