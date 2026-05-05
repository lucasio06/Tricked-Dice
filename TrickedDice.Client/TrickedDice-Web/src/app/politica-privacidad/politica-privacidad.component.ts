import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NavbarComponent } from '../shared/navbar/navbar.component';
import { FooterComponent } from '../shared/footer/footer.component';

@Component({
  selector: 'app-politica-privacidad',
  standalone: true,
  imports: [CommonModule, NavbarComponent, FooterComponent],
  templateUrl: './politica-privacidad.component.html',
  styleUrls: ['./politica-privacidad.component.css']
})
export class PoliticaPrivacidadComponent {}