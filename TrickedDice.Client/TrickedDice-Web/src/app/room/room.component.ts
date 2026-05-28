import { Component, OnInit, OnDestroy, NgZone } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { SignalrService } from '../services/signalr.service';
import { ToastService } from '../services/toast.service';
import { NavbarComponent } from '../shared/navbar/navbar.component';
import { RUTAS } from '../utils/rutas.const';
import { BlackjackComponent } from '../blackjack/blackjack.component';

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
  imports: [CommonModule, FormsModule, NavbarComponent, BlackjackComponent],
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
  gameStarted: boolean = false;
  private hasLeft: boolean = false;

  mensajes: {usuario: string, texto: string}[] = [];
  nuevoMensaje: string = '';

  constructor(
    private signalrService: SignalrService,
    private toast: ToastService,
    private route: ActivatedRoute,
    private router: Router,
    private zone: NgZone
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

    this.signalrService.on('PlayerJoined', (playerName: string) => {
      this.zone.run(() => {
        if (this.room && !this.room.jugadores.includes(playerName)) {
          this.room.jugadores.push(playerName);
          this.actualizarEsCreador();
          this.toast.info(`${playerName} se ha unido a la sala.`);
        }
      });
    });

    this.signalrService.on('PlayerLeft', (playerName: string) => {
      this.zone.run(() => {
        if (this.room) {
          this.room.jugadores = this.room.jugadores.filter(j => j.trim().toLowerCase() !== playerName.trim().toLowerCase());
          this.toast.info(`🏃 ${playerName} ha abandonado la sala.`);
          this.actualizarEsCreador();
        }
      });
    });

    this.signalrService.on('RoomUpdated', (room: any) => {
      this.zone.run(() => {
        const parsedId = room.id || room.Id || room.ID;
        if (parsedId === this.roomId) {
          this.room = this.normalizarRoom(room);
          this.actualizarEsCreador();
        }
      });
    });

    this.signalrService.on('RoomJoined', (room: any) => {
      this.zone.run(() => {
        const parsedId = room.id || room.Id || room.ID;
        if (parsedId === this.roomId) {
          this.room = this.normalizarRoom(room);
          this.actualizarEsCreador();
          this.toast.success(`Te has unido a ${this.room.nombre}`);
        }
      });
    });

    this.signalrService.on('RoomPrivacyToggled', (esPrivada: boolean) => {
      this.zone.run(() => {
        if (this.room) {
          this.room.esPrivada = esPrivada;
          this.toast.info(esPrivada ? 'La sala ahora es Privada 🔒' : 'La sala ahora es Pública 🌐');
        }
      });
    });

    this.signalrService.on('GameStarted', (gameType: string, roomId: string) => {
      this.zone.run(() => {
        if (roomId === this.roomId) {
          if (this.room) {
            const mesasActivas = JSON.parse(localStorage.getItem('mesasActivas') || '[]');
            const mesasActualizadas = mesasActivas.filter((m: any) => m.id !== this.room!.id);
            mesasActualizadas.push(this.room);
            localStorage.setItem('mesasActivas', JSON.stringify(mesasActualizadas));
          }
          this.toast.success(`La partida ha comenzado.`);
          this.irAJuego(gameType, roomId);
        }
      });
    });

    this.signalrService.on('ReceiveMessage', (usuario: string, texto: string) => {
      this.zone.run(() => {
        this.mensajes.push({ usuario, texto });
      });
    });

    this.signalrService.on('Error', (msg: string) => {
      this.zone.run(() => {
        this.toast.error(msg);
        if (msg.toLowerCase().includes('password') || msg.toLowerCase().includes('contrase')) {
          this.showPasswordModal = true;
        }
      });
    });
  }

  async enviarMensaje() {
    const msg = this.nuevoMensaje.trim();
    if (!msg) return;

    this.nuevoMensaje = '';
    try {
      await this.signalrService.invoke('SendMessage', this.roomId, msg);
    } catch (e) {
      this.toast.error('Error al enviar el mensaje');
    }
  }

  private normalizarRoom(room: any): Room {
    return {
      id: room.id || room.Id || room.ID,
      nombre: room.nombre || room.Nombre || room.name,
      juego: room.juego || room.Juego || room.gameType,
      esPrivada: room.esPrivada ?? room.EsPrivada ?? room.isPrivate ?? false,
      contrasena: room.contrasena || room.Contrasena || room.password,
      creador: room.creador || room.Creador || room.creator,
      creadorId: room.creadorId || room.CreadorId || room.creatorId,
      jugadores: room.jugadores || room.Jugadores || room.players || [],
      maxJugadores: room.maxJugadores ?? room.MaxJugadores ?? room.maxPlayers ?? 8
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
    if (gameType === 'Blackjack') {
      this.gameStarted = true;
    } else {
      switch (gameType) {
        case 'Ruleta':
          this.router.navigate([RUTAS.ruleta], { queryParams: { mesa: roomId } });
          break;
        case 'Poker':
          this.router.navigate([RUTAS.videoPoker], { queryParams: { mesa: roomId } });
          break;
        default:
          this.router.navigate([RUTAS.home]);
      }
    }
  }

  async joinWithPassword(): Promise<void> {
    await this.signalrService.invoke('JoinRoom', this.roomId, this.passwordInput);
    this.showPasswordModal = false;
    this.passwordInput = '';
  }
}