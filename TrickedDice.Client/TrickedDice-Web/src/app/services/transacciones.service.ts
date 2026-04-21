import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface Transaccion {
  fecha: string;
  cantidad: number;
  tipo: string;
}

@Injectable({ providedIn: 'root' })
export class TransaccionesService {
  private apiUrl = 'http://localhost:5069/api/usuarios';

  constructor(private http: HttpClient) {}

  getMisTransacciones(): Observable<Transaccion[]> {
    return this.http.get<Transaccion[]>(`${this.apiUrl}/transacciones`);
  }
}