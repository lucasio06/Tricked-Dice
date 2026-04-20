import { Component, OnInit, OnDestroy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterOutlet } from '@angular/router';
import { ToastComponent } from './shared/toast/toast.component';
import { GlitchDirective } from './directives/glitch.directive';
import { ToastService } from './services/toast.service';
import { AuthService } from './auth.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, RouterOutlet, ToastComponent, GlitchDirective],
  templateUrl: './app.html',
  styleUrl: './app.scss'
})
export class App implements OnInit, OnDestroy {
  private toast = inject(ToastService);
  private authService = inject(AuthService);
  private lastToken: string | null = null;
  private checkInterval: any;
  private loginNotificationShown = false;
  private wasLoggedIn = false;

  isLoggedIn = false;
  usuarioData: any = null;

  constructor(public router: Router) {}

  ngOnInit() {
    this.checkUser();
    this.lastToken = localStorage.getItem('token');
    this.wasLoggedIn = !!this.lastToken;
    this.checkInterval = setInterval(() => this.checkLogin(), 300);
  }

  ngOnDestroy() {
    clearInterval(this.checkInterval);
  }

  checkUser() {
    this.usuarioData = this.authService.getUsuario();
    this.isLoggedIn = !!this.usuarioData;
  }

  private checkLogin() {
    const token = localStorage.getItem('token');
    const isLoggedIn = !!token;

    if (isLoggedIn && token !== this.lastToken && !this.loginNotificationShown) {
      const nombre = this.getUserNameFromToken(token);
      this.toast.success(`¡Bienvenido, ${nombre}!`);
      this.loginNotificationShown = true;
      this.wasLoggedIn = true;
      this.lastToken = token;
      this.checkUser(); 
    }

    if (!isLoggedIn && this.wasLoggedIn) {
      this.toast.info(`Has cerrado sesión.`);
      this.loginNotificationShown = false;
      this.wasLoggedIn = false;
      this.lastToken = null;
      this.checkUser(); 
    }

    if (isLoggedIn) {
      this.lastToken = token;
    }
  }

  private getUserNameFromToken(token: string): string {
    try {
      const payload = token.split('.')[1];
      const decoded = JSON.parse(atob(payload));
      return decoded['http://schemas.xmlsoap.org/ws/2005/05/identity/claims/name'] 
          || decoded['unique_name'] 
          || decoded['email'] 
          || 'Jugador';
    } catch (e) {
      return 'Jugador';
    }
  }

  logout() {
    this.authService.logout();
    this.isLoggedIn = false;
    this.usuarioData = null;
    this.router.navigate(['/']);
  }
}