import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface UsuarioAdmin {
  idUsuario: number;
  email: string;
  nombre: string;
  primerApellido: string;
  nombreUsuario: string;
  saldo: number;
  fechaNacimiento: string;
  dni: string;
  baneado: boolean;
}

export interface TransaccionAdmin {
  idTransaccion: number;
  fecha: string;
  cantidad: number;
  tipo: string;
  email: string;
  nombre: string;
}

export interface Estadisticas {
  totalUsuarios: number;
  totalRecargas: number;
  totalApostado: number;
  totalPremios: number;
  beneficio: number;
  saldoTotal: number;
}

@Injectable({ providedIn: 'root' })
export class AdminService {
  private apiUrl = 'http://localhost:5069/api/admin';

  constructor(private http: HttpClient) {}

  getUsuarios(): Observable<UsuarioAdmin[]> {
    return this.http.get<UsuarioAdmin[]>(`${this.apiUrl}/usuarios`);
  }

  getTransacciones(idUsuario?: number): Observable<TransaccionAdmin[]> {
    let url = `${this.apiUrl}/transacciones`;
    if (idUsuario) {
      url += `?idUsuario=${idUsuario}`;
    }
    return this.http.get<TransaccionAdmin[]>(url);
  }

  getEstadisticas(): Observable<Estadisticas> {
    return this.http.get<Estadisticas>(`${this.apiUrl}/estadisticas`);
  }

  banearUsuario(idUsuario: number, baneado: boolean): Observable<any> {
    return this.http.put(`${this.apiUrl}/banear/${idUsuario}`, { baneado });
  }
}