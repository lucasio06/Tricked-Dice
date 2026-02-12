import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterOutlet } from '@angular/router';

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

  constructor(public router: Router) {}

  ngOnInit() {
    this.checkUser();
  }

  checkUser() {
    const user = localStorage.getItem('usuario');
    if (user) {
      this.isLoggedIn = true;
      this.usuarioData = JSON.parse(user);
    } else {
      this.isLoggedIn = false;
      this.usuarioData = null;
    }
  }

  logout() {
    localStorage.clear();
    this.isLoggedIn = false;
    this.usuarioData = null;
    window.location.href = '/'; 
  }
}