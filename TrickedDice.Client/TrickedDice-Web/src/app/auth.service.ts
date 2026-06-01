import { Injectable } from '@angular/core';
import { Router } from '@angular/router';
import { BehaviorSubject, Observable, of, tap } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { ApiService } from './services/api.service';
import { LoginResponse, UsuarioPerfil, RecargarResponse } from './models/api-responses';

const STORAGE_TOKEN_KEY = 'token';
const STORAGE_USER_KEY = 'user_cache';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private usuarioSubject = new BehaviorSubject<UsuarioPerfil | null>(null);
  public usuario$ = this.usuarioSubject.asObservable();

  constructor(private api: ApiService, private router: Router) {
    this.inicializarSesion();
  }

  private inicializarSesion(): void {
    if (!this.isLoggedIn()) {
      return;
    }

    const cachedUser = this.getCachedUser();
    if (cachedUser) {
      this.usuarioSubject.next(cachedUser);
    }

    this.api.get<UsuarioPerfil>('/usuarios/perfil').pipe(
      tap(perfil => {
        this.cacheUser(perfil);
        this.usuarioSubject.next(perfil);
      }),
      catchError(err => {
        if (err.status === 401) {
          this.logout();
        }
        return of(null);
      })
    ).subscribe();
  }

  private cacheUser(user: UsuarioPerfil): void {
    localStorage.setItem(STORAGE_USER_KEY, JSON.stringify(user));
  }

  private getCachedUser(): UsuarioPerfil | null {
    const cached = localStorage.getItem(STORAGE_USER_KEY);
    return cached ? JSON.parse(cached) : null;
  }

  private clearCache(): void {
    localStorage.removeItem(STORAGE_USER_KEY);
  }

  login(email: string, password: string): Observable<LoginResponse> {
    return this.api.post<LoginResponse>(
      '/usuarios/login',
      { Email: email, Password: password }
    ).pipe(
      tap((res) => {
        localStorage.setItem(STORAGE_TOKEN_KEY, res.token);
        const perfil: UsuarioPerfil = {
          nombre: res.nombre,
          email: email,
          saldo: res.saldo,
          rol: res.rol
        };
        this.cacheUser(perfil);
        this.usuarioSubject.next(perfil);
      })
    );
  }

  registro(datos: any): Observable<any> {
    return this.api.post('/usuarios/registro', datos);
  }

  recargarSaldo(cantidad: number): Observable<RecargarResponse> {
    return this.api.put<RecargarResponse>(
      '/usuarios/recargar',
      { cantidad }
    ).pipe(
      tap((res) => this.actualizarSaldoLocal(res.saldo))
    );
  }

  actualizarSaldo(nuevoSaldo: number): void {
    const current = this.usuarioSubject.value;
    if (current) {
      const updated = { ...current, saldo: nuevoSaldo };
      this.cacheUser(updated);
      this.usuarioSubject.next(updated);
    }
  }

  public actualizarSaldoLocal(nuevoSaldo: number): void {
    this.actualizarSaldo(nuevoSaldo);
  }

  logout(): void {
    localStorage.removeItem(STORAGE_TOKEN_KEY);
    this.clearCache();
    this.usuarioSubject.next(null);
    this.router.navigate(['/']);
  }

  isLoggedIn(): boolean {
    return !!localStorage.getItem(STORAGE_TOKEN_KEY);
  }

  getToken(): string | null {
    return localStorage.getItem(STORAGE_TOKEN_KEY);
  }

  getUsuarioActual(): UsuarioPerfil | null {
    return this.usuarioSubject.value;
  }

  googleLogin(idToken: string): Observable<any> {
    return this.api.post('/usuarios/google-login', { idToken });
  }

  completarPerfil(datos: { dni: string, fechaNacimiento: string }): Observable<any> {
    return this.api.post('/usuarios/completar-perfil', datos);
  }
}