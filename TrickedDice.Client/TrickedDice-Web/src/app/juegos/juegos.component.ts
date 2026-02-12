import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';

@Component({
  selector: 'app-juegos',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './juegos.component.html'
})
export class JuegosComponent implements OnInit {
  juegos: string[] = [];

  constructor(private http: HttpClient) {}

  ngOnInit() {
    this.http.get<string[]>('http://localhost:5069/api/juegos')
      .subscribe({
        next: (res) => this.juegos = res,
        error: (err) => console.error('Error al cargar juegos:', err)
      });
  }
}