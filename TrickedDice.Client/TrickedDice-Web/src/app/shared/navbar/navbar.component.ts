import { Component, OnInit, OnDestroy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { Subscription } from 'rxjs';
import { AuthService } from '../../auth.service';
import { ToastService } from '../../services/toast.service';
import { UsuarioPerfil } from '../../models/api-responses';
import { RUTAS } from '../../utils/rutas.const';

@Component({
  selector: 'app-navbar',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './navbar.component.html',
  styleUrls: ['./navbar.component.scss']
})
export class NavbarComponent implements OnInit, OnDestroy {
  private authService = inject(AuthService);
  private router = inject(Router);
  private toast = inject(ToastService);
  
  usuarioActivo: UsuarioPerfil | null = null;
  private usuarioSub: Subscription | null = null;

  ngOnInit(): void {
    this.usuarioSub = this.authService.usuario$.subscribe(usuario => {
      this.usuarioActivo = usuario;
    });
  }

  ngOnDestroy(): void {
    this.usuarioSub?.unsubscribe();
  }

  logout(): void {
    this.toast.info('Has cerrado sesión.');
    this.authService.logout();
  }

  irARecargar(): void {
    this.router.navigate([RUTAS.recargar], { 
      queryParams: { returnUrl: this.router.url } 
    });
  }
  
  esAdmin(): boolean {
    return this.usuarioActivo?.email === 'admin@trickeddice.com';
  }
}