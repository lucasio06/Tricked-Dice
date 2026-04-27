import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from './api.service';
import { UsuarioAdmin, TransaccionAdmin, Estadisticas } from '../models/api-responses';

@Injectable({ providedIn: 'root' })
export class AdminService {
  constructor(private api: ApiService) {}

  getUsuarios(): Observable<UsuarioAdmin[]> {
    return this.api.get<UsuarioAdmin[]>('/admin/usuarios');
  }

  getTransacciones(idUsuario?: number): Observable<TransaccionAdmin[]> {
    const endpoint = idUsuario
      ? `/admin/transacciones?idUsuario=${idUsuario}`
      : '/admin/transacciones';
    return this.api.get<TransaccionAdmin[]>(endpoint);
  }

  getEstadisticas(): Observable<Estadisticas> {
    return this.api.get<Estadisticas>('/admin/estadisticas');
  }

  banearUsuario(idUsuario: number, baneado: boolean): Observable<any> {
    return this.api.put(`/admin/banear/${idUsuario}`, { baneado });
  }
}