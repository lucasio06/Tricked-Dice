import { Routes } from '@angular/router';
import { JuegosComponent } from './juegos/juegos.component';

export const routes: Routes = [
  { path: '', component: JuegosComponent },
  { path: '**', redirectTo: '' }                
];