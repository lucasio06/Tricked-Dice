import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Router, RouterLink } from '@angular/router';
import { Subscription } from 'rxjs';
import { AuthService, UsuarioPerfil } from '../auth.service';

@Component({
  selector: 'app-juegos',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './juegos.component.html'
})
export class JuegosComponent implements OnInit, OnDestroy {
  juegos: string[] = [];
  usuarioActivo: UsuarioPerfil | null = null;
  private usuarioSub: Subscription | null = null;

  constructor(
    private http: HttpClient,
    private authService: AuthService,
    public router: Router
  ) {}

  ngOnInit() {
    this.usuarioSub = this.authService.usuario$.subscribe(usuario => {
      console.log('[JuegosComponent] Usuario actualizado:', usuario);
      this.usuarioActivo = usuario;
    });
    this.cargarJuegos();
  }

  ngOnDestroy() {
    this.usuarioSub?.unsubscribe();
  }

  cargarJuegos() {
    this.http.get<string[]>('http://localhost:5069/api/juegos')
      .subscribe({
        next: (res) => this.juegos = res,
        error: (err) => console.error('Error cargando juegos:', err)
      });
  }

  getImagenJuego(juego: string): string {
    const nombre = juego.toLowerCase();
    if (nombre.includes('poker')) return 'poker.png';
    if (nombre.includes('blackjack')) return 'blackjack.png';
    if (nombre.includes('ruleta')) return 'ruleta.png';
    return 'tricked-dice.png';
  }

  logout() {
    this.authService.logout();
  }

  irARecargar() {
    this.router.navigate(['/recargar']);
  }
}