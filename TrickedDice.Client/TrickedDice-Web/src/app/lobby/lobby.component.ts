import { Component, OnInit, OnDestroy } from '@angular/core';
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
  currentUser: string = '';

  showPasswordModal: boolean = false;
  selectedMesaId: string = '';
  mesaPassword: string = '';

  constructor(
    private signalrService: SignalrService,
    private toast: ToastService,
    public router: Router
  ) {}

  async ngOnInit(): Promise<void> {
    await this.signalrService.startConnection('/hubs/lobby');

    this.signalrService.on('OnlineUsers', (users: string[]) => {
      this.onlineUsers = users;
    });

    this.signalrService.on('FriendList', (friends: string[]) => {
      this.friendList = friends;
    });

    this.signalrService.on('PendingRequests', (requests: string[]) => {
      this.pendingRequests = requests;
    });

    this.signalrService.on('FriendRequestReceived', (sender: string) => {
      this.toast.info(`${sender} te ha enviado una solicitud de amistad`);
      this.signalrService.invoke('GetPendingRequests');
    });

    this.signalrService.on('FriendAdded', (friend: string) => {
      this.toast.success(`${friend} ahora es tu amigo`);
      this.signalrService.invoke('GetFriendList');
      this.signalrService.invoke('GetOnlineUsers');
    });

    this.signalrService.on('RoomsList', (rooms: any[]) => {
      this.mesasDisponibles = rooms.map(r => ({
        id: r.id,
        nombre: r.name,
        juego: r.gameType,
        creador: r.creator,
        jugadores: r.players,
        maxJugadores: r.maxPlayers,
        esPrivada: r.isPrivate,
        contrasena: r.password
      }));
    });

    this.signalrService.on('RoomCreated', (room: any) => {
      this.toast.success(`Sala ${room.name} creada`);
      this.router.navigate([`/sala/${room.id}`]);
    });

    this.signalrService.on('RoomJoined', (room: any) => {
      this.toast.success(`Te has unido a ${room.name}`);
      this.router.navigate([`/sala/${room.id}`]);
    });

    this.signalrService.on('Error', (msg: string) => {
      this.toast.error(msg);
      if (msg.toLowerCase().includes('password')) {
        this.showPasswordModal = true;
      }
    });

    await this.signalrService.invoke('GetOnlineUsers');
    await this.signalrService.invoke('GetFriendList');
    await this.signalrService.invoke('GetPendingRequests');

    this.obtenerUsuarioActual();
  }

  ngOnDestroy(): void {
    this.signalrService.stopConnection();
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
    await this.signalrService.invoke('CreateRoom', this.nombreMesa, this.juegoSeleccionado, this.esPrivada, null);
    this.nombreMesa = '';
    this.esPrivada = false;
  }

  async unirseAMesa(mesaId: string, juego: string): Promise<void> {
    const mesa = this.mesasDisponibles.find(m => m.id === mesaId);
    if (!mesa) return;
    if (mesa.esPrivada) {
      this.selectedMesaId = mesaId;
      this.showPasswordModal = true;
    } else {
      await this.signalrService.invoke('JoinRoom', mesaId);
    }
  }

  async joinWithPassword(): Promise<void> {
    await this.signalrService.invoke('JoinRoom', this.selectedMesaId, this.mesaPassword);
    this.showPasswordModal = false;
    this.mesaPassword = '';
    this.selectedMesaId = '';
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

  isOnline(username: string): boolean {
    return this.onlineUsers.includes(username);
  }

  isFriend(username: string): boolean {
    return this.friendList.includes(username);
  }

  puedeUnirse(mesa: MesaActiva): boolean {
    return !mesa.jugadores.includes(this.currentUser) && mesa.jugadores.length < mesa.maxJugadores;
  }

  esCreador(mesa: MesaActiva): boolean {
    return mesa.creador === this.currentUser;
  }

  estaEnMesa(mesa: MesaActiva): boolean {
    return mesa.jugadores.includes(this.currentUser);
  }
}