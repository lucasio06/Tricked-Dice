import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ToastService } from '../../services/toast.service';

@Component({
  selector: 'app-toast',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './toast.component.html',
  styles: [`
    .toast-container {
      position: fixed;
      top: 20px;
      right: 20px;
      z-index: 99999;
      display: flex;
      flex-direction: column;
      gap: 12px;
      pointer-events: none;
    }
    .toast {
      pointer-events: auto;
      min-width: 320px;
      max-width: 500px;
      background: linear-gradient(145deg, #1a1125 0%, #0d0516 100%);
      border: 1px solid #cca45a;
      border-radius: 8px;
      padding: 16px 20px;
      display: flex;
      align-items: center;
      gap: 12px;
      box-shadow: 0 10px 30px rgba(0,0,0,0.7), 0 0 20px rgba(167, 66, 245, 0.3);
      backdrop-filter: blur(10px);
      color: #f0d8a8;
      font-family: 'Montserrat', sans-serif;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      position: relative;
      overflow: hidden;
      cursor: pointer;
      transition: all 0.3s ease;
      animation: slideIn 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
    }
    .toast:hover {
      transform: translateX(-5px);
      border-color: #e0c070;
      box-shadow: 0 0 25px #a742f5;
    }
    .icon-img {
      width: 24px;
      height: 24px;
      object-fit: contain;
      filter: drop-shadow(0 0 5px currentColor);
    }

    .icon {
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 24px;
      min-width: 24px;
    }
    .message {
      flex: 1;
      font-size: 0.9rem;
    }
    .success .icon { color: #39FF14; text-shadow: 0 0 8px #39FF14; }
    .error .icon { color: #ff3366; text-shadow: 0 0 8px #ff3366; }
    .warning .icon { color: #e0c070; text-shadow: 0 0 8px #e0c070; }
    .info .icon { color: #a742f5; text-shadow: 0 0 8px #a742f5; }
    .win .icon { color: #39FF14; text-shadow: 0 0 8px #39FF14; }
    .lose .icon { color: #ff3366; text-shadow: 0 0 8px #ff3366; }
    .progress-bar {
      position: absolute;
      bottom: 0;
      left: 0;
      height: 3px;
      background: #cca45a;
      width: 100%;
      animation: shrink linear forwards;
    }
    @keyframes slideIn {
      from { opacity: 0; transform: translateX(50px); }
      to { opacity: 1; transform: translateX(0); }
    }
    @keyframes shrink {
      from { width: 100%; }
      to { width: 0%; }
    }
  `]
})
export class ToastComponent {
  toastService = inject(ToastService);
}