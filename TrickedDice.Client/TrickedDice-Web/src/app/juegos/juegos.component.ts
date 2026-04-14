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
  dniInvalido = false;

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

  validarDNI(): void {
    const dni = this.usuarioData.dni ? this.usuarioData.dni.trim().toUpperCase() : '';
    
    if (dni.length !== 9) {
      this.dniInvalido = true;
      return;
    }

    const letras = "TRWAGMYFPDXBNJZSQVHLCKE";
    const numerosPart = dni.substring(0, 8);
    const letraPart = dni.charAt(8);

    const soloNumeros = /^\d+$/.test(numerosPart);
    if (!soloNumeros) {
      this.dniInvalido = true;
      return;
    }

    if (!/[A-Z]/i.test(letraPart)) {
      this.dniInvalido = true;
      return;
    }

    const numero = parseInt(numerosPart, 10);
    const letraCorrecta = letras[numero % 23];
    this.dniInvalido = letraCorrecta !== letraPart;
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
    this.validarDNI();
    if (this.dniInvalido) {
      alert('DNI no válido. Formato correcto: 12345678Z');
      return;
    }

    const body = {
      NombreUsuario: this.usuarioData.username,
      Email: this.usuarioData.email,
      Password: this.usuarioData.password,
      Dni: this.usuarioData.dni,
      Nombre: this.usuarioData.nombre,
      PrimerApellido: this.usuarioData.primerApellido,
      FechaNacimiento: this.usuarioData.fechaNacimiento,
      SegundoApellido: null,
      Nickname: this.usuarioData.username
    };

    this.http.post('http://localhost:5069/api/usuarios/registro', body).subscribe({
      next: () => {
        alert('Registro completado. ¡Puedes iniciar sesión!');
        this.esModoLogin = true;
        this.limpiarFormulario();
      },
      error: (err) => {
        console.error(err);
        alert('Error al crear la cuenta.');
      }
    });
  }

  limpiarFormulario() {
    this.usuarioData = {
      username: '',
      email: '',
      password: '',
      dni: '',
      nombre: '',
      primerApellido: '',
      fechaNacimiento: ''
    };
    this.dniInvalido = false;
  }

  logout() {
    this.usuarioActivo = null;
    this.saldoActivo = 0;
    localStorage.removeItem('token');
  }

  abrirModal(modo: 'login' | 'registro') {
    this.esModoLogin = (modo === 'login');
    this.mostrarModal = true;
    this.dniInvalido = false;
  }

  cerrarModal() {
    this.mostrarModal = false;
  }
}