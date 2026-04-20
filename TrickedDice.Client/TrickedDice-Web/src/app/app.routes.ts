import { Routes } from '@angular/router';
import { JuegosComponent } from './juegos/juegos.component';
import { RecargarSaldoComponent } from './recargar-saldo/recargar-saldo.component';

export const routes: Routes = [
  { path: '', component: JuegosComponent },
  { path: 'recargar', component: RecargarSaldoComponent },
  { path: '**', redirectTo: '' }                
];