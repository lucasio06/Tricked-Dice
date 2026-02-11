import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './app.html',
  styleUrl: './app.scss'
})
export class App implements OnInit {
  juegos: string[] = [];

  constructor(private http: HttpClient) {}

  ngOnInit() {
    // URL corregida a HTTP y puerto 5069
    this.http.get<string[]>('http://localhost:5069/api/juegos')
      .subscribe({
        next: (res) => {
          console.log('¡Conexión exitosa!', res);
          this.juegos = res;
        },
        error: (err) => {
          console.error('Error de conexión detallado:', err);
        }
      });
  }
}