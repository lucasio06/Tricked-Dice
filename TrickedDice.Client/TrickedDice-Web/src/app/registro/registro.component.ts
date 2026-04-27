import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../auth.service';
import { RUTAS } from '../utils/rutas.const';

@Component({
  selector: 'app-registro',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './registro.component.html',
  styleUrls: ['./registro.component.css']
})
export class RegistroComponent {
  usuarioData = {
    username: '',
    email: '',
    password: '',
    dni: '',
    nombre: '',
    primerApellido: '',
    segundoApellido: '',
    fechaNacimiento: ''
  };

  dniInvalido = false;
  isLoading: boolean = false;
  errorMessage: string | null = null;

  constructor(
    private authService: AuthService,
    public router: Router
  ) {}

  validarDNI(): boolean {
    const dni = this.usuarioData.dni ? this.usuarioData.dni.trim().toUpperCase() : '';
    
    if (dni.length !== 9) {
      this.dniInvalido = true;
      return false;
    }

    const letras = "TRWAGMYFPDXBNJZSQVHLCKE";
    const numerosPart = dni.substring(0, 8);
    const letraPart = dni.charAt(8);

    const soloNumeros = /^\d+$/.test(numerosPart);
    if (!soloNumeros) {
      this.dniInvalido = true;
      return false;
    }

    if (!/[A-Z]/i.test(letraPart)) {
      this.dniInvalido = true;
      return false;
    }

    const numero = parseInt(numerosPart, 10);
    const letraCorrecta = letras[numero % 23];
    this.dniInvalido = letraCorrecta !== letraPart;
    return !this.dniInvalido;
  }

  onSubmit() {
    this.errorMessage = null;

    if (!this.usuarioData.email || !this.usuarioData.password || !this.usuarioData.nombre || !this.usuarioData.primerApellido || !this.usuarioData.fechaNacimiento) {
      this.errorMessage = 'Por favor, completa todos los campos obligatorios.';
      return;
    }

    if (!this.validarDNI()) {
      this.errorMessage = 'El DNI introducido no es válido. Formato: 12345678Z';
      return;
    }

    this.isLoading = true;

    const body = {
      NombreUsuario: this.usuarioData.username,
      Email: this.usuarioData.email,
      Password: this.usuarioData.password,
      Dni: this.usuarioData.dni,
      Nombre: this.usuarioData.nombre,
      PrimerApellido: this.usuarioData.primerApellido,
      SegundoApellido: this.usuarioData.segundoApellido || null,
      FechaNacimiento: this.usuarioData.fechaNacimiento,
      Nickname: this.usuarioData.username
    };

    this.authService.registro(body).subscribe({
      next: () => {
        this.isLoading = false;
        alert('¡Registro completado! Ahora puedes iniciar sesión.');
        this.router.navigate([RUTAS.login]);
      },
      error: (err) => {
        this.isLoading = false;
        if (err.status === 409) {
          this.errorMessage = 'El email o nombre de usuario ya está en uso.';
        } else {
          this.errorMessage = 'Error al crear la cuenta. Inténtalo de nuevo.';
        }
        console.error('Registro error:', err);
      }
    });
  }
}