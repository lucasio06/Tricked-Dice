import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterOutlet } from '@angular/router';
import { AuthService } from './auth.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, RouterOutlet],
  templateUrl: './app.html',
  styleUrl: './app.scss'
})
export class App implements OnInit {
  isLoggedIn = false;
  usuarioData: any = null;

  constructor(public router: Router, private authService: AuthService) {}

  ngOnInit() {
    this.checkUser();
  }

  checkUser() {
    this.usuarioData = this.authService.getUsuario();
    this.isLoggedIn = !!this.usuarioData;
  }

  logout() {
    this.authService.logout();
    this.isLoggedIn = false;
    this.usuarioData = null;
  }
}