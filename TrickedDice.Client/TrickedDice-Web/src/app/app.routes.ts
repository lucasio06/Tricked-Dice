import { Routes } from '@angular/router';
import { AuthComponent } from './auth/auth.component';
import { JuegosComponent } from './juegos/juegos.component'; // ✅ Sin el .html

export const routes: Routes = [
  { path: '', component: JuegosComponent },    
  { path: 'auth', component: AuthComponent },   
  { path: '**', redirectTo: '' }                
];