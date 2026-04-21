import { Injectable } from '@angular/core';
import { HttpInterceptor, HttpRequest, HttpHandler, HttpEvent, HttpErrorResponse } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { Router } from '@angular/router';
import { ToastService } from './services/toast.service';

@Injectable()
export class AuthErrorInterceptor implements HttpInterceptor {
  constructor(
    private router: Router,
    private toast: ToastService
  ) {}

  intercept(req: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {
    return next.handle(req).pipe(
      catchError((error: HttpErrorResponse) => {
        if (error.status === 401) {
          // Solo mostramos el toast y redirigimos a login
          this.toast.warning('🔐 Sesión expirada. Inicia sesión de nuevo.');
          // Limpiar token directamente (sin depender de AuthService)
          localStorage.removeItem('token');
          localStorage.removeItem('user_cache');
          this.router.navigate(['/login']);
        }
        return throwError(() => error);
      })
    );
  }
}