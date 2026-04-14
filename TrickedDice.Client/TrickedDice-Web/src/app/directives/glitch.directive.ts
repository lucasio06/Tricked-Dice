import { Directive, ElementRef, OnInit, OnDestroy } from '@angular/core';

@Directive({
  selector: '[appGlitch]',
  standalone: true
})
export class GlitchDirective implements OnInit, OnDestroy {
  private intervalId: any;
  private originalFilter: string = '';

  constructor(private el: ElementRef<HTMLElement>) {}

  ngOnInit() {
    this.originalFilter = this.el.nativeElement.style.filter || ''; // <-- Fallback seguro
    this.intervalId = setInterval(() => this.triggerGlitch(), 15000);
  }

  ngOnDestroy() {
    clearInterval(this.intervalId);
  }

  private triggerGlitch() {
    const element = this.el.nativeElement;
    const duration = 200;
    const startTime = Date.now();
    
    const glitchInterval = setInterval(() => {
      const elapsed = Date.now() - startTime;
      if (elapsed >= duration) {
        element.style.filter = this.originalFilter;
        clearInterval(glitchInterval);
        return;
      }
      const offsetX = (Math.random() * 8 - 4).toFixed(1);
      const offsetY = (Math.random() * 4 - 2).toFixed(1);
      const blur = Math.random() * 2;
      element.style.filter = `drop-shadow(${offsetX}px ${offsetY}px ${blur}px #a742f5) 
                              drop-shadow(${-offsetX}px ${-offsetY}px ${blur}px #e0c070)`;
    }, 30);
  }
}