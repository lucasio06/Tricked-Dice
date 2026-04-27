import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { AuthService } from '../auth.service';
import { UsuarioPerfil } from '../models/api-responses';
import { ToastService } from '../services/toast.service';
import { NavbarComponent } from '../shared/navbar/navbar.component';
import { RUTAS } from '../utils/rutas.const';

@Component({
  selector: 'app-recargar-saldo',
  standalone: true,
  imports: [CommonModule, FormsModule, NavbarComponent],
  templateUrl: './recargar-saldo.component.html',
  styleUrls: ['./recargar-saldo.component.css']
})
export class RecargarSaldoComponent implements OnInit {
  cantidades = [10, 20, 50, 100, 200, 500];
  cantidadSeleccionada: number = 50;
  saldoActual: number = 0;
  recargando = false;
  private returnUrl: string = RUTAS.home;

  constructor(
    private router: Router,
    private route: ActivatedRoute,
    private authService: AuthService,
    private toast: ToastService
  ) {}

  ngOnInit() {
    this.returnUrl = this.route.snapshot.queryParams['returnUrl'] || RUTAS.home;
    this.authService.usuario$.subscribe(usuario => {
      if (usuario) {
        this.saldoActual = usuario.saldo;
      }
    });
  }

  recargar() {
    const cantidad = parseFloat(this.cantidadSeleccionada.toString());
    if (isNaN(cantidad) || cantidad <= 0) {
      this.toast.warning('Selecciona una cantidad válida');
      return;
    }

    if (this.recargando) return;
    this.recargando = true;

    this.authService.recargarSaldo(cantidad).subscribe({
      next: (res) => {
        this.toast.success(`¡Has recargado ${cantidad.toFixed(2)} €! Nuevo saldo: ${res.saldo.toFixed(2)} €`);
        this.recargando = false;
        this.router.navigateByUrl(this.returnUrl);
      },
      error: (err) => {
        console.error(err);
        this.toast.error('Error al recargar saldo. Inténtalo de nuevo.');
        this.recargando = false;
      }
    });
  }

  volver() {
    this.router.navigateByUrl(this.returnUrl);
  }
}