import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-juegos',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './juegos.component.html'
})
export class JuegosComponent implements OnInit {
  juegos: string[] = [];
  mostrarModal = false;
  esModoLogin = true;
  usuarioActivo: string | null = null;
  saldoActivo: number = 0;

  usuarioData = {
    username: '',
    email: '',
    password: '',
    dni: '',
    nombre: '',
    primerApellido: '',
    fechaNacimiento: ''
  };

  constructor(private http: HttpClient) {}

  ngOnInit() {
    this.http.get<string[]>('http://localhost:5069/api/juegos')
      .subscribe({
        next: (res) => this.juegos = res,
        error: (err) => console.error(err)
      });
  }

  getImagenJuego(juego: string): string {
    const nombre = juego.toLowerCase();
    if (nombre.includes('poker')) return 'poker.png';
    if (nombre.includes('blackjack')) return 'blackjack.png';
    if (nombre.includes('ruleta')) return 'ruleta.png';
    return 'tricked-dice.png';
  }

  onLogin() {
    const body = {
      Email: this.usuarioData.email,
      Password: this.usuarioData.password
    };

    this.http.post('http://localhost:5069/api/usuarios/login', body).subscribe({
      next: (res: any) => {
        this.usuarioActivo = res.nombre; 
        this.saldoActivo = res.saldo;
        localStorage.setItem('token', res.token); 
        this.cerrarModal();
      },
      error: (err) => alert('Error: Email o Contraseña incorrectos.')
    });
  }

  onRegistro() {
    const body = {
      NombreUsuario: this.usuarioData.username,
      Email: this.usuarioData.email,
      Password: this.usuarioData.password,
      Dni: this.usuarioData.dni,
      Nombre: this.usuarioData.nombre,
      PrimerApellido: this.usuarioData.primerApellido,
      FechaNacimiento: this.usuarioData.fechaNacimiento,
      Saldo: 1000
    };

    this.http.post('http://localhost:5069/api/usuarios/registro', body).subscribe({
      next: () => {
        alert('Registro completado.');
        this.esModoLogin = true;
      },
      error: (err) => alert('Error al crear la cuenta.')
    });
  }

  logout() {
    this.usuarioActivo = null;
    this.saldoActivo = 0;
    localStorage.removeItem('token');
  }

  abrirModal(modo: 'login' | 'registro') {
    this.esModoLogin = (modo === 'login');
    this.mostrarModal = true;
  }

  cerrarModal() {
    this.mostrarModal = false;
  }
}