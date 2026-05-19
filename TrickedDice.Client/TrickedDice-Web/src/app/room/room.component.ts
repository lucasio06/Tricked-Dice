import { Component, OnInit } from '@angular/core';
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
export class RoomComponent implements OnInit {
  room: Room | null = null;
  roomId: string = '';
  currentUser: string = '';
  isCreator: boolean = false;
  passwordInput: string = '';
  showPasswordModal: boolean = false;
  loading: boolean = true;
  error: string | null = null;
  rutas = RUTAS;

  constructor(
    public router: Router,
    private signalrService: SignalrService,
    private toast: ToastService,
    private route: ActivatedRoute
  ) {}

  async ngOnInit(): Promise<void> {
    this.roomId = this.route.snapshot.paramMap.get('id') || '';
    if (!this.roomId) {
      this.error = 'ID de sala no válido';
      this.loading = false;
      setTimeout(() => this.router.navigate([RUTAS.lobby]), 2000);
      return;
    }
    this.obtenerUsuarioActual();
    const conectado = await this.signalrService.startConnection('/hubs/lobby');
    if (!conectado) {
      this.error = 'No se pudo conectar al servidor';
      this.loading = false;
      this.toast.error('Error de conexión');
      setTimeout(() => this.router.navigate([RUTAS.lobby]), 2000);
      return;
    }
    this.signalrService.on('RoomUpdated', (room: Room) => {
      if (room.id === this.roomId) {
        this.room = room;
        this.isCreator = room.creator === this.currentUser;
        this.loading = false;
      }
    });
    this.signalrService.on('RoomJoined', (room: Room) => {
      if (room.id === this.roomId) {
        this.room = room;
        this.isCreator = room.creator === this.currentUser;
        this.toast.success(`Te has unido a ${room.name}`);
        this.loading = false;
      }
    });
    this.signalrService.on('GameStarted', async (gameType: string, roomId: string) => {
      if (roomId === this.roomId) {
        this.toast.success('La partida ha comenzado. Redirigiendo...');
        let hubUrl = '';
        switch (gameType) {
          case 'Ruleta': hubUrl = '/hubs/ruleta'; break;
          case 'Blackjack': hubUrl = '/hubs/blackjack'; break;
          case 'Poker': hubUrl = '/hubs/poker'; break;
          default: return;
        }
        const ok = await this.signalrService.startConnection(hubUrl);
        if (ok) {
          this.irAJuego(gameType, roomId);
        } else {
          this.toast.error('No se pudo conectar al juego');
        }
      }
    });
    this.signalrService.on('Error', (msg: string) => {
      if (msg.toLowerCase().includes('already in room')) return;
      this.toast.error(msg);
      if (msg.toLowerCase().includes('password')) {
        this.showPasswordModal = true;
        this.loading = false;
      } else if (msg.toLowerCase().includes('not found') || msg.toLowerCase().includes('no existe')) {
        this.error = 'La sala no existe o ha sido cerrada';
        this.loading = false;
        setTimeout(() => this.router.navigate([RUTAS.lobby]), 2000);
      }
    });
    try {
      await this.signalrService.invoke('JoinRoom', this.roomId);
      setTimeout(() => {
        if (this.loading) {
          this.loading = false;
          this.error = 'No se recibió respuesta de la sala. Inténtalo de nuevo.';
        }
      }, 5000);
    } catch (err) {
      this.error = 'Error al unirse a la sala';
      this.loading = false;
      this.toast.error('No se pudo unir a la sala');
      setTimeout(() => this.router.navigate([RUTAS.lobby]), 2000);
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
    const creador = this.room?.creator || '';
    switch (gameType) {
      case 'Ruleta':
        this.router.navigate([RUTAS.ruleta], { queryParams: { mesa: roomId, creador: creador } });
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
    this.loading = true;
    try {
      await this.signalrService.invoke('JoinRoom', this.roomId, this.passwordInput);
      this.showPasswordModal = false;
      this.passwordInput = '';
    } catch (err) {
      this.toast.error('Contraseña incorrecta');
      this.loading = false;
    }
  }
}