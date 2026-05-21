import { Component, OnInit, OnDestroy, NgZone, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { NavbarComponent } from '../shared/navbar/navbar.component';
import { SignalrService } from '../services/signalr.service';
import { ToastService } from '../services/toast.service';
import { RUTAS } from '../utils/rutas.const';

interface MesaActiva {
  id: string;
  nombre: string;
  juego: string;
  creador: string;
  jugadores: string[];
  maxJugadores: number;
  esPrivada: boolean;
  contrasena?: string;
}

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
  newFriendUsername: string = '';
  mesasDisponibles: MesaActiva[] = [];
  juegoSeleccionado: string = 'Ruleta';
  nombreMesa: string = '';
  esPrivada: boolean = false;
  crearMesaPassword: string = '';
  currentUser: string = '';
  showPasswordModal: boolean = false;
  selectedMesaId: string = '';
  mesaPassword: string = '';

  private onOnlineUsers = (users: string[]) => { 
    this.ngZone.run(() => { this.onlineUsers = users; this.cdr.detectChanges(); });
  };
  private onFriendList = (friends: string[]) => { 
    this.ngZone.run(() => { this.friendList = friends; this.cdr.detectChanges(); });
  };
  private onPendingRequests = (requests: string[]) => { 
    this.ngZone.run(() => { this.pendingRequests = requests; this.cdr.detectChanges(); });
  };
  private onFriendRequestReceived = (sender: string) => {
    this.ngZone.run(() => {
      this.toast.info(`${sender} te ha enviado una solicitud de amistad`);
      this.signalrService.invoke('GetPendingRequests');
    });
  };
  private onFriendAdded = (friend: string) => {
    this.ngZone.run(() => {
      this.toast.success(`${friend} ahora es tu amigo`);
      this.signalrService.invoke('GetFriendList');
      this.signalrService.invoke('GetOnlineUsers');
    });
  };
  private onRoomsList = (rooms: any[]) => {
    this.ngZone.run(() => {
      this.mesasDisponibles = rooms.map(r => ({
        id: r.id, nombre: r.name, juego: r.gameType, creador: r.creator, jugadores: r.players,
        maxJugadores: r.maxPlayers, esPrivada: r.isPrivate, contrasena: r.password
      }));
      this.cdr.detectChanges();
    });
  };
  private onRoomCreated = (room: any) => {
    this.ngZone.run(() => {
      this.toast.success(`Sala ${room.name} creada`);
      this.router.navigate([`/sala/${room.id}`]);
    });
  };
  private onRoomJoined = (room: any) => {
    this.ngZone.run(() => {
      this.toast.success(`Te has unido a ${room.name}`);
      this.router.navigate([`/sala/${room.id}`]);
    });
  };
  private onError = (msg: string) => {
    this.ngZone.run(() => {
      if (msg.toLowerCase().includes('already in room')) return;
      this.toast.error(msg);
      if (msg.toLowerCase().includes('password') || msg.toLowerCase().includes('contraseña')) {
        this.showPasswordModal = true;
      }
      this.cdr.detectChanges();
    });
  };

  constructor(
    private signalrService: SignalrService,
    private toast: ToastService,
    public router: Router,
    private ngZone: NgZone,
    private cdr: ChangeDetectorRef
  ) {}

  async ngOnInit(): Promise<void> {
    await this.signalrService.startConnection('/hubs/lobby');
    this.signalrService.on('OnlineUsers', this.onOnlineUsers);
    this.signalrService.on('FriendList', this.onFriendList);
    this.signalrService.on('PendingRequests', this.onPendingRequests);
    this.signalrService.on('FriendRequestReceived', this.onFriendRequestReceived);
    this.signalrService.on('FriendAdded', this.onFriendAdded);
    this.signalrService.on('RoomsList', this.onRoomsList);
    this.signalrService.on('RoomCreated', this.onRoomCreated);
    this.signalrService.on('RoomJoined', this.onRoomJoined);
    this.signalrService.on('Error', this.onError);
    await this.signalrService.invoke('GetOnlineUsers');
    await this.signalrService.invoke('GetFriendList');
    await this.signalrService.invoke('GetPendingRequests');
    await this.signalrService.invoke('GetRooms');
    this.obtenerUsuarioActual();
  }

  ngOnDestroy(): void {
    this.signalrService.off('OnlineUsers', this.onOnlineUsers);
    this.signalrService.off('FriendList', this.onFriendList);
    this.signalrService.off('PendingRequests', this.onPendingRequests);
    this.signalrService.off('FriendRequestReceived', this.onFriendRequestReceived);
    this.signalrService.off('FriendAdded', this.onFriendAdded);
    this.signalrService.off('RoomsList', this.onRoomsList);
    this.signalrService.off('RoomCreated', this.onRoomCreated);
    this.signalrService.off('RoomJoined', this.onRoomJoined);
    this.signalrService.off('Error', this.onError);
  }

  obtenerUsuarioActual(): void {
    const usuario = localStorage.getItem('usuario') ? JSON.parse(localStorage.getItem('usuario')!) : null;
    this.currentUser = usuario?.nombreUsuario || usuario?.nombre || 'Usuario';
  }

  async crearMesa(): Promise<void> {
    if (!this.nombreMesa.trim()) {
      this.toast.warning('Debes poner un nombre a la mesa');
      return;
    }
    if (this.esPrivada && !this.crearMesaPassword.trim()) {
      this.toast.warning('Debes introducir una contraseña para crear la sala privada');
      return;
    }
    try {
      await this.signalrService.invoke('CreateRoom', this.nombreMesa, this.juegoSeleccionado, this.esPrivada, this.crearMesaPassword.trim());
      this.nombreMesa = '';
      this.esPrivada = false;
      this.crearMesaPassword = '';
    } catch (err) {
      this.toast.error('No se pudo crear la sala');
    }
  }

  async unirseAMesa(mesaId: string, juego: string): Promise<void> {
    const mesa = this.mesasDisponibles.find(m => m.id === mesaId);
    if (!mesa) return;
    if (this.estaEnMesa(mesa)) {
      this.router.navigate([`/sala/${mesa.id}`]);
      return;
    }
    if (mesa.esPrivada) {
      this.selectedMesaId = mesaId;
      this.showPasswordModal = true;
    } else {
      try {
        await this.signalrService.invoke('JoinRoom', mesaId, "");
      } catch (err) {}
    }
  }

  async joinWithPassword(): Promise<void> {
    try {
      await this.signalrService.invoke('JoinRoom', this.selectedMesaId, this.mesaPassword || "");
      this.showPasswordModal = false;
      this.mesaPassword = '';
      this.selectedMesaId = '';
    } catch (err) {}
  }

  cancelPasswordModal(): void {
    this.showPasswordModal = false;
    this.mesaPassword = '';
    this.selectedMesaId = '';
  }

  async salirDeMesa(mesa: MesaActiva): Promise<void> {
    await this.signalrService.invoke('LeaveRoom', mesa.id);
    this.toast.info(`Has salido de la mesa ${mesa.nombre}`);
  }

  async invitarAmigo(amigo: string, mesa: MesaActiva): Promise<void> {
    await this.signalrService.invoke('InviteToTable', amigo, mesa.id, mesa.juego);
    this.toast.success(`Invitación enviada a ${amigo}`);
  }

  async sendFriendRequest(): Promise<void> {
    if (!this.newFriendUsername.trim()) return;
    await this.signalrService.invoke('SendFriendRequest', this.newFriendUsername.trim());
    this.toast.success(`Solicitud enviada a ${this.newFriendUsername.trim()}`);
    this.newFriendUsername = '';
  }

  async acceptRequest(sender: string): Promise<void> {
    await this.signalrService.invoke('AcceptFriendRequest', sender);
  }

  async rejectRequest(sender: string): Promise<void> {
    await this.signalrService.invoke('RejectFriendRequest', sender);
    this.signalrService.invoke('GetPendingRequests');
  }

  isOnline(username: string): boolean { return this.onlineUsers.includes(username); }
  isFriend(username: string): boolean { return this.friendList.includes(username); }
  puedeUnirse(mesa: MesaActiva): boolean { return !mesa.jugadores.includes(this.currentUser) && mesa.jugadores.length < mesa.maxJugadores; }
  esCreador(mesa: MesaActiva): boolean { return mesa.creador === this.currentUser; }
  estaEnMesa(mesa: MesaActiva): boolean { return mesa.jugadores.includes(this.currentUser); }
}