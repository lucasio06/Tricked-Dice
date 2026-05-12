import {
  Component,
  OnInit,
  ViewChild,
  ElementRef,
  AfterViewInit,
  OnDestroy,
  NgZone,
} from "@angular/core";
import { CommonModule } from "@angular/common";
import { FormsModule } from "@angular/forms";
import { Router } from "@angular/router";
import { Subscription } from "rxjs";
import { AuthService } from "../auth.service";
import { UsuarioPerfil } from "../models/api-responses";
import { ToastService } from "../services/toast.service";
import { NavbarComponent } from "../shared/navbar/navbar.component";
import { SignalrService } from "../services/signalr.service";
import { RUTAS } from "../utils/rutas.const";

interface HistorialTirada {
  numero: number;
  color: string;
}

interface ApuestaVisual {
  id: number;
  tipo: 'pleno' | 'caballo' | 'calle' | 'cuadro' | 'seisena' | 'color' | 'paridad' | 'mitad' | 'docena' | 'columna' | 'vecinos0' | 'tercio' | 'huerfanos' | 'juego0' | 'finales';
  numeros: number[];
  monto: number;
  posX: number;
  posY: number;
}

@Component({
  selector: "app-ruleta",
  standalone: true,
  imports: [CommonModule, FormsModule, NavbarComponent],
  templateUrl: "./ruleta.component.html",
  styleUrls: ["./ruleta.component.scss"],
})
export class RuletaComponent implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild("ruletaCanvas", { static: false })
  canvasRef!: ElementRef<HTMLCanvasElement>;
  private ctx!: CanvasRenderingContext2D;

  saldo: number = 0;
  montoApuesta: number = 10;
  girando: boolean = false;
  numeroGanador: number | null = null;

  mostrarModalGanador: boolean = false;
  numeroModal: number = 0;
  colorModal: string = "";

  historialTiradas: HistorialTirada[] = [];
  usuarioActivo: UsuarioPerfil | null = null;

  apuestasActuales: ApuestaVisual[] = [];
  private nextIdApuesta: number = 1;

  private animFrame: number | null = null;
  private anguloActual: number = 0;
  private readonly numeroSectores: number = 37;
  private readonly anguloPorSector: number = (Math.PI * 2) / this.numeroSectores;
  private readonly duracionAnimacion: number = 3000;

  valorApuestaSeisena: string = "1-6";
  valorApuestaCuadro: string = "0,1,2,3";
  valorApuestaCalle: string = "1,2,3";
  valorApuestaCaballo: string = "0,1";
  valorApuestaFinal: string = "0";

  private coloresSectores: string[] = [];
  private numerosRuleta: number[] = [
    0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11, 30, 8, 23, 10, 5,
    24, 16, 33, 1, 20, 14, 31, 9, 22, 18, 29, 7, 28, 12, 35, 3, 26,
  ];

  numeros = Array.from({ length: 37 }, (_, i) => i);
  colores = ["rojo", "negro"];
  paridades = ["par", "impar"];
  mitades = ["1-18", "19-36"];
  docenas = ["1ª Docena (1-12)", "2ª Docena (13-24)", "3ª Docena (25-36)"];
  columnas = ["1ª Columna", "2ª Columna", "3ª Columna"];
  finales = ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9"];

  seisenas: string[] = [];
  cuadros: string[] = [];
  calles: string[] = [];
  caballos: string[] = [];

  private usuarioSub: Subscription | null = null;
  private audioContext: AudioContext | null = null;

  constructor(
    private signalrService: SignalrService,
    private authService: AuthService,
    private toast: ToastService,
    private router: Router,
    private ngZone: NgZone,
  ) {
    this.inicializarColores();
    this.generarApuestasMultiples();
  }

  async ngOnInit(): Promise<void> {
    this.usuarioSub = this.authService.usuario$.subscribe((usuario) => {
      this.usuarioActivo = usuario;
      if (usuario) this.saldo = usuario.saldo;
    });
    this.cargarHistorial();

    const conectado = await this.signalrService.startConnection("/hubs/ruleta");
    if (!conectado) {
      this.toast.error("No se pudo conectar al juego.");
      return;
    }

    this.signalrService.on("Error", (mensaje: string) => {
      this.girando = false;
      this.toast.error(mensaje);
    });

    this.signalrService.on("ResultadoGiro", (res: any) => {
      this.saldo = res.saldoActualizado;
      this.authService.actualizarSaldo(res.saldoActualizado);
      this.iniciarAnimacion(Number(res.numeroGanador), res.gano, res.premio);
      this.apuestasActuales = [];
    });
  }

  ngAfterViewInit(): void {
    this.ctx = this.canvasRef.nativeElement.getContext("2d")!;
    this.anguloActual = this.calcularAnguloParaSector(0);
    this.dibujarRuleta(this.anguloActual);
  }

  ngOnDestroy(): void {
    this.usuarioSub?.unsubscribe();
    if (this.animFrame) cancelAnimationFrame(this.animFrame);
    this.signalrService.stopConnection();
  }

  private inicializarColores(): void {
    this.coloresSectores = this.numerosRuleta.map((num) => {
      if (num === 0) return "#2ecc71";
      const rojos = [
        1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36,
      ];
      return rojos.includes(num) ? "#e74c3c" : "#2c3e50";
    });
  }

  private generarApuestasMultiples(): void {
    for (let i = 1; i <= 31; i += 3) this.seisenas.push(`${i}-${i + 5}`);
    this.cuadros = [
      "0,1,2,3",
      "1,2,4,5",
      "2,3,5,6",
      "4,5,7,8",
      "5,6,8,9",
      "7,8,10,11",
      "8,9,11,12",
      "10,11,13,14",
      "11,12,14,15",
      "13,14,16,17",
      "14,15,17,18",
      "16,17,19,20",
      "17,18,20,21",
      "19,20,22,23",
      "20,21,23,24",
      "22,23,25,26",
      "23,24,26,27",
      "25,26,28,29",
      "26,27,29,30",
      "28,29,31,32",
      "29,30,32,33",
      "31,32,34,35",
      "32,33,35,36",
    ];
    for (let i = 1; i <= 34; i += 3) this.calles.push(`${i},${i + 1},${i + 2}`);
    this.caballos = [
      "0,1",
      "0,2",
      "0,3",
      "1,2",
      "2,3",
      "4,5",
      "5,6",
      "7,8",
      "8,9",
      "10,11",
      "11,12",
      "13,14",
      "14,15",
      "16,17",
      "17,18",
      "19,20",
      "20,21",
      "22,23",
      "23,24",
      "25,26",
      "26,27",
      "28,29",
      "29,30",
      "31,32",
      "32,33",
      "34,35",
      "35,36",
      "1,4",
      "2,5",
      "3,6",
      "4,7",
      "5,8",
      "6,9",
      "7,10",
      "8,11",
      "9,12",
      "10,13",
      "11,14",
      "12,15",
      "13,16",
      "14,17",
      "15,18",
      "16,19",
      "17,20",
      "18,21",
      "19,22",
      "20,23",
      "21,24",
      "22,25",
      "23,26",
      "24,27",
      "25,28",
      "26,29",
      "27,30",
      "28,31",
      "29,32",
      "30,33",
      "31,34",
      "32,35",
      "33,36",
    ];
  }

  private cargarHistorial(): void {
    this.historialTiradas = [];
  }

  private calcularAnguloParaSector(indice: number): number {
    return (
      -Math.PI / 2 - (indice * this.anguloPorSector + this.anguloPorSector / 2)
    );
  }

  private dibujarRuleta(anguloOffset: number = 0): void {
    const canvas = this.canvasRef?.nativeElement;
    const ctx = this.ctx;
    if (!canvas || !ctx) return;
    const width = canvas.width;
    const height = canvas.height;
    const centroX = width / 2;
    const centroY = height / 2;
    const radio = Math.min(width, height) * 0.45;
    ctx.clearRect(0, 0, width, height);
    ctx.shadowColor = "#a742f5";
    ctx.shadowBlur = 20;
    ctx.beginPath();
    ctx.arc(centroX, centroY, radio + 5, 0, Math.PI * 2);
    ctx.fillStyle = "#1a1125";
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = "#d4af37";
    ctx.lineWidth = 4;
    ctx.stroke();
    for (let i = 0; i < this.numeroSectores; i++) {
      const ai = i * this.anguloPorSector + anguloOffset;
      const af = ai + this.anguloPorSector;
      ctx.beginPath();
      ctx.moveTo(centroX, centroY);
      ctx.arc(centroX, centroY, radio, ai, af);
      ctx.closePath();
      ctx.fillStyle = this.coloresSectores[i];
      ctx.fill();
      ctx.strokeStyle = "#d4af37";
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.save();
      ctx.translate(centroX, centroY);
      ctx.rotate(ai + this.anguloPorSector / 2);
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.font = "bold 14px Montserrat";
      ctx.fillStyle = "#ffffff";
      ctx.shadowColor = "#000";
      ctx.shadowBlur = 4;
      ctx.fillText(this.numerosRuleta[i].toString(), radio * 0.75, 0);
      ctx.restore();
    }
    ctx.beginPath();
    ctx.arc(centroX, centroY, radio * 0.15, 0, Math.PI * 2);
    ctx.fillStyle = "#1a1125";
    ctx.fill();
    ctx.strokeStyle = "#d4af37";
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.fillStyle = "#d4af37";
    ctx.shadowColor = "#a742f5";
    ctx.shadowBlur = 10;
    ctx.beginPath();
    ctx.moveTo(centroX - 12, 10);
    ctx.lineTo(centroX + 12, 10);
    ctx.lineTo(centroX, 30);
    ctx.closePath();
    ctx.fill();
    ctx.shadowBlur = 0;
  }

  private getPosicionNumero(numero: number): { x: number; y: number } {
    const numStr = numero.toString();
    const elemento = document.querySelector(`.numero-casilla[data-numero="${numStr}"]`);
    if (elemento) {
      const rect = elemento.getBoundingClientRect();
      const contenedor = document.querySelector('.tapete-real') as HTMLElement;
      if (contenedor) {
        const contRect = contenedor.getBoundingClientRect();
        return {
          x: ((rect.left + rect.width / 2 - contRect.left) / contRect.width) * 100,
          y: ((rect.top + rect.height / 2 - contRect.top) / contRect.height) * 100,
        };
      }
    }
    return { x: 50, y: 50 };
  }

  private getPosicionEntreNumeros(num1: number, num2: number): { x: number; y: number } {
    const pos1 = this.getPosicionNumero(num1);
    const pos2 = this.getPosicionNumero(num2);
    return {
      x: (pos1.x + pos2.x) / 2,
      y: (pos1.y + pos2.y) / 2,
    };
  }

  agregarApuestaPleno(num: number): void {
    const pos = this.getPosicionNumero(num);
    const apuesta: ApuestaVisual = {
      id: this.nextIdApuesta++,
      tipo: 'pleno',
      numeros: [num],
      monto: this.montoApuesta,
      posX: pos.x,
      posY: pos.y,
    };
    this.apuestasActuales.push(apuesta);
    this.sonidoSeleccion();
  }

  agregarApuestaCaballo(num1: number, num2: number): void {
    const pos = this.getPosicionEntreNumeros(num1, num2);
    const apuesta: ApuestaVisual = {
      id: this.nextIdApuesta++,
      tipo: 'caballo',
      numeros: [num1, num2],
      monto: this.montoApuesta,
      posX: pos.x,
      posY: pos.y,
    };
    this.apuestasActuales.push(apuesta);
    this.sonidoSeleccion();
  }

  agregarApuestaCalle(num1: number, num2: number, num3: number): void {
    const pos = this.getPosicionEntreNumeros(num1, num3);
    const apuesta: ApuestaVisual = {
      id: this.nextIdApuesta++,
      tipo: 'calle',
      numeros: [num1, num2, num3],
      monto: this.montoApuesta,
      posX: pos.x,
      posY: pos.y,
    };
    this.apuestasActuales.push(apuesta);
    this.sonidoSeleccion();
  }

  agregarApuestaCuadro(num1: number, num2: number, num3: number, num4: number): void {
    const pos = this.getPosicionEntreNumeros(num1, num4);
    const apuesta: ApuestaVisual = {
      id: this.nextIdApuesta++,
      tipo: 'cuadro',
      numeros: [num1, num2, num3, num4],
      monto: this.montoApuesta,
      posX: pos.x,
      posY: pos.y,
    };
    this.apuestasActuales.push(apuesta);
    this.sonidoSeleccion();
  }

  agregarApuestaSeisena(num1: number, num2: number, num3: number, num4: number, num5: number, num6: number): void {
    const pos = this.getPosicionEntreNumeros(num1, num6);
    const apuesta: ApuestaVisual = {
      id: this.nextIdApuesta++,
      tipo: 'seisena',
      numeros: [num1, num2, num3, num4, num5, num6],
      monto: this.montoApuesta,
      posX: pos.x,
      posY: pos.y,
    };
    this.apuestasActuales.push(apuesta);
    this.sonidoSeleccion();
  }

  agregarApuestaExterna(tipo: ApuestaVisual['tipo'], numeros: number[], evento: MouseEvent): void {
    const contenedor = document.querySelector('.tapete-real') as HTMLElement;
    if (!contenedor) return;
    const contRect = contenedor.getBoundingClientRect();
    const x = ((evento.clientX - contRect.left) / contRect.width) * 100;
    const y = ((evento.clientY - contRect.top) / contRect.height) * 100;
    const apuesta: ApuestaVisual = {
      id: this.nextIdApuesta++,
      tipo,
      numeros,
      monto: this.montoApuesta,
      posX: x,
      posY: y,
    };
    this.apuestasActuales.push(apuesta);
    this.sonidoSeleccion();
  }

  limpiarApuestas(): void {
    this.apuestasActuales = [];
  }

  get montoTotalApostado(): number {
    return this.apuestasActuales.reduce((sum, a) => sum + a.monto, 0);
  }

  seleccionarColor(color: string): void {
    const numeros = color === 'rojo'
      ? [1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36]
      : [2,4,6,8,10,11,13,15,17,20,22,24,26,28,29,31,33,35];
    this.agregarApuestaExterna('color', numeros, window.event as MouseEvent);
  }
  seleccionarParidad(par: string): void {
    const numeros = par === 'par'
      ? Array.from({length: 18}, (_, i) => (i+1)*2)
      : Array.from({length: 18}, (_, i) => (i*2)+1);
    this.agregarApuestaExterna('paridad', numeros, window.event as MouseEvent);
  }
  seleccionarMitad(mitad: string): void {
    const numeros = mitad === '1-18'
      ? Array.from({length: 18}, (_, i) => i+1)
      : Array.from({length: 18}, (_, i) => i+19);
    this.agregarApuestaExterna('mitad', numeros, window.event as MouseEvent);
  }
  seleccionarDocena(doc: string): void {
    const base = (parseInt(doc)-1)*12;
    const numeros = Array.from({length: 12}, (_, i) => base + i + 1);
    this.agregarApuestaExterna('docena', numeros, window.event as MouseEvent);
  }
  seleccionarColumna(col: string): void {
    const inicio = parseInt(col);
    const numeros: number[] = [];
    for (let i = inicio; i <= 36; i += 3) numeros.push(i);
    this.agregarApuestaExterna('columna', numeros, window.event as MouseEvent);
  }

  esRojo(num: number): boolean {
    if (num === 0) return false;
    return [
      1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36,
    ].includes(num);
  }

  seleccionarAvanzada(tipo: string): void {
    this.sonidoSeleccion();
    let numeros: number[] = [];
    switch(tipo) {
      case 'vecinos0':
        numeros = [0,2,3,4,7,12,15,18,19,21,22,25,26,28,29,32,35];
        break;
      case 'tercio':
        numeros = [5,8,10,11,13,16,23,24,27,30,33,36];
        break;
      case 'huerfanos':
        numeros = [1,6,9,14,17,20,31,34];
        break;
      case 'juego0':
        numeros = [0,3,12,15,26,32,35];
        break;
    }
    if (numeros.length > 0) {
      this.agregarApuestaExterna(tipo as ApuestaVisual['tipo'], numeros, window.event as MouseEvent);
    }
  }

  apuestaValida(): boolean {
    return this.apuestasActuales.length > 0 && this.montoTotalApostado <= this.saldo;
  }

  async apostar(): Promise<void> {
    if (!this.apuestaValida()) {
      this.toast.warning("Apuesta inválida o saldo insuficiente.");
      return;
    }
    this.girando = true;
    this.sonidoGiro();
    this.numeroGanador = null;

    const apuestasParaBackend = this.apuestasActuales.map(a => ({
      tipo: a.tipo,
      valor: a.numeros.join(','),
      monto: a.monto,
    }));

    await this.signalrService.invoke(
      "GirarMultiple",
      "mesa-principal",
      apuestasParaBackend,
    );
  }

  getFilaVisual(fila: number): number[] {
    if (fila === 0) return [3,6,9,12,15,18,21,24,27,30,33,36];
    if (fila === 1) return [2,5,8,11,14,17,20,23,26,29,32,35];
    return [1,4,7,10,13,16,19,22,25,28,31,34];
  }

  private iniciarAnimacion(
    numeroFinal: number,
    gano: boolean,
    premio: number,
  ): void {
    if (!this.ctx) {
      setTimeout(() => this.iniciarAnimacion(numeroFinal, gano, premio), 50);
      return;
    }
    const indice = this.numerosRuleta.indexOf(numeroFinal);
    if (indice === -1) {
      this.girando = false;
      return;
    }

    const anguloBase = this.calcularAnguloParaSector(indice);
    const vueltas = (5 + Math.floor(Math.random() * 5)) * 2 * Math.PI;
    const anguloObj = anguloBase - vueltas;

    const inicio = this.anguloActual;
    const start = performance.now();
    const animar = (t: number) => {
      const p = Math.min((t - start) / this.duracionAnimacion, 1);
      this.anguloActual =
        inicio + (anguloObj - inicio) * (1 - Math.pow(1 - p, 3));
      this.dibujarRuleta(this.anguloActual);
      if (p < 1) this.animFrame = requestAnimationFrame(animar);
      else {
        let anguloFinal = anguloObj % (2 * Math.PI);
        if (anguloFinal < 0) anguloFinal += 2 * Math.PI;
        this.anguloActual = anguloFinal;
        this.dibujarRuleta(this.anguloActual);
        this.animFrame = null;
        this.ngZone.run(() => {
          this.girando = false;
          this.numeroGanador = numeroFinal;
          this.numeroModal = numeroFinal;
          this.colorModal = this.obtenerColor(numeroFinal);
          this.agregarAlHistorial(numeroFinal);
          this.mostrarModalGanador = true;
          gano ? this.sonidoGanar() : this.sonidoPerder();
          this.apuestasActuales = [];
        });
      }
    };
    this.animFrame = requestAnimationFrame(animar);
  }

  private agregarAlHistorial(numero: number): void {
    this.historialTiradas.unshift({ numero, color: this.obtenerColor(numero) });
    if (this.historialTiradas.length > 10) this.historialTiradas.pop();
  }

  cerrarModal(): void {
    this.mostrarModalGanador = false;
  }

  private obtenerColor(numero: number): string {
    if (numero === 0) return "verde";
    return [
      1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36,
    ].includes(numero)
      ? "rojo"
      : "negro";
  }

  volverAlLobby(): void {
    this.router.navigate([RUTAS.home]);
  }

  private getAudioContext(): AudioContext {
    if (!this.audioContext) this.audioContext = new AudioContext();
    return this.audioContext;
  }

  private sonidoSeleccion(): void {
    const ctx = this.getAudioContext();
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.connect(g);
    g.connect(ctx.destination);
    o.type = "sine";
    o.frequency.setValueAtTime(1000, ctx.currentTime);
    g.gain.setValueAtTime(0.05, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.03);
    o.start(ctx.currentTime);
    o.stop(ctx.currentTime + 0.03);
  }
  private sonidoGanar(): void {
    const ctx = this.getAudioContext();
    [523, 659, 784, 1047].forEach((f, i) => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.connect(g);
      g.connect(ctx.destination);
      o.type = "sine";
      o.frequency.setValueAtTime(f, ctx.currentTime + i * 0.12);
      g.gain.setValueAtTime(0.12, ctx.currentTime + i * 0.12);
      g.gain.exponentialRampToValueAtTime(
        0.001,
        ctx.currentTime + i * 0.12 + 0.2,
      );
      o.start(ctx.currentTime + i * 0.12);
      o.stop(ctx.currentTime + i * 0.12 + 0.2);
    });
  }
  private sonidoPerder(): void {
    const ctx = this.getAudioContext();
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.connect(g);
    g.connect(ctx.destination);
    o.type = "sine";
    o.frequency.setValueAtTime(300, ctx.currentTime);
    o.frequency.linearRampToValueAtTime(150, ctx.currentTime + 0.4);
    g.gain.setValueAtTime(0.1, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
    o.start(ctx.currentTime);
    o.stop(ctx.currentTime + 0.4);
  }
  private sonidoGiro(): void {
    const ctx = this.getAudioContext();
    const d = this.duracionAnimacion / 1000;
    for (let i = 0; i < 30; i++) {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.connect(g);
      g.connect(ctx.destination);
      o.type = "sine";
      o.frequency.setValueAtTime(
        400 + Math.random() * 200,
        ctx.currentTime + i * (d / 30),
      );
      g.gain.setValueAtTime(0.03, ctx.currentTime + i * (d / 30));
      g.gain.exponentialRampToValueAtTime(
        0.001,
        ctx.currentTime + i * (d / 30) + 0.06,
      );
      o.start(ctx.currentTime + i * (d / 30));
      o.stop(ctx.currentTime + i * (d / 30) + 0.06);
    }
  }
}