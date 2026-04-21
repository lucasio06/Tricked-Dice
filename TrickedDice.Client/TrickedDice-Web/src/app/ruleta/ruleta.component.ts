import { Component, OnInit, ViewChild, ElementRef, AfterViewInit, OnDestroy, NgZone } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { AuthService, UsuarioPerfil } from '../auth.service';
import { ToastService } from '../services/toast.service';

interface HistorialTirada {
  numero: number;
  color: string;
}

@Component({
  selector: 'app-ruleta',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './ruleta.component.html',
  styleUrls: ['./ruleta.component.scss']
})
export class RuletaComponent implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('ruletaCanvas', { static: false }) canvasRef!: ElementRef<HTMLCanvasElement>;
  private ctx!: CanvasRenderingContext2D;
  
  saldo: number = 0;
  montoApuesta: number = 10;
  tipoApuesta: string = 'numero';
  valorApuesta: string = '';
  mensajeResultado: string = '';
  girando: boolean = false;
  numeroGanador: number | null = null;
  
  mostrarModalGanador: boolean = false;
  numeroModal: number = 0;
  colorModal: string = '';
  
  valorApuestaSeisena: string = '1-6';
  valorApuestaCuadro: string = '0,1,2,3';
  valorApuestaCalle: string = '1,2,3';
  valorApuestaCaballo: string = '0,1';
  valorApuestaFinal: string = '0';
  
  // Historial de tiradas (máximo 10)
  historialTiradas: HistorialTirada[] = [];
  
  private animFrame: number | null = null;
  private anguloActual: number = 0;
  private readonly numeroSectores: number = 37;
  private readonly anguloPorSector: number = (Math.PI * 2) / this.numeroSectores;
  private readonly duracionAnimacion: number = 3000;
  
  private coloresSectores: string[] = [];
  private numerosRuleta: number[] = [
    0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11, 30, 8, 23, 10, 5,
    24, 16, 33, 1, 20, 14, 31, 9, 22, 18, 29, 7, 28, 12, 35, 3, 26
  ];

  numeros = Array.from({ length: 37 }, (_, i) => i);
  colores = ['rojo', 'negro'];
  paridades = ['par', 'impar'];
  mitades = ['1-18', '19-36'];
  docenas = ['1ª Docena (1-12)', '2ª Docena (13-24)', '3ª Docena (25-36)'];
  columnas = ['1ª Columna', '2ª Columna', '3ª Columna'];
  finales = ['0','1','2','3','4','5','6','7','8','9'];
  
  seisenas: string[] = [];
  cuadros: string[] = [];
  calles: string[] = [];
  caballos: string[] = [];

  private usuarioSub: Subscription | null = null;

  constructor(
    private http: HttpClient,
    private authService: AuthService,
    private toast: ToastService,
    private router: Router,
    private ngZone: NgZone
  ) {
    this.inicializarColores();
    this.generarApuestasMultiples();
  }

  ngOnInit(): void {
    this.usuarioSub = this.authService.usuario$.subscribe(usuario => {
      if (usuario) {
        this.saldo = usuario.saldo;
      }
    });
    // Cargar historial inicial (vacío por ahora)
    this.cargarHistorial();
  }

  ngAfterViewInit(): void {
    this.ctx = this.canvasRef.nativeElement.getContext('2d')!;
    this.anguloActual = this.calcularAnguloParaSector(0);
    this.dibujarRuleta(this.anguloActual);
  }

  ngOnDestroy(): void {
    this.usuarioSub?.unsubscribe();
    if (this.animFrame) cancelAnimationFrame(this.animFrame);
  }

  private inicializarColores(): void {
    this.coloresSectores = this.numerosRuleta.map(num => {
      if (num === 0) return '#2ecc71';
      const rojos = [1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36];
      return rojos.includes(num) ? '#e74c3c' : '#2c3e50';
    });
  }

  private generarApuestasMultiples(): void {
    for (let i = 1; i <= 31; i += 3) {
      this.seisenas.push(`${i}-${i+5}`);
    }
    this.cuadros = ['0,1,2,3', '1,2,4,5', '2,3,5,6', '4,5,7,8', '5,6,8,9', '7,8,10,11', '8,9,11,12',
      '10,11,13,14', '11,12,14,15', '13,14,16,17', '14,15,17,18', '16,17,19,20', '17,18,20,21',
      '19,20,22,23', '20,21,23,24', '22,23,25,26', '23,24,26,27', '25,26,28,29', '26,27,29,30',
      '28,29,31,32', '29,30,32,33', '31,32,34,35', '32,33,35,36'];
    for (let i = 1; i <= 34; i += 3) {
      this.calles.push(`${i},${i+1},${i+2}`);
    }
    this.caballos = ['0,1', '0,2', '0,3', '1,2', '2,3', '4,5', '5,6', '7,8', '8,9', '10,11', '11,12',
      '13,14', '14,15', '16,17', '17,18', '19,20', '20,21', '22,23', '23,24', '25,26', '26,27',
      '28,29', '29,30', '31,32', '32,33', '34,35', '35,36',
      '1,4', '2,5', '3,6', '4,7', '5,8', '6,9', '7,10', '8,11', '9,12', '10,13', '11,14', '12,15',
      '13,16', '14,17', '15,18', '16,19', '17,20', '18,21', '19,22', '20,23', '21,24', '22,25',
      '23,26', '24,27', '25,28', '26,29', '27,30', '28,31', '29,32', '30,33', '31,34', '32,35', '33,36'];
    this.valorApuestaSeisena = this.seisenas[0];
    this.valorApuestaCuadro = this.cuadros[0];
    this.valorApuestaCalle = this.calles[0];
    this.valorApuestaCaballo = this.caballos[0];
  }

  private cargarHistorial(): void {
    // Inicialmente vacío. Podría cargarse del backend en el futuro.
    this.historialTiradas = [];
  }

  private calcularAnguloParaSector(indice: number): number {
    const anguloCentral = indice * this.anguloPorSector + this.anguloPorSector / 2;
    return -Math.PI / 2 - anguloCentral;
  }

  private dibujarRuleta(anguloOffset: number = 0): void {
    const canvas = this.canvasRef.nativeElement;
    const ctx = this.ctx;
    const width = canvas.width;
    const height = canvas.height;
    const centroX = width / 2;
    const centroY = height / 2;
    const radio = Math.min(width, height) * 0.45;
    
    ctx.clearRect(0, 0, width, height);
    
    ctx.shadowColor = '#a742f5';
    ctx.shadowBlur = 20;
    ctx.beginPath();
    ctx.arc(centroX, centroY, radio + 5, 0, Math.PI * 2);
    ctx.fillStyle = '#1a1125';
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = '#d4af37';
    ctx.lineWidth = 4;
    ctx.stroke();
    
    for (let i = 0; i < this.numeroSectores; i++) {
      const anguloInicio = i * this.anguloPorSector + anguloOffset;
      const anguloFin = anguloInicio + this.anguloPorSector;
      
      ctx.beginPath();
      ctx.moveTo(centroX, centroY);
      ctx.arc(centroX, centroY, radio, anguloInicio, anguloFin);
      ctx.closePath();
      
      ctx.fillStyle = this.coloresSectores[i];
      ctx.fill();
      ctx.strokeStyle = '#d4af37';
      ctx.lineWidth = 1;
      ctx.stroke();
      
      ctx.save();
      ctx.translate(centroX, centroY);
      ctx.rotate(anguloInicio + this.anguloPorSector / 2);
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.font = 'bold 14px Montserrat';
      ctx.fillStyle = '#ffffff';
      ctx.shadowColor = '#000';
      ctx.shadowBlur = 4;
      ctx.fillText(this.numerosRuleta[i].toString(), radio * 0.75, 0);
      ctx.restore();
    }
    
    ctx.beginPath();
    ctx.arc(centroX, centroY, radio * 0.15, 0, Math.PI * 2);
    ctx.fillStyle = '#1a1125';
    ctx.fill();
    ctx.strokeStyle = '#d4af37';
    ctx.lineWidth = 3;
    ctx.stroke();
    
    ctx.fillStyle = '#d4af37';
    ctx.shadowColor = '#a742f5';
    ctx.shadowBlur = 10;
    ctx.beginPath();
    ctx.moveTo(centroX - 12, 10);
    ctx.lineTo(centroX + 12, 10);
    ctx.lineTo(centroX, 30);
    ctx.closePath();
    ctx.fill();
    ctx.shadowBlur = 0;
  }

  seleccionarNumero(num: string): void {
    this.tipoApuesta = 'numero';
    this.valorApuesta = num;
  }
  seleccionarColor(color: string): void {
    this.tipoApuesta = 'color';
    this.valorApuesta = color;
  }
  seleccionarParidad(par: string): void {
    this.tipoApuesta = 'paridad';
    this.valorApuesta = par;
  }
  seleccionarMitad(mitad: string): void {
    this.tipoApuesta = 'mitad';
    this.valorApuesta = mitad;
  }
  seleccionarDocena(doc: string): void {
    this.tipoApuesta = 'docena';
    this.valorApuesta = doc; 
  }
  seleccionarColumna(col: string): void {
    this.tipoApuesta = 'columna';
    this.valorApuesta = col; 
  }
  seleccionarSeisena(seis: string): void {
    this.tipoApuesta = 'seisena';
    this.valorApuesta = seis;
  }
  seleccionarCuadro(cuadro: string): void {
    this.tipoApuesta = 'cuadro';
    this.valorApuesta = cuadro;
  }
  seleccionarCalle(calle: string): void {
    this.tipoApuesta = 'calle';
    this.valorApuesta = calle;
  }
  seleccionarCaballo(caballo: string): void {
    this.tipoApuesta = 'caballo';
    this.valorApuesta = caballo;
  }
  seleccionarAvanzada(tipo: string): void {
    this.tipoApuesta = tipo;
    this.valorApuesta = ''; 
  }
  seleccionarFinales(final: string): void {
    this.tipoApuesta = 'finales';
    this.valorApuesta = final;
  }
  
  esRojo(num: number): boolean {
    if (num === 0) return false;
    const rojos = [1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36];
    return rojos.includes(num);
  }

  apuestaValida(): boolean {
    if (this.montoApuesta <= 0 || this.montoApuesta > this.saldo) return false;
    if (this.tipoApuesta === 'numero' || this.tipoApuesta === 'docena' || this.tipoApuesta === 'columna' ||
        this.tipoApuesta === 'seisena' || this.tipoApuesta === 'cuadro' || this.tipoApuesta === 'calle' ||
        this.tipoApuesta === 'caballo' || this.tipoApuesta === 'finales') {
      return !!this.valorApuesta;
    }
    return true; 
  }

  apostar(): void {
    if (!this.apuestaValida()) {
      this.toast.warning('Selecciona una apuesta válida y un monto correcto.');
      return;
    }

    this.girando = true;
    this.mensajeResultado = '';
    this.numeroGanador = null;
    
    const body: any = {
      monto: this.montoApuesta,
      tipoApuesta: this.tipoApuesta,
      valorApuesta: this.valorApuesta
    };

    this.http.post<any>('http://localhost:5069/api/ruleta/girar', body)
      .subscribe({
        next: (res) => {
          // Guardamos el resultado pero NO lo mostramos aún
          const numeroFinal = res.numeroGanador;
          const gano = res.gano;
          const premio = res.premio;
          
          this.saldo = res.saldoActualizado;
          this.authService.actualizarSaldo(res.saldoActualizado);
          
          // Iniciar animación pasando los datos
          this.iniciarAnimacion(numeroFinal, gano, premio);
        },
        error: (err) => {
          this.girando = false;
          this.toast.error(err.error?.mensaje || 'Error en la apuesta');
        }
      });
  }

  private iniciarAnimacion(numeroFinal: number, gano: boolean, premio: number): void {
    const indiceGanador = this.numerosRuleta.indexOf(numeroFinal);
    const anguloObjetivoBase = this.calcularAnguloParaSector(indiceGanador);
    const vueltasExtra = 5 + Math.floor(Math.random() * 4);
    const anguloFinal = anguloObjetivoBase - vueltasExtra * 2 * Math.PI;
    const anguloInicial = this.anguloActual;
    const startTime = performance.now();
    
    const animar = (currentTime: number) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / this.duracionAnimacion, 1);
      const easeOut = 1 - Math.pow(1 - progress, 3);
      
      this.anguloActual = anguloInicial + (anguloFinal - anguloInicial) * easeOut;
      this.dibujarRuleta(this.anguloActual);
      
      if (progress < 1) {
        this.animFrame = requestAnimationFrame(animar);
      } else {
        this.anguloActual = anguloFinal % (2 * Math.PI);
        this.dibujarRuleta(this.anguloActual);
        this.animFrame = null;
        
        this.ngZone.run(() => {
          this.girando = false;
          this.numeroGanador = numeroFinal;
          this.numeroModal = numeroFinal;
          this.colorModal = this.obtenerColor(numeroFinal);
          
          // Añadir al historial SOLO cuando la animación ha terminado
          this.agregarAlHistorial(numeroFinal);
          
          this.mostrarModalGanador = true;
          
          if (gano) {
            this.toast.win(`¡Ganaste ${premio.toFixed(2)}€!`);
          } else {
            this.toast.lose(`Perdiste. Salió el ${numeroFinal}`);
          }
        });
      }
    };
    
    this.animFrame = requestAnimationFrame(animar);
  }

  private agregarAlHistorial(numero: number): void {
    const color = this.obtenerColor(numero);
    this.historialTiradas.unshift({ numero, color });
    if (this.historialTiradas.length > 10) {
      this.historialTiradas.pop();
    }
  }

  cerrarModal(): void {
    this.mostrarModalGanador = false;
  }

  private obtenerColor(numero: number): string {
    if (numero === 0) return 'verde';
    const rojos = [1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36];
    return rojos.includes(numero) ? 'rojo' : 'negro';
  }

  volverAlLobby(): void {
    this.router.navigate(['/']);
  }
}