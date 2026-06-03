import { Component, OnInit, OnDestroy, NgZone } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { SignalrService } from '../services/signalr.service';
import { ToastService } from '../services/toast.service';
import { NavbarComponent } from '../shared/navbar/navbar.component';

@Component({
  selector: 'app-lobby',
  standalone: true,
  imports: [CommonModule, FormsModule, NavbarComponent],
  templateUrl: './lobby.component.html',
  styleUrls: ['./lobby.component.scss']
})
export class LobbyComponent implements OnInit, OnDestroy {
  onlineUsers: string[] = [];
  friendList: string[] = [];
  pendingRequests: string[] = [];
  mesasDisponibles: any[] = [];

  nombreMesa: string = '';
  juegoSeleccionado: string = 'Ruleta';
  esPrivada: boolean = false;
  passwordCreacion: string = '';

  newFriendUsername: string = '';

  mesaPassword: string = '';
  showPasswordModal: boolean = false;
  mesaSeleccionadaParaUnirse: any = null;

  currentUserEmail: string = '';
  procesando: boolean = false;

  constructor(
    private signalrService: SignalrService,
    private toast: ToastService,
    private router: Router,
    private zone: NgZone
  ) {
    const userStr = localStorage.getItem('usuario') || localStorage.getItem('user_cache');
    if (userStr) {
      try {
        const parsed = JSON.parse(userStr);
        this.currentUserEmail = parsed.email || '';
      } catch (e) {}
    }
  }

  async ngOnInit() {
    this.signalrService.on('RoomsList', (rooms: any[]) => {
      this.zone.run(() => { this.mesasDisponibles = rooms; });
    });

    this.signalrService.on('OnlineUsers', (users: string[]) => {
      this.zone.run(() => { this.onlineUsers = users; });
    });

    this.signalrService.on('FriendRequestReceived', (fromUser: string) => {
      this.zone.run(() => {
        this.toast.info(`Nueva solicitud de amistad de ${fromUser}`);
        if (!this.pendingRequests.includes(fromUser)) {
          this.pendingRequests.push(fromUser);
        }
      });
    });

    this.signalrService.on('FriendList', (friends: string[]) => {
      this.zone.run(() => { this.friendList = friends; });
    });

    this.signalrService.on('PendingRequests', (requests: string[]) => {
      this.zone.run(() => { this.pendingRequests = requests; });
    });

    await this.signalrService.startConnection('/hubs/lobby');

    setTimeout(async () => {
      await this.signalrService.invoke('GetFriendList');
      await this.signalrService.invoke('GetPendingRequests');
    }, 500);
  }

  ngOnDestroy() {
    this.signalrService.off('RoomsList');
    this.signalrService.off('OnlineUsers');
    this.signalrService.off('FriendRequestReceived');
    this.signalrService.off('FriendList');
    this.signalrService.off('PendingRequests');
  }

  async crearMesa() {
    if (!this.nombreMesa) {
      this.toast.warning('Introduce un nombre para la mesa.');
      return;
    }
    if (this.esPrivada && !this.passwordCreacion) {
      this.toast.warning('Introduce una contraseña para hacerla privada.');
      return;
    }

    this.procesando = true;
    try {
      const room = await this.signalrService.invoke('CreateRoom', this.nombreMesa, this.juegoSeleccionado, this.esPrivada, this.passwordCreacion || '');

      this.zone.run(() => {
        this.toast.success(`Sala "${room.nombre || room.Nombre}" creada.`);
        localStorage.setItem('mesasActivas', JSON.stringify([room]));
        this.procesando = false;

        this.nombreMesa = '';
        this.esPrivada = false;
        this.passwordCreacion = '';

        this.router.navigate(['/sala', room.id || room.Id]);
      });
    } catch (err: any) {
      this.zone.run(() => {
        let errorMsg = err?.message || 'Error al crear la mesa.';
        if (errorMsg.includes('HubException:')) {
          errorMsg = errorMsg.split('HubException:')[1].trim();
        }
        this.toast.error(errorMsg);
        this.procesando = false;
      });
    }
  }

