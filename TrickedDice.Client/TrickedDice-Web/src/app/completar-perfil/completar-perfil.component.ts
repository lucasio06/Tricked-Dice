import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../auth.service';
import { ToastService } from '../services/toast.service';
import { RUTAS } from '../utils/rutas.const';

@Component({
  selector: 'app-completar-perfil',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './completar-perfil.component.html',
  styleUrls: ['../login/login.component.css']
})
export class CompletarPerfilComponent {
  dni: string = '';
  fechaNacimiento: string = '';
  isLoading: boolean = false;
  errorMessage: string | null = null;

  constructor(
    private authService: AuthService,
    private toast: ToastService,
    private router: Router
  ) {}

  onSubmit() {
    if (!this.dni || !this.fechaNacimiento) {
      this.errorMessage = 'Todos los campos son obligatorios.';
      return;
    }

    this.isLoading = true;
    this.errorMessage = null;

    this.authService.completarPerfil({ dni: this.dni, fechaNacimiento: this.fechaNacimiento }).subscribe({
      next: () => {
        this.isLoading = false;
        this.toast.success('Perfil legal completado. ¡Ya puedes jugar!');
        this.router.navigate([RUTAS.home]);
      },
      error: (err) => {
        this.isLoading = false;
        if (err.error && typeof err.error === 'string') {
            this.errorMessage = err.error;
        } else if (err.error && err.error.mensaje) {
            this.errorMessage = err.error.mensaje;
        } else {
            this.errorMessage = 'Error al verificar los datos.';
        }
      }
    });
  }
}