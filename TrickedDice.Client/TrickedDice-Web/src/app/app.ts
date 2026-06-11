import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterOutlet } from '@angular/router';
import { ToastComponent } from './shared/toast/toast.component';
import { GlitchDirective } from './directives/glitch.directive';
import { AuthService } from './auth.service';
import { FooterComponent } from './shared/footer/footer.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, RouterOutlet, ToastComponent, GlitchDirective, FooterComponent],
  templateUrl: './app.html',
  styleUrl: './app.scss'
})
export class App {
  private authService = inject(AuthService);
  
  isLoggedIn = false;
  usuarioData: any = null;

  constructor() {
    this.authService.usuario$.subscribe(usuario => {
      this.usuarioData = usuario;
      this.isLoggedIn = !!usuario;
    });
  }
}