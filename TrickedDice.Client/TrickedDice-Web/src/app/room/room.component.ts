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
  nombre: string;
  juego: string;
  esPrivada: boolean;
  contrasena?: string;
  creador: string;
  creadorId?: string;
  jugadores: string[];
  maxJugadores: number;
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
  private hasLeft: boolean = false;

  constructor(
    private signalrService: SignalrService,
    private toast: ToastService,
    private route: ActivatedRoute,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.route.params.subscribe(params => {
      if (params['id']) {
        this.roomId = params['id'];
        const temp = localStorage.getItem('tempRoom');
        if (temp) {
          const room = JSON.parse(temp);
          if (room.id === this.roomId) {
            this.room = this.normalizarRoom(room);
            localStorage.removeItem('tempRoom');
            this.obtenerUsuarioActual();
            this.actualizarEsCreador();
          } else {
            this.unirseASalaPorId();
          }
        } else {
          this.unirseASalaPorId();
        }
      } else {
        this.toast.error('No se pudo cargar la sala');
        this.router.navigate([RUTAS.lobby]);
      }
    });

    // ✅ Escuchar cuando alguien se une
    this.signalrService.on('PlayerJoined', (playerName: string) => {
      console.log('📡 PlayerJoined:', playerName);
      if (this.room && !this.room.jugadores.includes(playerName)) {
        this.room.jugadores.push(playerName);
        this.actualizarEsCreador();
        this.toast.info(`${playerName} se ha unido a la sala.`);
      }
    });

    this.signalrService.on('RoomUpdated', (room: any) => {
      if (room.id === this.roomId) {
        this.room = this.normalizarRoom(room);
        this.actualizarEsCreador();
      }
    });

    this.signalrService.on('RoomJoined', (room: any) => {
      if (room.id === this.roomId) {
        this.room = this.normalizarRoom(room);
        this.actualizarEsCreador();
        this.toast.success(`Te has unido a ${this.room.nombre}`);
      }
    });

    this.signalrService.on('GameStarted', (gameType: string, roomId: string) => {
      if (roomId === this.roomId) {
        if (this.room) {
          const mesasActivas = JSON.parse(localStorage.getItem('mesasActivas') || '[]');
          const mesasActualizadas = mesasActivas.filter((m: any) => m.id !== this.room!.id);
          mesasActualizadas.push(this.room);
          localStorage.setItem('mesasActivas', JSON.stringify(mesasActualizadas));
        }
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
  }

  private normalizarRoom(room: any): Room {
    return {
      id: room.id,
      nombre: room.nombre || room.name,
      juego: room.juego || room.gameType,
      esPrivada: room.esPrivada ?? room.isPrivate,
      contrasena: room.contrasena || room.password,
      creador: room.creador || room.creator,
      creadorId: room.creadorId || room.creatorId,
      jugadores: room.jugadores || room.players || [],
      maxJugadores: room.maxJugadores ?? room.maxPlayers ?? 8
    };
  }

  private actualizarEsCreador(): void {
    if (this.room && this.currentUser) {
      this.isCreator = this.normalizarString(this.room.creador) === this.normalizarString(this.currentUser);
    } else {
      this.isCreator = false;
    }
  }

  async unirseASalaPorId(): Promise<void> {
    this.obtenerUsuarioActual();
    try {
      await this.signalrService.invoke('JoinRoom', this.roomId, '');
    } catch (err) {
      console.error('Error al unirse:', err);
      this.toast.error('No se pudo unir a la sala');
      this.router.navigate([RUTAS.lobby]);
    }
  }

  ngOnDestroy(): void {
    if (this.roomId && !this.hasLeft && this.signalrService.isConnected()) {
      this.signalrService.invoke('LeaveRoom', this.roomId);
    }
  }

  obtenerUsuarioActual(): void {
    const usuario = localStorage.getItem('usuario');
    if (usuario) {
      try {
        const userObj = JSON.parse(usuario);
        this.currentUser = userObj.nombreUsuario || userObj.nombre || '';
        if (this.currentUser) return;
      } catch(e) {}
    }

    const token = localStorage.getItem('token');
    if (token) {
      try {
        const base64Url = token.split('.')[1];
        const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
        const payload = JSON.parse(decodeURIComponent(escape(atob(base64))));
        this.currentUser = payload['http://schemas.xmlsoap.org/ws/2005/05/identity/claims/name'] || payload.unique_name || payload.name || 'Usuario';
      } catch (e) {
        console.error('Error decodificando token', e);
        this.currentUser = 'Usuario';
      }
    } else {
      this.currentUser = 'Usuario';
    }
  }

  normalizarString(str: string): string {
    return str.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  }

  async salirDeSala(): Promise<void> {
    this.hasLeft = true;
    if (this.signalrService.isConnected()) {
      await this.signalrService.invoke('LeaveRoom', this.roomId);
    }
    this.router.navigate([RUTAS.lobby]);
  }

  async togglePrivacy(): Promise<void> {
    if (!this.isCreator) return;
    await this.signalrService.invoke('ToggleRoomPrivacy', this.roomId);
  }

  async iniciarJuego(): Promise<void> {
    if (!this.isCreator) return;
    if (!this.room || (this.room.jugadores || []).length < 2) {
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