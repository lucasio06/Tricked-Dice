import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { SignalrService } from '../services/signalr.service';
import { ToastService } from '../services/toast.service';
import { NavbarComponent } from '../shared/navbar/navbar.component';
import { RUTAS } from '../utils/rutas.const';

interface Room {
  id: string;
  name: string;
  gameType: string;
  creator: string;
  players: string[];
  maxPlayers: number;
  isPrivate: boolean;
  password?: string;
  status: string;
}

@Component({
  selector: 'app-room',
  standalone: true,
  imports: [CommonModule, FormsModule, NavbarComponent],
  templateUrl: './room.component.html',
  styleUrls: ['./room.component.scss']
})
export class RoomComponent implements OnInit, OnDestroy {
  room: Room | null = null;
  roomId: string = '';
  currentUser: string = '';
  isCreator: boolean = false;
  passwordInput: string = '';
  showPasswordModal: boolean = false;

  constructor(
    private signalrService: SignalrService,
    private toast: ToastService,
    private route: ActivatedRoute,
    private router: Router
  ) {}

  async ngOnInit(): Promise<void> {
    this.roomId = this.route.snapshot.paramMap.get('id') || '';
    if (!this.roomId) {
      this.router.navigate([RUTAS.lobby]);
      return;
    }

    await this.signalrService.startConnection('/hubs/lobby');
    this.obtenerUsuarioActual();

    this.signalrService.on('RoomUpdated', (room: Room) => {
      if (room.id === this.roomId) {
        this.room = room;
        this.isCreator = room.creator === this.currentUser;
      }
    });

    this.signalrService.on('RoomJoined', (room: Room) => {
      if (room.id === this.roomId) {
        this.room = room;
        this.isCreator = room.creator === this.currentUser;
        this.toast.success(`Te has unido a ${room.name}`);
      }
    });

    this.signalrService.on('GameStarted', (gameType: string, roomId: string) => {
      if (roomId === this.roomId) {
        this.toast.success(`La partida ha comenzado. Redirigiendo...`);
        this.irAJuego(gameType, roomId);
      }
    });

    this.signalrService.on('Error', (msg: string) => {
      this.toast.error(msg);
      if (msg.toLowerCase().includes('password')) {
        this.showPasswordModal = true;
      }
    });

    await this.signalrService.invoke('JoinRoom', this.roomId);
  }

  ngOnDestroy(): void {
    if (this.roomId) {
      this.signalrService.invoke('LeaveRoom', this.roomId);
    }
  }

  obtenerUsuarioActual(): void {
    const usuario = localStorage.getItem('usuario') ? JSON.parse(localStorage.getItem('usuario')!) : null;
    this.currentUser = usuario?.nombreUsuario || usuario?.nombre || 'Usuario';
  }

  async salirDeSala(): Promise<void> {
    await this.signalrService.invoke('LeaveRoom', this.roomId);
    this.router.navigate([RUTAS.lobby]);
  }

  async togglePrivacy(): Promise<void> {
    if (!this.isCreator) return;
    await this.signalrService.invoke('ToggleRoomPrivacy', this.roomId);
  }

  async iniciarJuego(): Promise<void> {
    if (!this.isCreator) return;
    if (!this.room || this.room.players.length < 2) {
      this.toast.warning('Necesitas al menos 2 jugadores para empezar');
      return;
    }
    await this.signalrService.invoke('StartGame', this.roomId);
  }

  irAJuego(gameType: string, roomId: string): void {
    switch (gameType) {
      case 'Ruleta':
        this.router.navigate([RUTAS.ruleta], { queryParams: { mesa: roomId } });
        break;
      case 'Blackjack':
        this.router.navigate([RUTAS.blackjack], { queryParams: { mesa: roomId } });
        break;
      case 'Poker':
        this.router.navigate([RUTAS.videoPoker], { queryParams: { mesa: roomId } });
        break;
      default:
        this.router.navigate([RUTAS.home]);
    }
  }

  async joinWithPassword(): Promise<void> {
    await this.signalrService.invoke('JoinRoom', this.roomId, this.passwordInput);
    this.showPasswordModal = false;
    this.passwordInput = '';
  }
}