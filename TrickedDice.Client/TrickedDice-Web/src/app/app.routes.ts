import { Routes } from '@angular/router';
import { AuthGuard } from './auth.guard';
import { JuegosComponent } from './juegos/juegos.component';
import { RecargarSaldoComponent } from './recargar-saldo/recargar-saldo.component';
import { RuletaComponent } from './ruleta/ruleta.component';
import { LoginComponent } from './login/login.component';
import { RegistroComponent } from './registro/registro.component';
import { MisMovimientosComponent } from './mis-movimientos/mis-movimientos.component';

export const routes: Routes = [
  { path: '', component: JuegosComponent, canActivate: [AuthGuard] },
  { path: 'recargar', component: RecargarSaldoComponent, canActivate: [AuthGuard] },
  { path: 'ruleta', component: RuletaComponent, canActivate: [AuthGuard] },
  { path: 'mis-movimientos', component: MisMovimientosComponent, canActivate: [AuthGuard] },
  { path: 'login', component: LoginComponent },
  { path: 'registro', component: RegistroComponent },
  { path: '**', redirectTo: '' }
];