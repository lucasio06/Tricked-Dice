import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';

@Component({
  selector: 'app-auth',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './auth.component.html'
})
export class AuthComponent {
  esLogin = true;

  // Objeto con todos los campos requeridos por el script SQL
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

  constructor(private http: HttpClient, private router: Router) {}

  toggleModo() { 
    this.esLogin = !this.esLogin; 
  }

  enviar() {
    const url = this.esLogin ? 'login' : 'registro';
    
    this.http.post(`http://localhost:5069/api/usuarios/${url}`, this.datos)
      .subscribe({
        next: (res: any) => {
          if (this.esLogin) {
            // Almacenamiento seguro de sesión
            localStorage.setItem('token', res.token); 
            localStorage.setItem('usuario', JSON.stringify(res)); 
            
            alert('¡Bienvenido al casino, ' + res.nombre + '!');
            window.location.href = '/'; 
          } else {
            alert('Registro exitoso. ¡Inicia sesión para jugar!');
            this.esLogin = true; 
          }
        },
        error: (err) => {
          // Captura errores de DNI duplicado o Email ya existente del SQL
          alert(err.error || 'Error en la conexión con el servidor');
        }
      });
  }
}