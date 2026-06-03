import { Injectable } from '@angular/core';
import { CanActivate, Router } from '@angular/router';
import { AuthService } from './auth.service';
import { RUTAS } from './utils/rutas.const';

@Injectable({ providedIn: 'root' })
export class AdminGuard implements CanActivate {
  constructor(
    private authService: AuthService,
    private router: Router
  ) {}

  canActivate(): boolean {
    const usuario = this.authService.getUsuarioActual(); 

    if (usuario && usuario.rol === 'Admin') {
      return true;
    } else {
      this.router.navigate([RUTAS.home]);
      return false;
    }
  }
}