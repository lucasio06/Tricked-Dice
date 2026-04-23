import { Component, OnInit, OnDestroy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { Subscription } from 'rxjs';
import { AuthService, UsuarioPerfil } from '../../auth.service';

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
    this.authService.logout();
  }

  irARecargar(): void {
    this.router.navigate(['/recargar']);
  }
}