  async unirseAMesa(mesa: any) {
    if (mesa.esPrivada) {
      this.mesaSeleccionadaParaUnirse = mesa;
      this.mesaPassword = '';
      this.showPasswordModal = true;
    } else {
      this.procesando = true;
      try {
        const room = await this.signalrService.invoke('JoinRoom', mesa.id || mesa.Id, '');
        this.zone.run(() => {
          localStorage.setItem('mesasActivas', JSON.stringify([room]));
          this.procesando = false;
          this.router.navigate(['/sala', room.id || room.Id]);
        });
      } catch (err: any) {
        this.zone.run(() => {
          let errorMsg = err?.message || 'Error al unirse a la mesa.';
          if (errorMsg.includes('HubException:')) {
            errorMsg = errorMsg.split('HubException:')[1].trim();
          }
          this.toast.error(errorMsg);
          this.procesando = false;
        });
      }
    }
  }

  cancelarUnirse() {
    this.showPasswordModal = false;
    this.mesaSeleccionadaParaUnirse = null;
    this.mesaPassword = '';
    this.procesando = false;
  }

  async joinWithPassword() {
    if (!this.mesaPassword) {
      this.toast.warning('Introduce la contraseña para entrar.');
      return;
    }

    this.procesando = true;
    try {
      const room = await this.signalrService.invoke('JoinRoom', this.mesaSeleccionadaParaUnirse.id || this.mesaSeleccionadaParaUnirse.Id, this.mesaPassword);
      this.zone.run(() => {
        this.showPasswordModal = false;
        this.mesaPassword = '';
        localStorage.setItem('mesasActivas', JSON.stringify([room]));
        this.procesando = false;
        this.router.navigate(['/sala', room.id || room.Id]);
      });
    } catch (err: any) {
      this.zone.run(() => {
        let errorMsg = err?.message || 'Contraseña incorrecta o mesa llena.';
        if (errorMsg.includes('HubException:')) {
          errorMsg = errorMsg.split('HubException:')[1].trim();
        }
        this.toast.error(errorMsg);
        this.procesando = false;
      });
    }
  }

  async sendFriendRequest() {
    if (this.newFriendUsername) {
      await this.signalrService.invoke('SendFriendRequest', this.newFriendUsername);
      this.toast.success(`Solicitud enviada a ${this.newFriendUsername}`);
      this.newFriendUsername = '';
    }
  }

  async acceptRequest(user: string) { await this.signalrService.invoke('AcceptFriendRequest', user); }
  async rejectRequest(user: string) { await this.signalrService.invoke('RejectFriendRequest', user); }
  async salirDeMesa(mesa: any) { await this.signalrService.invoke('LeaveRoom', mesa.id || mesa.Id); }
  async invitarAmigo(amigo: string, mesa: any) { await this.signalrService.invoke('InviteFriend', amigo, mesa.id || mesa.Id); }

  estaEnMesa(mesa: any): boolean { return mesa.jugadores?.includes(this.getCurrentUser()); }
  esCreador(mesa: any): boolean { return mesa.creador === this.getCurrentUser() || mesa.creadorId === this.currentUserEmail; }
  isOnline(user: string): boolean { return this.onlineUsers.includes(user); }
  puedeUnirse(mesa: any): boolean { return (mesa.jugadores || []).length < (mesa.maxJugadores || 8); }

  private getCurrentUser(): string {
    const userStr = localStorage.getItem('usuario') || localStorage.getItem('user_cache');
    if (userStr) {
      try {
        const parsed = JSON.parse(userStr);
        return parsed.nombreUsuario || parsed.nombre || parsed.email || '';
      } catch (e) {}
    }
    return '';
  }
}