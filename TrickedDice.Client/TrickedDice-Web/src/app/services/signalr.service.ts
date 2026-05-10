import { Injectable, inject } from '@angular/core';
import * as signalR from '@microsoft/signalr';
import { AuthService } from '../auth.service';
import { environment } from '../../environments/environment';

@Injectable({ providedIn: 'root' })
export class SignalrService {
  private authService = inject(AuthService);
  private hubConnection!: signalR.HubConnection;
  private signalRBase = environment.apiUrl.replace('/api', '');

  public async startConnection(hubUrl: string) {
    const token = this.authService.getToken();
    if (!token) return;

    this.hubConnection = new signalR.HubConnectionBuilder()
      .withUrl(`${this.signalRBase}${hubUrl}`, { accessTokenFactory: () => token })
      .withAutomaticReconnect()
      .build();

    try {
      await this.hubConnection.start();
      console.log(`Conectado a ${hubUrl}`);
      return true;
    } catch (err) {
      console.error(`Error al conectar a ${hubUrl}:`, err);
      return false;
    }
  }

  public on(event: string, callback: (...args: any[]) => void) {
    this.hubConnection?.on(event, callback);
  }

  public async invoke(method: string, ...args: any[]) {
    if (this.hubConnection?.state === signalR.HubConnectionState.Connected) {
      return this.hubConnection.invoke(method, ...args);
    }
    return null;
  }

  public async stopConnection() {
    await this.hubConnection?.stop();
  }
}