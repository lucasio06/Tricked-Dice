import { Component, OnInit, OnDestroy } from '@angular/core';
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

  constructor(
    private signalrService: SignalrService,
    private toast: ToastService,
    private router: Router
  ) {
    const userStr = localStorage.getItem('usuario') || localStorage.getItem('user_cache');
    if (userStr) {
       const u = JSON.parse(userStr);
       this.currentUserEmail = u.email || '';
    }
  }

  async ngOnInit(): Promise<void> {
    await this.signalrService.startConnection('/hubs/lobby');

    this.signalrService.on("ForceLogout", (emailBaneado: string) => {
      if (this.currentUserEmail.toLowerCase() === emailBaneado.toLowerCase()) {
        localStorage.clear();
        this.router.navigate(['/']);
        this.toast.error("HAS SIDO BANEADO DEL SERVIDOR.");
      }
    });

    this.signalrService.on('OnlineUsers', (users: string[]) => {
      this.onlineUsers = [...users];
    });

    this.signalrService.on('FriendList', (friends: string[]) => {
      this.friendList = friends;
    });

    this.signalrService.on('PendingRequests', (requests: string[]) => {
      this.pendingRequests = requests;
    });
    
    this.signalrService.on('FriendRequestReceived', (requester: string) => {
      this.signalrService.invoke('GetPendingRequests');
      this.toast.info(`Nueva solicitud de amistad de ${requester}`);
    });

    this.signalrService.on('FriendAdded', (amigo: string) => {
      this.signalrService.invoke('GetFriendList');
      this.toast.success(`${amigo} añadido a amigos`);
    });

    this.signalrService.on('RoomsList', (rooms: any[]) => {
      this.mesasDisponibles = rooms.map(r => ({
        id: r.id || r.Id || r.ID,
        nombre: r.nombre || r.Nombre || r.name,
        gameType: r.juego || r.Juego || r.gameType,
        creador: r.creador || r.Creador || r.creator,
        jugadores: r.jugadores || r.Jugadores || r.players || [],
        maxJugadores: r.maxJugadores || r.MaxJugadores || 8,
        esPrivada: r.esPrivada ?? r.EsPrivada ?? r.isPrivate ?? false
      }));
    });

    this.signalrService.on('RoomJoined', (room: any) => {
      localStorage.setItem('mesasActivas', JSON.stringify([room]));
      this.router.navigate(['/sala', room.id || room.Id]);
    });

    this.signalrService.on('RoomCreated', (room: any) => {
      const roomName = room.nombre || room.Nombre;
      const roomId = room.id || room.Id || room.ID;
      this.toast.success(`Sala "${roomName}" creada.`);
      localStorage.setItem('mesasActivas', JSON.stringify([room]));
      this.router.navigate(['/sala', roomId]);
    });

    await this.signalrService.invoke('GetOnlineUsers');
    await this.signalrService.invoke('GetFriendList');
    await this.signalrService.invoke('GetPendingRequests');
  }

  ngOnDestroy(): void {
    this.signalrService.off("ForceLogout");
    this.signalrService.off("OnlineUsers");
    this.signalrService.off("FriendList");
    this.signalrService.off("PendingRequests");
    this.signalrService.off("FriendRequestReceived");
    this.signalrService.off("FriendAdded");
    this.signalrService.off("RoomsList");
    this.signalrService.off("RoomJoined");
    this.signalrService.off("RoomCreated");
  }

  async crearMesa() {
    if (!this.nombreMesa) return;
    const pwd = this.esPrivada ? this.passwordCreacion : '';
    await this.signalrService.invoke('CreateRoom', this.nombreMesa, this.juegoSeleccionado, this.esPrivada, pwd);
  }

  async unirseAMesa(mesa: any) {
    if (mesa.esPrivada) {
      this.mesaSeleccionadaParaUnirse = mesa;
      this.showPasswordModal = true;
    } else {
      await this.signalrService.invoke('JoinRoom', mesa.id, '');
    }
  }

  async joinWithPassword() {
    if (this.mesaSeleccionadaParaUnirse) {
      await this.signalrService.invoke('JoinRoom', this.mesaSeleccionadaParaUnirse.id, this.mesaPassword);
      this.cancelPasswordModal();
    }
  }

  cancelPasswordModal() {
    this.showPasswordModal = false;
    this.mesaPassword = '';
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
  async salirDeMesa(mesa: any) { await this.signalrService.invoke('LeaveRoom', mesa.id); }
  async invitarAmigo(amigo: string, mesa: any) { await this.signalrService.invoke('InviteFriend', amigo, mesa.id); }

  estaEnMesa(mesa: any): boolean { return mesa.jugadores?.includes(this.getCurrentUser()); }
  esCreador(mesa: any): boolean { return mesa.creador === this.getCurrentUser(); }
  isOnline(user: string): boolean { return this.onlineUsers.includes(user); }
  puedeUnirse(mesa: any): boolean { return (mesa.jugadores || []).length < mesa.maxJugadores; }

  private getCurrentUser(): string {
    const user = localStorage.getItem('usuario');
    if (user) {
      const parsed = JSON.parse(user);
      return parsed.nombreUsuario || parsed.nombre || '';
    }
    const cached = localStorage.getItem('user_cache');
    if (cached) {
      const parsedCached = JSON.parse(cached);
      return parsedCached.nombre || '';
    }
    return '';
  }
}