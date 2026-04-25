import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { BehaviorSubject, Observable, of, tap } from 'rxjs';
import { catchError } from 'rxjs/operators';

export interface UsuarioPerfil {
  nombre: string;
  email: string;
  saldo: number;
}

const STORAGE_TOKEN_KEY = 'token';
const STORAGE_USER_KEY = 'user_cache';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private apiUrl = 'http://localhost:5069/api/usuarios';

  private usuarioSubject = new BehaviorSubject<UsuarioPerfil | null>(null);
  public usuario$ = this.usuarioSubject.asObservable();

  constructor(private http: HttpClient, private router: Router) {
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

    this.http.get<UsuarioPerfil>(`${this.apiUrl}/perfil`).pipe(
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

  login(email: string, password: string): Observable<any> {
    return this.http.post<{ token: string; nombre: string; saldo: number }>(
      `${this.apiUrl}/login`,
      { Email: email, Password: password }
    ).pipe(
      tap((res) => {
        localStorage.setItem(STORAGE_TOKEN_KEY, res.token);
        const perfil: UsuarioPerfil = {
          nombre: res.nombre,
          email: email,
          saldo: res.saldo
        };
        this.cacheUser(perfil);
        this.usuarioSubject.next(perfil);
      })
    );
  }

  registro(datos: any): Observable<any> {
    return this.http.post(`${this.apiUrl}/registro`, datos);
  }

  recargarSaldo(cantidad: number): Observable<{ saldo: number }> {
    return this.http.put<{ saldo: number }>(
      `${this.apiUrl}/recargar`,
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

  private actualizarSaldoLocal(nuevoSaldo: number): void {
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
}