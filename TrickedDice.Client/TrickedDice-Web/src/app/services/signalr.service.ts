import { Injectable, inject } from '@angular/core';
import * as signalR from '@microsoft/signalr';
import { AuthService } from '../auth.service';
import { environment } from '../../environments/environment';

@Injectable({ providedIn: 'root' })
export class SignalrService {
  private authService = inject(AuthService);
  private hubConnection: signalR.HubConnection | null = null;
  private signalRBase = environment.apiUrl.replace('/api', '');
  private currentHubUrl: string = '';
  private eventCallbacks: { event: string, callback: (...args: any[]) => void }[] = [];

  public async startConnection(hubUrl: string): Promise<boolean> {
    if (this.hubConnection?.state === signalR.HubConnectionState.Connected && this.currentHubUrl === hubUrl) {
      return true;
    }

    if (this.hubConnection) {
      await this.stopConnection();
    }

    this.currentHubUrl = hubUrl;
    const url = `${this.signalRBase}${hubUrl}`;

    this.hubConnection = new signalR.HubConnectionBuilder()
      .withUrl(url, {
        accessTokenFactory: () => this.authService.getToken() || '',
        skipNegotiation: true,
        transport: signalR.HttpTransportType.WebSockets
      })
      .withAutomaticReconnect()
      .build();

    this.eventCallbacks.forEach(ec => {
      this.hubConnection!.on(ec.event, ec.callback);
    });

    try {
      await this.hubConnection.start();
      console.log(`Conectado a: ${hubUrl}`);
      return true;
    } catch (err) {
      console.error(`Error conectando a ${hubUrl}:`, err);
      return false;
    }
  }

  public isConnected(): boolean {
    return this.hubConnection?.state === signalR.HubConnectionState.Connected;
  }

  public on(event: string, callback: (...args: any[]) => void) {
    const exists = this.eventCallbacks.find(ec => ec.event === event && ec.callback === callback);
    if (!exists) {
      this.eventCallbacks.push({ event, callback });
    }

    if (this.hubConnection) {
      this.hubConnection.on(event, callback);
    }
  }

  public off(event: string) {
    this.eventCallbacks = this.eventCallbacks.filter(ec => ec.event !== event);

    if (this.hubConnection) {
      this.hubConnection.off(event);
    }
  }

  public async invoke(method: string, ...args: any[]) {
    if (this.isConnected()) {
      try {
        return await this.hubConnection!.invoke(method, ...args);
      } catch (err) {
        console.error(`Error en invoke ${method}:`, err);
        throw err;
      }
    } else {
      console.error(`Intento de invocar ${method} sin conexión`);
    }
  }

  public async stopConnection() {
    try {
      if (this.hubConnection) {
        await this.hubConnection.stop();
        this.hubConnection = null;
        this.currentHubUrl = '';
      }
    } catch (err) {
      console.error("Error al cerrar conexión:", err);
    }
  }
}