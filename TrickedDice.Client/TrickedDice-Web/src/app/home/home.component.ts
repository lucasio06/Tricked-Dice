import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { AuthService } from '../auth.service';
import { UsuarioPerfil } from '../models/api-responses';
import { NavbarComponent } from '../shared/navbar/navbar.component';
import { ApiService } from '../services/api.service';
import { RUTAS } from '../utils/rutas.const';

const JUEGOS_PUBLICOS: string[] = ['Poker', 'Blackjack', 'Ruleta'];

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [CommonModule, NavbarComponent],
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.css']
})
export class HomeComponent implements OnInit, OnDestroy {
  readonly RUTAS = RUTAS;
  
  juegos: string[] = [];
  usuarioActivo: UsuarioPerfil | null = null;
  private usuarioSub: Subscription | null = null;

  constructor(
    private api: ApiService,
    private authService: AuthService,
    public router: Router
  ) {}

  ngOnInit() {
    this.usuarioSub = this.authService.usuario$.subscribe(usuario => {
      this.usuarioActivo = usuario;
      if (usuario) {
        if (usuario.dni && usuario.dni.startsWith('TMP')) {
          this.router.navigate(['/completar-perfil']);
          return;
        }
        this.cargarJuegos();
      } else {
        this.juegos = JUEGOS_PUBLICOS;
      }
    });
  }

  ngOnDestroy() {
    this.usuarioSub?.unsubscribe();
  }

  cargarJuegos() {
    this.api.get<string[]>('/juegos')
      .subscribe({
        next: (res) => this.juegos = res,
        error: (err) => console.error(err)
      });
  }

  getImagenJuego(juego: string): string {
    const nombre = juego.toLowerCase();
    if (nombre.includes('poker')) return 'poker.png';
    if (nombre.includes('blackjack')) return 'blackjack.png';
    if (nombre.includes('ruleta')) return 'ruleta.png';
    return 'tricked-dice.png';
  }

  navegarAJuego(juego: string): void {
    if (!this.authService.isLoggedIn()) {
      this.router.navigate([RUTAS.login]);
      return;
    }

    const nombre = juego.toLowerCase();
    if (nombre.includes('ruleta')) {
      this.router.navigate([RUTAS.ruleta]);
    } else if (nombre.includes('poker')) {
      this.router.navigate([RUTAS.videoPoker]);
    } else if (nombre.includes('blackjack')) {
      this.router.navigate([RUTAS.blackjack]);
    }
  }
}