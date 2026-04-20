import { Routes } from '@angular/router';
import { JuegosComponent } from './juegos/juegos.component';
import { RecargarSaldoComponent } from './recargar-saldo/recargar-saldo.component';
import { RuletaComponent } from './ruleta/ruleta.component';

export const routes: Routes = [
  { path: '', component: JuegosComponent },
  { path: 'recargar', component: RecargarSaldoComponent },
  { path: 'ruleta', component: RuletaComponent },
  { path: '**', redirectTo: '' }
];