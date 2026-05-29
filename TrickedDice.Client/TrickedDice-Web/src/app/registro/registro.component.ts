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
  contrasenaInvalida = false; // <-- Nueva propiedad de control
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
    const letraPart = dni[8];

    if (!/^\d+$/.test(numerosPart)) {
      this.dniInvalido = true;
      return false;
    }

    const index = parseInt(numerosPart, 10) % 23;
    if (letras[index] !== letraPart) {
      this.dniInvalido = true;
      return false;
    }

    this.dniInvalido = false;
    return true;
  }

  validarContrasena(): boolean {
    const password = this.usuarioData.password || '';
    
    const patron = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
    
    this.contrasenaInvalida = !patron.test(password);
    return !this.contrasenaInvalida;
  }

  validarEmail(): boolean {
    const email = this.usuarioData.email || '';
    const patronEmail = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    return patronEmail.test(email);
  }

  esMayorDeEdad(): boolean {
    if (!this.usuarioData.fechaNacimiento) return false;
    const fechaNac = new Date(this.usuarioData.fechaNacimiento);
    const hoy = new Date();
    
    let edad = hoy.getFullYear() - fechaNac.getFullYear();
    const mes = hoy.getMonth() - fechaNac.getMonth();
    
    if (mes < 0 || (mes === 0 && hoy.getDate() < fechaNac.getDate())) {
      edad--;
    }
    return edad >= 18;
  }

  onSubmit() {
    this.errorMessage = null;

    if (!this.usuarioData.username || !this.usuarioData.email || !this.usuarioData.password || 
        !this.usuarioData.nombre || !this.usuarioData.primerApellido || !this.usuarioData.fechaNacimiento) {
      this.errorMessage = 'Por favor, completa todos los campos obligatorios.';
      return;
    }

    if (!this.validarEmail()) {
      this.errorMessage = 'Por favor, introduce un correo electrónico válido (ejemplo@dominio.com).';
      return;
    }

    if (!this.esMayorDeEdad()) {
      this.errorMessage = 'Debes ser mayor de 18 años para registrarte en la plataforma.';
      return;
    }

    if (this.usuarioData.dni && !this.validarDNI()) {
      this.errorMessage = 'El DNI introducido no es válido. Formato: 12345678Z';
      return;
    }

    if (!this.validarContrasena()) {
      this.errorMessage = 'La contraseña no cumple con los requisitos mínimos de seguridad.';
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
        if (err.status === 400 && err.error) {
          this.errorMessage = err.error.mensaje || err.error;
        } else if (err.status === 409) {
          this.errorMessage = 'El email o nombre de usuario ya está en uso.';
        } else {
          this.errorMessage = 'Ocurrió un error en el servidor. Inténtalo de nuevo.';
        }
      }
    });
  }
}