import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { NavbarComponent } from '../shared/navbar/navbar.component';
import { SignalrService } from '../services/signalr.service';
import { ToastService } from '../services/toast.service';
import { RUTAS } from '../utils/rutas.const';

@Component({
  selector: 'app-lobby',
  standalone: true,
  imports: [CommonModule, FormsModule, NavbarComponent],
  templateUrl: './lobby.component.html',
  styleUrls: ['./lobby.component.css']
})
export class LobbyComponent implements OnInit, OnDestroy {
  onlineUsers: string[] = [];
  friendList: string[] = [];
  pendingRequests: string[] = [];
  newFriendUsername: string = '';

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

    this.signalrService.on('TableInvitation', (friend: string, tableId: string, gameType: string) => {
      this.toast.info(`${friend} te invita a ${gameType}`);
    });

    await this.signalrService.invoke('GetOnlineUsers');
    await this.signalrService.invoke('GetFriendList');
    await this.signalrService.invoke('GetPendingRequests');
  }

  ngOnDestroy(): void {
    this.signalrService.stopConnection();
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
}