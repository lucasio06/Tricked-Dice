import { Component, OnInit, NgZone } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../auth.service';
import { RUTAS } from '../utils/rutas.const';
declare var google: any;

@Component({
  selector: 'app-registro',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './registro.component.html',
  styleUrls: ['./registro.component.css']
})
export class RegistroComponent implements OnInit {
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
  contrasenaInvalida = false;
  isLoading: boolean = false;
  errorMessage: string | null = null;

  constructor(
    private authService: AuthService,
    public router: Router,
    private ngZone: NgZone
  ) {}

  ngOnInit() {
    if (typeof google !== 'undefined') {
      google.accounts.id.initialize({
        client_id: '150911175141-uqqcdjlgge80rm381n4raolk8darhkg1.apps.googleusercontent.com',
        callback: this.handleGoogleCredentialResponse.bind(this)
      });

      google.accounts.id.renderButton(
        document.getElementById('googleBtn'),
        { theme: 'dark', size: 'large', text: 'continue_with', width: '300' }
      );
    }
  }

  handleGoogleCredentialResponse(response: any) {
    this.isLoading = true;
    this.errorMessage = null;

    this.authService.googleLogin(response.credential).subscribe({
      next: (res) => {
        this.isLoading = false;

        localStorage.setItem('token', res.token); 

        const perfilConstruido = {
          nombreUsuario: res.nombreUsuario || res.nombre,
          nombre: res.nombre,
          email: res.email || '',
          saldo: res.saldo,
          rol: res.rol || 'User'
        };
        
        this.authService['cacheUser'](perfilConstruido);
        this.authService['usuarioSubject'].next(perfilConstruido);

        this.ngZone.run(() => {
          alert(`¡Bienvenido a Tricked Dice, ${res.nombre}!`);
          this.router.navigate(['/lobby']); 
        });
      },
      error: (err) => {
        this.isLoading = false;
        this.ngZone.run(() => {
          this.errorMessage = err.error || 'Error al autenticar con Google.';
        });
      }
    });
  }

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
    
    const patron = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&#])[A-Za-z\d@$!%*?&#]{8,}$/;
    
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
      this.errorMessage = 'La contraseña no cumple con los requisitos mínimos de seguridad. Debe tener mínimo 8 caracteres, una mayúscula, una minúscula, un número y un carácter especial (@$!%*?&#).';
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