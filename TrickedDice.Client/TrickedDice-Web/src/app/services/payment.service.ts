import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export interface CreatePaymentIntentResponse {
  clientSecret: string;
  paymentIntentId: string;
}

export interface ConfirmPaymentResponse {
  success: boolean;
  saldoActualizado: number;
  message: string;
}

export interface CreateCheckoutResponse {
  sessionId: string;
  url: string;
}

export interface ConfirmarPagoSessionResponse {
  success: boolean;
  saldoActualizado: number;
  message: string;
}

@Injectable({ providedIn: 'root' })
export class PaymentService {
  private apiUrl = environment.apiUrl;

  constructor(private http: HttpClient) {}

  createPaymentIntent(amount: number): Observable<CreatePaymentIntentResponse> {
    return this.http.post<CreatePaymentIntentResponse>(`${this.apiUrl}/Payment/create-payment-intent`, { amount });
  }

  confirmPayment(paymentIntentId: string): Observable<ConfirmPaymentResponse> {
    return this.http.post<ConfirmPaymentResponse>(`${this.apiUrl}/Payment/confirm-payment`, { paymentIntentId });
  }

  createCheckoutSession(amount: number, successUrl: string, cancelUrl: string): Observable<CreateCheckoutResponse> {
    return this.http.post<CreateCheckoutResponse>(`${this.apiUrl}/Payment/create-checkout-session`, { 
      amount, 
      successUrl, 
      cancelUrl 
    });
  }

  confirmarPagoPorSession(sessionId: string): Observable<ConfirmarPagoSessionResponse> {
    return this.http.post<ConfirmarPagoSessionResponse>(`${this.apiUrl}/Payment/confirmar-pago-session`, { sessionId });
  }
}