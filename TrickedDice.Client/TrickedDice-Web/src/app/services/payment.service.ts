import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

@Injectable({ providedIn: 'root' })
export class PaymentService {
  private apiUrl = environment.apiUrl;

  constructor(private http: HttpClient) {}

  createPaymentIntent(amount: number): Observable<{ clientSecret: string }> {
    return this.http.post<{ clientSecret: string }>(`${this.apiUrl}/Payment/create-payment-intent`, {
      amount: Math.round(amount * 100),
      currency: 'eur'
    });
  }

  confirmPayment(paymentIntentId: string): Observable<{ saldoActualizado: number }> {
    return this.http.post<{ saldoActualizado: number }>(`${this.apiUrl}/Payment/confirm-payment`, {
      paymentIntentId: paymentIntentId
    });
  }
}