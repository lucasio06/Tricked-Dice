import { Component, OnInit, OnDestroy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { Subscription } from 'rxjs';
import { AuthService } from '../auth.service';
import { UsuarioPerfil } from '../models/api-responses';
import { ToastService } from '../services/toast.service';
import { NavbarComponent } from '../shared/navbar/navbar.component';
import { FooterComponent } from '../shared/footer/footer.component';

@Component({
  selector: 'app-perfil',
  standalone: true,
  imports: [CommonModule, RouterLink, NavbarComponent, FooterComponent],
  templateUrl: './perfil.component.html',
  styleUrls: ['./perfil.component.scss']
})
export class PerfilComponent implements OnInit, OnDestroy {
  private authService = inject(AuthService);
  private toastService = inject(ToastService);

  usuarioActivo: UsuarioPerfil | null = null;
  private usuarioSub: Subscription | null = null;
  isLoading: boolean = true;

  ngOnInit(): void {
    this.usuarioSub = this.authService.usuario$.subscribe({
      next: (usuario: UsuarioPerfil | null) => {
        this.usuarioActivo = usuario;
        this.isLoading = false;
      },
      error: (error: any) => {
        this.toastService.error('Error al cargar la información del perfil');
        this.isLoading = false;
      }
    });
  }

  ngOnDestroy(): void {
    this.usuarioSub?.unsubscribe();
  }

  getIniciales(): string {
    if (!this.usuarioActivo?.nombreUsuario) return 'TD';
    return this.usuarioActivo.nombreUsuario.substring(0, 2).toUpperCase();
  }
}