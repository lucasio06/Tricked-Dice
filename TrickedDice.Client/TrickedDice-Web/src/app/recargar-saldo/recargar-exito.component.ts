import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { AuthService } from '../auth.service';
import { PaymentService } from '../services/payment.service';
import { ToastService } from '../services/toast.service';
import { NavbarComponent } from '../shared/navbar/navbar.component';
import { RUTAS } from '../utils/rutas.const';

@Component({
  selector: 'app-recargar-exito',
  standalone: true,
  imports: [CommonModule, NavbarComponent],
  template: `
    <app-navbar></app-navbar>
    <div class="exito-container">
      <div *ngIf="cargando" class="exito-card">
        <h1>Procesando...</h1>
        <p>Estamos confirmando tu pago. Por favor, espera un momento.</p>
        <div class="spinner"></div>
      </div>

      <div *ngIf="!cargando && !mensajeError" class="exito-card">
        <h1>¡Pago exitoso!</h1>
        <p>Tu saldo ha sido actualizado correctamente.</p>
        <p *ngIf="nuevoSaldo !== null">Nuevo saldo: <strong>{{ nuevoSaldo | number:'1.2-2' }} €</strong></p>
        <button class="btn-volver" (click)="volver()">Volver al inicio</button>
      </div>

      <div *ngIf="!cargando && mensajeError" class="exito-card error">
        <h1>{{ tituloError }}</h1>
        <p>{{ mensajeError }}</p>
        <p *ngIf="mostrarAyuda" class="ayuda-texto">Si crees que esto es un error, contacta con soporte.</p>
        <button class="btn-volver" (click)="volver()">Volver al inicio</button>
      </div>
    </div>
  `,
  styles: [`
    .exito-container {
      min-height: 100vh;
      display: flex;
      justify-content: center;
      align-items: center;
      background: linear-gradient(135deg, #0f051d 0%, #1a0b2e 50%, #090411 100%);
      font-family: 'Montserrat', sans-serif;
      padding: 120px 20px 60px;
    }
    .exito-card {
      background: #1a1125;
      border: 2px solid #d4af37;
      border-radius: 30px;
      padding: 40px;
      text-align: center;
      color: white;
      max-width: 500px;
      width: 100%;
      box-shadow: 0 0 50px rgba(212, 175, 55, 0.3);
    }
    .exito-card.error {
      border-color: #e74c3c;
    }
    .exito-card h1 {
      margin-bottom: 20px;
    }
    .exito-card .btn-volver {
      background: linear-gradient(to bottom, #d4af37, #b8942e);
      border: none;
      padding: 12px 30px;
      border-radius: 40px;
      font-weight: bold;
      font-size: 1rem;
      cursor: pointer;
      margin-top: 20px;
      color: #130921;
      transition: all 0.3s ease;
    }
    .exito-card .btn-volver:hover {
      transform: scale(1.02);
      box-shadow: 0 0 20px rgba(212, 175, 55, 0.6);
    }
    .spinner {
      width: 40px;
      height: 40px;
      margin: 20px auto;
      border: 4px solid rgba(212, 175, 55, 0.3);
      border-top: 4px solid #d4af37;
      border-radius: 50%;
      animation: spin 1s linear infinite;
    }
    .ayuda-texto {
      font-size: 0.8rem;
      color: #888;
      margin-top: 15px;
    }
    @keyframes spin {
      0% { transform: rotate(0deg); }
      100% { transform: rotate(360deg); }
    }
  `]
})
export class RecargarExitoComponent implements OnInit {
  cargando = true;
  nuevoSaldo: number | null = null;
  mensajeError: string = '';
  tituloError: string = '';
  mostrarAyuda: boolean = false;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private authService: AuthService,
    private paymentService: PaymentService,
    private toast: ToastService
  ) {}

  async ngOnInit() {
    console.log('=== RecargarExitoComponent iniciado ===');
    
    const sessionId = this.route.snapshot.queryParams['session_id'];
    console.log('Session ID desde URL:', sessionId);
    
    if (!sessionId) {
      this.mostrarError(
        'No se encontró información del pago',
        'Información faltante',
        true
      );
      this.toast.error('No se encontró información del pago');
      this.cargando = false;
      return;
    }

    try {
      console.log('Llamando a confirmarPagoPorSession...');
      const result = await firstValueFrom(this.paymentService.confirmarPagoPorSession(sessionId));
      console.log('Respuesta del servidor:', result);
      
      if (result.success) {
        this.nuevoSaldo = result.saldoActualizado;
        this.authService.actualizarSaldo(result.saldoActualizado);
        this.toast.success(`¡Recarga completada! Nuevo saldo: ${result.saldoActualizado.toFixed(2)} €`);
        this.cargando = false;
      } else {
        this.mostrarError(
          result.message || 'El pago no fue exitoso',
          'Pago no completado',
          true
        );
        this.toast.error(result.message || 'El pago no fue exitoso');
        this.cargando = false;
      }
    } catch (error: any) {
      console.error('Error en la llamada:', error);
      
      if (error.status === 409) {
        this.mostrarError(
          'Esta recarga ya ha sido procesada anteriormente. Tu saldo no se verá afectado.',
          'Recarga duplicada',
          false
        );
        this.toast.warning('Esta recarga ya ha sido procesada anteriormente');
      } else if (error.status === 400) {
        this.mostrarError(
          'El pago no fue exitoso. Por favor, inténtalo de nuevo.',
          'Pago no completado',
          true
        );
        this.toast.error('El pago no fue exitoso');
      } else if (error.status === 401) {
        this.mostrarError(
          'Tu sesión ha expirado. Por favor, inicia sesión nuevamente.',
          'Sesión expirada',
          true
        );
        this.toast.error('Sesión expirada. Inicia sesión nuevamente.');
      } else {
        this.mostrarError(
          'Ocurrió un error inesperado. Por favor, intenta de nuevo más tarde.',
          'Error inesperado',
          true
        );
        this.toast.error('Error al procesar la recarga');
      }
      
      this.cargando = false;
    }
  }

  private mostrarError(mensaje: string, titulo: string, mostrarAyuda: boolean = false) {
    this.mensajeError = mensaje;
    this.tituloError = titulo;
    this.mostrarAyuda = mostrarAyuda;
  }

  volver() {
    this.router.navigate([RUTAS.home]);
  }
}