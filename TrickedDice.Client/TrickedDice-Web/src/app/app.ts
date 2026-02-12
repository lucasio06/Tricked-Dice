import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterOutlet } from '@angular/router'; // 1. Añadimos RouterOutlet

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, RouterOutlet], // 2. Importante para que el HTML reconozca <router-outlet>
  templateUrl: './app.html',
  styleUrl: './app.scss'
})
export class App implements OnInit {
  isLoggedIn = false; // Esta es la que necesita el HTML
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
    }
  }

  logout() {
    localStorage.clear();
    this.isLoggedIn = false;
    this.usuarioData = null;
    this.router.navigate(['/']);
  }
}