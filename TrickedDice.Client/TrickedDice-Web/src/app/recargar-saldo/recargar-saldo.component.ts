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
import { loadStripe, Stripe } from '@stripe/stripe-js';

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
  private stripe: Stripe | null = null;
  private publishableKey = 'pk_test_51TZUCNDY2gI1lh3UUkOQkVdpiZirL6c98GVct9MlwkgzJDxjrJKHDYSvYpnd7iZxiDPy49GU7p0SemRX2pljcaAR00QWhxSy0v';
  private currentUser: any = null;
  private cardElement: any = null;

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
        this.currentUser = usuario;
      }
    });
    this.stripe = await loadStripe(this.publishableKey);
    
    if (this.stripe) {
      const elements = this.stripe.elements();
      const style = {
        base: {
          color: '#f0d8a8',
          fontFamily: 'Montserrat, sans-serif',
          fontSmoothing: 'antialiased',
          fontSize: '16px',
          '::placeholder': {
            color: '#6c5b7b'
          }
        },
        invalid: {
          color: '#e74c3c',
          iconColor: '#e74c3c'
        }
      };
      this.cardElement = elements.create('card', { style: style });
      this.cardElement.mount('#card-element');
    }
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
      const response = await firstValueFrom(this.paymentService.createPaymentIntent(cantidad));
      const clientSecret = response.clientSecret;

      if (!this.stripe || !clientSecret || !this.cardElement) {
        throw new Error('No se pudo inicializar Stripe');
      }

      const result = await this.stripe.confirmCardPayment(clientSecret, {
        payment_method: {
          card: this.cardElement,
          billing_details: {
            name: this.currentUser?.nombre || 'Usuario Stripe',
            email: this.currentUser?.email || 'cliente@ejemplo.com'
          }
        }
      });

      if (result.error) {
        console.error('Stripe error:', result.error);
        this.toast.error(result.error.message || 'Error en el pago');
        this.recargando = false;
        return;
      }

      if (result.paymentIntent.status === 'succeeded') {
        const confirmResult = await firstValueFrom(this.paymentService.confirmPayment(result.paymentIntent.id));
        if (confirmResult) {
          this.authService.actualizarSaldo(confirmResult.saldoActualizado);
          this.toast.success(`¡Recarga exitosa! Nuevo saldo: ${confirmResult.saldoActualizado.toFixed(2)} €`);
          this.router.navigateByUrl(this.returnUrl);
        }
      }
    } catch (error: any) {
      console.error('Error en recarga:', error);
      this.toast.error(error.message || 'Error al procesar el pago');
    } finally {
      this.recargando = false;
    }
  }

  volver() {
    this.router.navigateByUrl(this.returnUrl);
  }
}