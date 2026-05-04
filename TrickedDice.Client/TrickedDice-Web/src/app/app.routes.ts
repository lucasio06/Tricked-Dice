import { Routes } from '@angular/router';
import { AuthGuard } from './auth.guard';
import { HomeComponent } from './home/home.component';
import { RecargarSaldoComponent } from './recargar-saldo/recargar-saldo.component';
import { RuletaComponent } from './ruleta/ruleta.component';
import { LoginComponent } from './login/login.component';
import { RegistroComponent } from './registro/registro.component';
import { MisMovimientosComponent } from './mis-movimientos/mis-movimientos.component';
import { VideoPokerComponent } from './video-poker/video-poker.component';
import { BlackjackComponent } from './blackjack/blackjack.component';
import { AdminComponent } from './admin/admin.component';
import { RUTAS } from './utils/rutas.const';

export const routes: Routes = [
  { path: '', component: HomeComponent },
  { path: 'recargar', component: RecargarSaldoComponent, canActivate: [AuthGuard] },
  { path: 'ruleta', component: RuletaComponent, canActivate: [AuthGuard] },
  { path: 'video-poker', component: VideoPokerComponent, canActivate: [AuthGuard] },
  { path: 'blackjack', component: BlackjackComponent, canActivate: [AuthGuard] },
  { path: 'mis-movimientos', component: MisMovimientosComponent, canActivate: [AuthGuard] },
  { path: 'admin', component: AdminComponent, canActivate: [AuthGuard] },
  { path: 'login', component: LoginComponent },
  { path: 'registro', component: RegistroComponent },
  { path: '**', redirectTo: '' }
];