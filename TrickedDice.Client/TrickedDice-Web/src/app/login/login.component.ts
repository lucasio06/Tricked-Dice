import { Component, OnInit, NgZone } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../auth.service';
import { ToastService } from '../services/toast.service';
import { RUTAS } from '../utils/rutas.const';
declare var google: any;

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.css']
})
export class LoginComponent implements OnInit{
  email: string = '';
  password: string = '';
  isLoading: boolean = false;
  errorMessage: string | null = null;

  constructor(
    private authService: AuthService,
    private toast: ToastService,
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
        document.getElementById('googleBtnLogin'),
        { theme: 'dark', size: 'large', text: 'signin_with', width: '300' }
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

        const perfilUsuario = {
          nombre: res.nombre,
          email: res.email || this.email || '', 
          saldo: res.saldo
        };
        
        this.authService['cacheUser'](perfilUsuario);
        this.authService['usuarioSubject'].next(perfilUsuario);

        this.ngZone.run(() => {
          if (res.esNuevo) {
            this.toast.success('¡Cuenta creada! Completa tus datos legales.');
            this.router.navigate([RUTAS.completarPerfil]);
          } else {
            this.toast.success(`¡Bienvenido de nuevo, ${res.nombre}!`);
            this.router.navigate([RUTAS.home]); 
          }
        });
      },
      error: (err) => {
        this.isLoading = false;
        this.ngZone.run(() => {
          this.errorMessage = (err.error && typeof err.error === 'string') ? err.error : 'Error al iniciar sesión con Google.';
        });
      }
    });
  }

  onSubmit() {
    if (!this.email || !this.password) {
      this.errorMessage = 'Por favor, completa todos los campos.';
      return;
    }

    this.isLoading = true;
    this.errorMessage = null;

    this.authService.login(this.email, this.password).subscribe({
      next: () => {
        this.isLoading = false;
        this.toast.success('¡Ha iniciado sesión !');
        this.router.navigate([RUTAS.home]);
      },
      error: (err) => {
        this.isLoading = false;
        if (err.status === 401) {
          if (err.error && typeof err.error === 'string') {
            this.errorMessage = err.error;
          } else if (err.error && err.error.mensaje) {
            this.errorMessage = err.error.mensaje;
          } else {
            this.errorMessage = 'Email o contraseña incorrectos.';
          }
        } else if (err.status === 0) {
          this.errorMessage = 'Error de conexión. Verifica que el backend esté corriendo.';
        } else {
          this.errorMessage = 'Error de conexión. Inténtalo de nuevo.';
        }
        console.error('Login error:', err);
      }
    });
  }
}