import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../auth.service';

@Component({
  selector: 'app-auth',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './auth.component.html'
})
export class AuthComponent {
  esLogin = true;

  datos = {
    nombre: '',
    primerApellido: '',
    segundoApellido: '',
    nombreUsuario: '',
    nickname: '',
    email: '',
    password: '',
    fechaNacimiento: '',
    dni: ''
  };

  constructor(private authService: AuthService, private router: Router) {}

  toggleModo() {
    this.esLogin = !this.esLogin;
  }

  enviar() {
    if (this.esLogin) {
      this.authService.login(this.datos.email, this.datos.password).subscribe({
        next: (res) => {
          alert(`¡Bienvenido al casino, ${res.nombre}!`);
          this.router.navigate(['/']);
        },
        error: (err) => alert(err.error || 'Credenciales incorrectas')
      });
    } else {
      this.authService.registro(this.datos).subscribe({
        next: () => {
          alert('Registro exitoso. ¡Inicia sesión para jugar!');
          this.esLogin = true;
        },
        error: (err) => alert(err.error || 'Error en el registro')
      });
    }
  }
}