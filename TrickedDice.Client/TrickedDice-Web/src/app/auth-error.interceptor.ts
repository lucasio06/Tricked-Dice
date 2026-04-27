import { Injectable } from '@angular/core';
import { HttpInterceptor, HttpRequest, HttpHandler, HttpEvent, HttpErrorResponse } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { Router } from '@angular/router';
import { ToastService } from './services/toast.service';
import { RUTAS } from './utils/rutas.const';

@Injectable()
export class AuthErrorInterceptor implements HttpInterceptor {
  private readonly rutasPublicas = [RUTAS.home, RUTAS.login, RUTAS.registro];

  constructor(
    private router: Router,
    private toast: ToastService
  ) {}

  intercept(req: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {
    return next.handle(req).pipe(
      catchError((error: HttpErrorResponse) => {
        if (error.status === 401) {
          if (error.error && typeof error.error === 'string' && error.error.includes('baneada')) {
            return throwError(() => error);
          }
          
          const rutaActual = this.router.url;
          const esRutaPublica = this.rutasPublicas.some(ruta => rutaActual === ruta);

          if (!req.url.includes('/login') && !esRutaPublica) {
            this.toast.warning('Sesión expirada. Inicia sesión de nuevo.');
            localStorage.removeItem('token');
            localStorage.removeItem('user_cache');
            this.router.navigate([RUTAS.login]);
          }
          return throwError(() => error);
        }

        if (error.status === 400 && error.error?.mensaje) {
          this.toast.error(error.error.mensaje);
        } else if (error.status >= 500) {
          this.toast.error('Error del servidor. Inténtalo de nuevo más tarde.');
        } else if (!req.url.includes('/login') && !req.url.includes('/registro')) {
          this.toast.error('Ha ocurrido un error inesperado.');
        }

        return throwError(() => error);
      })
    );
  }
}