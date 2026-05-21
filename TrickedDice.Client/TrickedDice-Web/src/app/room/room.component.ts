import { Component, OnInit, OnDestroy, NgZone, ChangeDetectorRef } from '@angular/core';
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

interface ChatMessage {
  user: string;
  text: string;
  time: Date;
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
  loading: boolean = true;
  error: string | null = null;
  rutas = RUTAS;
  
  chatMessages: ChatMessage[] = [];
  newMessage: string = '';

  private connectionTimeout: any;
  private navigatingToGame = false;

  private onRoomUpdated = (room: Room) => {
    this.ngZone.run(() => {
      if (room.id === this.roomId) {
        this.room = room;
        this.isCreator = room.creator === this.currentUser;
        this.loading = false;
        this.cdr.detectChanges();
      }
    });
  };

  private onRoomJoined = (room: Room) => {
    this.ngZone.run(() => {
      if (room.id === this.roomId) {
        this.room = room;
        this.isCreator = room.creator === this.currentUser;
        this.loading = false;
        this.toast.success(`Estás dentro de la sala: ${room.name}`);
        if (this.connectionTimeout) clearTimeout(this.connectionTimeout);
        this.cdr.detectChanges();
      }
    });
  };

  private onGameStarted = async (gameType: string, roomId: string) => {
    this.ngZone.run(() => {
      if (roomId === this.roomId) {
        this.navigatingToGame = true;
        this.toast.success('¡La partida va a comenzar!');
        this.irAJuego(gameType, roomId);
        this.cdr.detectChanges();
      }
    });
  };

  private onReceiveRoomMessage = (user: string, message: string) => {
    this.ngZone.run(() => {
      this.chatMessages.push({ user, text: message, time: new Date() });
      this.cdr.detectChanges();
      this.scrollToBottom();
    });
  };

  private onError = (msg: string) => {
    this.ngZone.run(() => {
      if (msg.toLowerCase().includes('already in room')) return;
      this.toast.error(msg);
      if (msg.toLowerCase().includes('contraseña') || msg.toLowerCase().includes('password')) {
        this.showPasswordModal = true;
        this.loading = false;
        if (this.connectionTimeout) clearTimeout(this.connectionTimeout);
      } else {
        this.error = msg;
        this.loading = false;
        if (this.connectionTimeout) clearTimeout(this.connectionTimeout);
      }
      this.cdr.detectChanges();
    });
  };

  constructor(
    public router: Router,
    private signalrService: SignalrService,
    private toast: ToastService,
    private route: ActivatedRoute,
    private ngZone: NgZone,
    private cdr: ChangeDetectorRef
  ) {}

  async ngOnInit(): Promise<void> {
    this.roomId = this.route.snapshot.paramMap.get('id') || '';
    if (!this.roomId) {
      this.error = 'ID de sala no válido';
      this.loading = false;
      return;
    }
    
    this.obtenerUsuarioActual();
    
    const conectado = await this.signalrService.startConnection('/hubs/lobby');
    if (!conectado) {
      this.error = 'No se pudo conectar al servidor de salas';
      this.loading = false;
      return;
    }
    
    this.signalrService.on('RoomUpdated', this.onRoomUpdated);
    this.signalrService.on('RoomJoined', this.onRoomJoined);
    this.signalrService.on('GameStarted', this.onGameStarted);
    this.signalrService.on('ReceiveRoomMessage', this.onReceiveRoomMessage);
    this.signalrService.on('Error', this.onError);
    
    try {
      await this.signalrService.invoke('JoinRoom', this.roomId, "");
      this.connectionTimeout = setTimeout(() => {
        this.ngZone.run(() => {
          if (this.loading) {
            this.loading = false;
            this.error = 'El servidor está tardando en responder.';
            this.cdr.detectChanges();
          }
        });
      }, 60000); 
    } catch (err) {
      this.error = `Error al intentar unirse a la sala.`;
      this.loading = false;
      this.cdr.detectChanges();
    }
  }

  ngOnDestroy(): void {
    if (this.connectionTimeout) clearTimeout(this.connectionTimeout);
    
    this.signalrService.off('RoomUpdated', this.onRoomUpdated);
    this.signalrService.off('RoomJoined', this.onRoomJoined);
    this.signalrService.off('GameStarted', this.onGameStarted);
    this.signalrService.off('ReceiveRoomMessage', this.onReceiveRoomMessage);
    this.signalrService.off('Error', this.onError);

    if (!this.navigatingToGame && this.roomId) {
       this.signalrService.invoke('LeaveRoom', this.roomId).catch(() => {});
    }
  }

  obtenerUsuarioActual(): void {
    const usuario = localStorage.getItem('usuario') ? JSON.parse(localStorage.getItem('usuario')!) : null;
    this.currentUser = usuario?.nombreUsuario || usuario?.nombre || 'Usuario';
  }

  sendMessage() {
    if (!this.newMessage.trim()) return;
    this.signalrService.invoke('SendRoomMessage', this.roomId, this.newMessage.trim()).catch(()=>{});
    this.newMessage = '';
  }

  scrollToBottom() {
    setTimeout(() => {
      const chatBox = document.getElementById('chatMessagesBox');
      if (chatBox) chatBox.scrollTop = chatBox.scrollHeight;
    }, 100);
  }

  async salirDeSala(): Promise<void> {
    await this.signalrService.invoke('LeaveRoom', this.roomId);
    this.router.navigate([RUTAS.lobby]);
  }

  async togglePrivacy(): Promise<void> {
    if (!this.isCreator) return;
    const pwd = this.room?.isPrivate ? '' : prompt("Introduce la nueva contraseña de la sala:");
    if (pwd !== null) {
      await this.signalrService.invoke('ToggleRoomPrivacy', this.roomId, pwd);
    }
  }

  async iniciarJuego(): Promise<void> {
    if (!this.isCreator || !this.room) return;
    await this.signalrService.invoke('StartGame', this.roomId);
  }

  irAJuego(gameType: string, roomId: string): void {
    const creador = this.room?.creator || '';
    switch (gameType) {
      case 'Ruleta': this.router.navigate([RUTAS.ruleta], { queryParams: { mesa: roomId, creador: creador } }); break;
      case 'Blackjack': this.router.navigate([RUTAS.blackjack], { queryParams: { mesa: roomId, creador: creador } }); break;
      case 'Poker': this.router.navigate([RUTAS.videoPoker], { queryParams: { mesa: roomId, creador: creador } }); break;
      default: this.router.navigate([RUTAS.home]);
    }
  }

  async joinWithPassword(): Promise<void> {
    this.loading = true;
    try {
      await this.signalrService.invoke('JoinRoom', this.roomId, this.passwordInput || "");
      this.showPasswordModal = false;
      this.passwordInput = '';
    } catch (err) {
      this.toast.error('Ocurrió un error al verificar la contraseña');
      this.loading = false;
      this.cdr.detectChanges();
    }
  }
}