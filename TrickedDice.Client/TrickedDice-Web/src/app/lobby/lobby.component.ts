import { Component, OnInit } from '@angular/core';
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
export class LobbyComponent implements OnInit {
  onlineUsers: string[] = [];
  friendList: string[] = [];
  pendingRequests: string[] = [];
  mesasDisponibles: any[] = [];
  
  nombreMesa: string = '';
  juegoSeleccionado: string = 'Ruleta';
  esPrivada: boolean = false;
  newFriendUsername: string = '';
  mesaPassword: string = '';
  showPasswordModal: boolean = false;
  mesaSeleccionadaParaUnirse: any = null;

  constructor(
    private signalrService: SignalrService,
    private toast: ToastService,
    private router: Router
  ) {}

 async ngOnInit(): Promise<void> {
  await this.signalrService.startConnection('/hubs/lobby');

  this.signalrService.on('OnlineUsers', (users: string[]) => {
    console.log('📡 OnlineUsers actualizado:', users);
    this.onlineUsers = [...users];
  });
  this.signalrService.on('FriendList', (friends: string[]) => {
    console.log('📡 FriendList:', friends);
    this.friendList = friends;
  });
  this.signalrService.on('PendingRequests', (requests: string[]) => {
    console.log('📡 PendingRequests:', requests);
    this.pendingRequests = requests;
  });
  this.signalrService.on('RoomsList', (rooms: any[]) => {
    console.log('📡 RoomsList:', rooms);
    this.mesasDisponibles = rooms.map(r => ({
      id: r.id,
      nombre: r.nombre,
      gameType: r.juego,
      creador: r.creador,
      jugadores: r.jugadores || [],
      maxJugadores: r.maxJugadores,
      esPrivada: r.esPrivada
    }));
  });

  this.signalrService.on('RoomJoined', (room: any) => {
    console.log('📡 RoomJoined:', room);
    localStorage.setItem('mesasActivas', JSON.stringify([room]));
    this.router.navigate(['/sala', room.id]);
  });

  this.signalrService.on('RoomCreated', (room: any) => {
    console.log('📡 RoomCreated:', room);
    this.toast.success(`Sala "${room.nombre}" creada. Redirigiendo...`);
    localStorage.setItem('mesasActivas', JSON.stringify([room]));
    this.router.navigate(['/sala', room.id]);
  });

  await this.signalrService.invoke('GetOnlineUsers');
  await this.signalrService.invoke('GetFriendList');
  await this.signalrService.invoke('GetPendingRequests');
}

  async crearMesa() {
    if (!this.nombreMesa) return;
    console.log('Creando mesa:', this.nombreMesa);
    await this.signalrService.invoke('CreateRoom', this.nombreMesa, this.juegoSeleccionado, this.esPrivada, '');
  }

  async unirseAMesa(mesa: any) {
    console.log('Unirse a mesa:', mesa.id);
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
    console.log('Enviando solicitud a:', this.newFriendUsername);
    await this.signalrService.invoke('SendFriendRequest', this.newFriendUsername);
    this.newFriendUsername = '';
  }

  async acceptRequest(user: string) { await this.signalrService.invoke('AcceptFriendRequest', user); }
  async rejectRequest(user: string) { await this.signalrService.invoke('RejectFriendRequest', user); }
  async salirDeMesa(mesa: any) { await this.signalrService.invoke('LeaveRoom', mesa.id); }
  async invitarAmigo(amigo: string, mesa: any) { await this.signalrService.invoke('InviteFriend', amigo, mesa.id); }

  estaEnMesa(mesa: any): boolean { return mesa.jugadores?.includes(this.getCurrentUser()); }
  esCreador(mesa: any): boolean { return mesa.creador === this.getCurrentUser(); }
  isOnline(user: string): boolean { return this.onlineUsers.includes(user); }
  
  puedeUnirse(mesa: any): boolean { 
    return (mesa.jugadores || []).length < mesa.maxJugadores; 
  }

  private getCurrentUser(): string {
    const user = localStorage.getItem('usuario');
    return user ? JSON.parse(user).nombreUsuario : '';
  }
}