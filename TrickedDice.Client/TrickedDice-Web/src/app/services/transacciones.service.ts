import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from './api.service';
import { Transaccion } from '../models/api-responses';

@Injectable({ providedIn: 'root' })
export class TransaccionesService {
  constructor(private api: ApiService) {}

  getMisTransacciones(): Observable<Transaccion[]> {
    return this.api.get<Transaccion[]>('/usuarios/transacciones');
  }
}