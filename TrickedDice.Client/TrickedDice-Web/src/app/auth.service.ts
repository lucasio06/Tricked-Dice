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
    console.log('[AuthService] Inicializando sesión. Token existe:', this.isLoggedIn());
    this.inicializarSesion();
  }

  private inicializarSesion(): void {
    if (!this.isLoggedIn()) {
      console.log('[AuthService] No hay token, usuario no logueado.');
      return;
    }

    // Restaurar inmediatamente desde cache
    const cachedUser = this.getCachedUser();
    if (cachedUser) {
      console.log('[AuthService] Cache encontrado, restaurando usuario:', cachedUser);
      this.usuarioSubject.next(cachedUser);
    }

    // Actualizar en segundo plano desde el backend
    this.http.get<UsuarioPerfil>(`${this.apiUrl}/perfil`).pipe(
      tap(perfil => {
        console.log('[AuthService] Perfil actualizado desde backend:', perfil);
        this.cacheUser(perfil);
        this.usuarioSubject.next(perfil);
      }),
      catchError(err => {
        console.warn('[AuthService] Error al obtener /perfil:', err);
        if (err.status === 401) {
          console.log('[AuthService] Token inválido, cerrando sesión.');
          this.logout();
        } else {
          console.log('[AuthService] Error de red, manteniendo cache.');
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
    this.router.navigate(['/login']);
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