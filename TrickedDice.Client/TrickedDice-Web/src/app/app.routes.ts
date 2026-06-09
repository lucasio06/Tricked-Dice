import { Routes } from '@angular/router';
import { AuthGuard } from './auth.guard';
import { AdminGuard } from './admin.guard';
import { HomeComponent } from './home/home.component';
import { RecargarSaldoComponent } from './recargar-saldo/recargar-saldo.component';
import { RecargarExitoComponent } from './recargar-saldo/recargar-exito.component';
import { RuletaComponent } from './ruleta/ruleta.component';
import { LoginComponent } from './login/login.component';
import { RegistroComponent } from './registro/registro.component';
import { MisMovimientosComponent } from './mis-movimientos/mis-movimientos.component';
import { PokerComponent } from './poker/poker.component';
import { BlackjackComponent } from './blackjack/blackjack.component';
import { AdminComponent } from './admin/admin.component';
import { SobreNosotrosComponent } from './sobre-nosotros/sobre-nosotros.component';
import { PoliticaPrivacidadComponent } from './politica-privacidad/politica-privacidad.component';
import { SoporteComponent } from './soporte/soporte.component';
import { LobbyComponent } from './lobby/lobby.component';
import { RoomComponent } from './room/room.component';
import { CompletarPerfilComponent } from './completar-perfil/completar-perfil.component';
import { PerfilComponent } from './perfil/perfil.component';

export const routes: Routes = [
  { path: '', component: HomeComponent },
  { path: 'admin', component: AdminComponent, canActivate: [AdminGuard] },
  { path: 'recargar', component: RecargarSaldoComponent, canActivate: [AuthGuard] },
  { path: 'recargar-saldo/exito', component: RecargarExitoComponent, canActivate: [AuthGuard] },
  { path: 'ruleta', component: RuletaComponent, canActivate: [AuthGuard] },
  { path: 'poker', component: PokerComponent, canActivate: [AuthGuard] },
  { path: 'blackjack', component: BlackjackComponent, canActivate: [AuthGuard] },
  { path: 'mis-movimientos', component: MisMovimientosComponent, canActivate: [AuthGuard] },
  { path: 'perfil', component: PerfilComponent, canActivate: [AuthGuard] },
  { path: 'login', component: LoginComponent },
  { path: 'registro', component: RegistroComponent },
  { path: 'completar-perfil', component: CompletarPerfilComponent, canActivate: [AuthGuard] },
  { path: 'sobre-nosotros', component: SobreNosotrosComponent },
  { path: 'politica-privacidad', component: PoliticaPrivacidadComponent },
  { path: 'soporte', component: SoporteComponent },
  { path: 'lobby', component: LobbyComponent, canActivate: [AuthGuard] },
  { path: 'sala/:id', component: RoomComponent, canActivate: [AuthGuard] },
  { path: '**', redirectTo: '' }
];