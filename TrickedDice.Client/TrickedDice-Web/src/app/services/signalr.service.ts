import { Injectable, inject } from '@angular/core';
import * as signalR from '@microsoft/signalr';
import { AuthService } from '../auth.service';
import { environment } from '../../environments/environment';

@Injectable({ providedIn: 'root' })
export class SignalrService {
  private authService = inject(AuthService);
  public hubConnection: signalR.HubConnection | null = null;
  private signalRBase = environment.apiUrl.replace('/api', '');
  private connectionPromise: Promise<boolean> | null = null;
  private currentHubUrl: string = '';

  public async startConnection(hubUrl: string): Promise<boolean> {
    if (this.hubConnection?.state === signalR.HubConnectionState.Connected) {
      if (this.currentHubUrl === hubUrl) {
        return true;
      }
    }
    
    if (this.connectionPromise) {
      return this.connectionPromise;
    }
    
    this.currentHubUrl = hubUrl;
    this.connectionPromise = this.doStartConnection(hubUrl);
    const result = await this.connectionPromise;
    this.connectionPromise = null;
    return result;
  }

  private async doStartConnection(hubUrl: string): Promise<boolean> {
    const fullUrl = `${this.signalRBase}${hubUrl}`;
    const token = this.authService.getToken();
    if (!token) return false;
    
    if (this.hubConnection) {
      try { await this.hubConnection.stop(); } catch (e) {}
    }
    
    this.hubConnection = new signalR.HubConnectionBuilder()
      .withUrl(fullUrl, {
        accessTokenFactory: () => this.authService.getToken() || '',
        transport: signalR.HttpTransportType.WebSockets | signalR.HttpTransportType.LongPolling
      })
      .withAutomaticReconnect([0, 2000, 5000, 10000, 30000])
      .build();

    this.hubConnection.onreconnecting(() => console.log('SignalR reconectando...'));
    this.hubConnection.onreconnected(() => console.log('SignalR reconectado'));
    this.hubConnection.onclose((error) => console.log('SignalR cerrado', error));

    try {
      await this.hubConnection.start();
      console.log(`Conectado a ${fullUrl}`);
      return true;
    } catch (err) {
      console.error(`Error al conectar a ${fullUrl}:`, err);
      return false;
    }
  }

  public on(event: string, callback: (...args: any[]) => void) {
    if (this.hubConnection) {
      this.hubConnection.on(event, callback);
    }
  }

  public off(event: string, callback: (...args: any[]) => void) {
    if (this.hubConnection) {
      this.hubConnection.off(event, callback);
    }
  }

  public async invoke(method: string, ...args: any[]): Promise<any> {
    if (this.hubConnection?.state === signalR.HubConnectionState.Connected) {
      return this.hubConnection.invoke(method, ...args);
    }
    throw new Error(`Conexión SignalR no lista para invocar: ${method}`);
  }

  public async stopConnection(): Promise<void> {
    if (this.hubConnection) {
      await this.hubConnection.stop();
      this.hubConnection = null;
    }
    this.connectionPromise = null;
    this.currentHubUrl = '';
  }
}