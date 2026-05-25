import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { AuthService } from '../auth.service';
import { ToastService } from '../services/toast.service';
import { NavbarComponent } from '../shared/navbar/navbar.component';
import { PaymentService } from '../services/payment.service';
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
    public router: Router,
    private route: ActivatedRoute,
    private authService: AuthService,
    private toast: ToastService,
    private paymentService: PaymentService
  ) {}

  async ngOnInit() {
    this.returnUrl = this.route.snapshot.queryParams['returnUrl'] || RUTAS.home;
    this.authService.usuario$.subscribe(usuario => {
      if (usuario) {
        this.saldoActual = usuario.saldo;
      }
    });
  }

  async recargar() {
    const cantidad = parseFloat(this.cantidadSeleccionada.toString());
    if (isNaN(cantidad) || cantidad <= 0) {
      this.toast.warning('Selecciona una cantidad válida');
      return;
    }

    if (this.recargando) return;
    this.recargando = true;

    try {
      const successUrl = `${window.location.origin}/recargar-saldo/exito?session_id={CHECKOUT_SESSION_ID}`;
      const cancelUrl = `${window.location.origin}/recargar-saldo`;
      console.log('Success URL configurada:', successUrl);
      const response = await firstValueFrom(
        this.paymentService.createCheckoutSession(cantidad, successUrl, cancelUrl)
      );
      
      window.location.href = response.url;
    } catch (error: any) {
      console.error('Error:', error);
      this.toast.error(error.message || 'Error al iniciar el pago');
      this.recargando = false;
    }
  }

  volver() {
    this.router.navigateByUrl(this.returnUrl);
  }
}