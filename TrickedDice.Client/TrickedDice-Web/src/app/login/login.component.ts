import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.css']
})
export class LoginComponent {
  email: string = '';
  password: string = '';
  isLoading: boolean = false;
  errorMessage: string | null = null;

  constructor(
    private authService: AuthService,
    public router: Router
  ) {}

  onSubmit() {
    if (!this.email || !this.password) {
      this.errorMessage = 'Por favor, completa todos los campos.';
      return;
    }

    this.isLoading = true;
    this.errorMessage = null;

    console.log('[LoginComponent] Intentando login con:', this.email);
    this.authService.login(this.email, this.password).subscribe({
      next: () => {
        console.log('[LoginComponent] Login exitoso, redirigiendo...');
        this.isLoading = false;
        this.router.navigate(['/']);
      },
      error: (err) => {
        this.isLoading = false;
        console.error('[LoginComponent] Error en login:', err);
        if (err.status === 401) {
          this.errorMessage = 'Email o contraseña incorrectos.';
        } else if (err.status === 0) {
          this.errorMessage = 'Error de conexión. Verifica que el backend esté corriendo.';
        } else {
          this.errorMessage = err.error?.mensaje || 'Error de conexión. Inténtalo de nuevo.';
        }
      }
    });
  }
}