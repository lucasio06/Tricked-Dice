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
import { Router, ActivatedRoute } from "@angular/router";
import { Subscription } from "rxjs";
import { AuthService } from "../auth.service";
import { UsuarioPerfil } from "../models/api-responses";
import { ToastService } from "../services/toast.service";
import { NavbarComponent } from "../shared/navbar/navbar.component";
import { FooterComponent } from "../shared/footer/footer.component";
import { SignalrService } from "../services/signalr.service";
import { RUTAS } from "../utils/rutas.const";

interface HistorialTirada { numero: number; color: string; }
interface ApuestaVisual {
  id: number;
  tipo: 'pleno' | 'caballo' | 'calle' | 'cuadro' | 'seisena' | 'color' | 'paridad' | 'mitad' | 'docena' | 'columna' | 'vecinos0' | 'tercio' | 'huerfanos' | 'juego0' | 'finales';
  numeros: number[];
  monto: number;
  posX: number;
  posY: number;
  modo: 'rapidas' | 'especiales';
  estado?: 'win' | 'lose';
}

@Component({
  selector: "app-ruleta",
  standalone: true,
  imports: [CommonModule, FormsModule, NavbarComponent, FooterComponent],
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
  premioModal: number = 0;

  mostrarConfirmacionSalir: boolean = false;
  mostrarTutorial: boolean = false;

  historialTiradas: HistorialTirada[] = [];
  historialResultados: { numero: number, usuario: string, gano: boolean, premio: number }[] = [];
  usuarioActivo: UsuarioPerfil | null = null;

  apuestasActuales: ApuestaVisual[] = [];
  apuestasConfirmadas: ApuestaVisual[] = [];
  ultimasApuestas: ApuestaVisual[] = [];
  private nextIdApuesta: number = 1;
  private tiempoLimpiarApuestas: any = null;

  private historialApuestas: ApuestaVisual[][] = [];
  private indiceHistorial: number = -1;
  private navegandoHistorial: boolean = false;
  hayDeshacer: boolean = false;
  hayRehacer: boolean = false;

  modoApuesta: 'rapidas' | 'especiales' = 'rapidas';

  cantidadesFijas: number[] = [1, 5, 10, 30, 50, 100, 250, 500, 1000];

  numerosRuletaVisual: { numero: number; grupo: string }[] = [];
  numerosRuleta: number[] = [
    0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11, 30, 8, 23, 10, 5,
    24, 16, 33, 1, 20, 14, 31, 9, 22, 18, 29, 7, 28, 12, 35, 3, 26,
  ];

  private gruposEspeciales: { [key: string]: number[] } = {
    vecinos0: [22, 18, 29, 7, 28, 12, 35, 3, 26, 0, 32, 15, 19, 4, 21, 2, 25],
    tercio: [27, 13, 36, 11, 30, 8, 23, 10, 5, 24, 16, 33],
    huerfanos: [17, 34, 6, 1, 20, 14, 31, 9],
    juego0: [12, 35, 3, 26, 0, 32, 15]
  };

  private animFrame: number | null = null;
  private anguloActual: number = 0;
  private readonly numeroSectores: number = 37;
  private readonly anguloPorSector: number = (Math.PI * 2) / this.numeroSectores;
  private readonly duracionAnimacion: number = 3000;

  private coloresSectores: string[] = [];
  numerosRuedaConAngulo: { numero: number; angulo: number }[] = [];

  numeros = Array.from({ length: 37 }, (_, i) => i);
  colores = ["rojo", "negro"];
  paridades = ["par", "impar"];
  mitades = ["1-18", "19-36"];
  docenas = ["1ª Docena (1-12)", "2ª Docena (13-24)", "3ª Docena (25-36)"];
  columnas = ["1ª Columna", "2ª Columna", "3ª Columna"];
  finales = ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9"];

  private usuarioSub: Subscription | null = null;
  private audioContext: AudioContext | null = null;

  mesaId: string = '';
  private grupoRuleta: string = '';
  currentUser: string = '';
  currentUserEmail: string = '';
  esCreadorMesa: boolean = false;

  tiempoRestante: number = 0;
  private intervaloContador: any = null;

  private apuestasPendientesPorUsuario: Map<string, number> = new Map();
  private timeoutApuestas: any = null;

  constructor(
    private signalrService: SignalrService,
    private authService: AuthService,
    private toast: ToastService,
    private router: Router,
    private route: ActivatedRoute,
    private ngZone: NgZone,
  ) {
    this.inicializarColores();
    this.inicializarNumerosVisuales();
  }

  async ngOnInit(): Promise<void> {
    this.obtenerUsuarioActual();

    const conectado = await this.signalrService.startConnection("/hubs/ruleta");
    if (!conectado) {
      this.toast.error("No se pudo conectar al juego.");
      return;
    }

    this.signalrService.on("ForceLogout", (emailBaneado: string) => {
      if (this.currentUserEmail.toLowerCase() === emailBaneado.toLowerCase()) {
        this.authService.logout();
        this.toast.error("HAS SIDO BANEADO DEL SERVIDOR.");
      }
    });

    this.route.queryParams.subscribe(params => {
      this.mesaId = params['mesa'] || '';
      if (this.mesaId) {
        this.grupoRuleta = `ruleta_${this.mesaId}`;
        this.unirseMesaRuleta();
        this.obtenerInfoMesa();
      }
    });

    this.usuarioSub = this.authService.usuario$.subscribe((usuario) => {
      this.usuarioActivo = usuario;
      if (usuario) this.saldo = usuario.saldo;
    });

    this.signalrService.on("Error", (mensaje: string) => {
      this.girando = false;
      this.toast.error(mensaje);
    });

    if (this.mesaId) {
      this.signalrService.on("GiroIniciado", (startTime: number) => {
        this.ngZone.run(() => this.iniciarCuentaAtras(startTime));
      });

      this.signalrService.on("ApuestaAgregadaMesa", (nombre: string, apuesta: any) => {
        const montoApostado = apuesta.monto || apuesta.Monto || 0;
        const current = this.apuestasPendientesPorUsuario.get(nombre) || 0;
        
        this.apuestasPendientesPorUsuario.set(nombre, current + montoApostado);
        
        if (this.timeoutApuestas) clearTimeout(this.timeoutApuestas);
        
        this.timeoutApuestas = setTimeout(() => {
          this.apuestasPendientesPorUsuario.forEach((total, usuario) => {
            if (usuario !== this.currentUser) {
              this.toast.info(`${usuario} ha apostado un total de ${total}€`);
            }
          });
          this.apuestasPendientesPorUsuario.clear();
          this.timeoutApuestas = null;
        }, 500);
      });

      this.signalrService.on("ResultadoMesa", (data: any) => {
        const numeroGanador = data.numeroGanador;
        let miResultado = null;
        if (data.resultados) {
          const emailBuscado = this.currentUserEmail.toLowerCase();
          const keyEncontrada = Object.keys(data.resultados).find(k => k.toLowerCase() === emailBuscado);
          if (keyEncontrada) {
            miResultado = data.resultados[keyEncontrada];
          }
        }
        
        if (miResultado) {
          this.iniciarAnimacion(numeroGanador, miResultado.gano, miResultado.premio, miResultado.saldoActualizado, data.historialGlobal);
        } else {
          this.iniciarAnimacion(numeroGanador, false, 0, this.saldo, data.historialGlobal);
        }
        
        this.girando = false;
        if (this.intervaloContador) {
          clearInterval(this.intervaloContador);
          this.intervaloContador = null;
          this.tiempoRestante = 0;
        }
      });
    } else {
      this.signalrService.on("ResultadoGiro", (res: any) => {
        this.iniciarAnimacion(Number(res.numeroGanador), res.gano, res.premio, res.saldoActualizado);
      });
    }
  }

  ngAfterViewInit(): void {
    this.ctx = this.canvasRef.nativeElement.getContext("2d")!;
    this.anguloActual = this.calcularAnguloParaSector(0);
    this.dibujarRuleta(this.anguloActual);
    this.numerosRuedaConAngulo = this.numerosRuleta.map((num, i) => ({
      numero: num,
      angulo: this.calcularAnguloParaSector(i) + this.anguloPorSector / 2
    }));
  }

  ngOnDestroy(): void {
    this.usuarioSub?.unsubscribe();
    if (this.animFrame) cancelAnimationFrame(this.animFrame);
    if (this.tiempoLimpiarApuestas) clearTimeout(this.tiempoLimpiarApuestas);
    if (this.intervaloContador) clearInterval(this.intervaloContador);
    if (this.timeoutApuestas) clearTimeout(this.timeoutApuestas);
    this.signalrService.stopConnection();
  }

  get apuestasVisiblesActuales(): ApuestaVisual[] {
    return this.apuestasActuales.filter(a => a.modo === this.modoApuesta);
  }

  get apuestasVisiblesConfirmadas(): ApuestaVisual[] {
    return this.apuestasConfirmadas.filter(a => a.modo === this.modoApuesta);
  }

  cambiarModo(modo: 'rapidas' | 'especiales'): void {
    this.modoApuesta = modo;
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

  private inicializarNumerosVisuales(): void {
    const vecinos = this.gruposEspeciales['vecinos0'];
    const tercio = this.gruposEspeciales['tercio'];
    const huerfanos = this.gruposEspeciales['huerfanos'];
    const juego0 = this.gruposEspeciales['juego0'];
    for (let i = 0; i <= 36; i++) {
      let grupo = "";
      if (vecinos.includes(i)) grupo = "vecino";
      else if (tercio.includes(i)) grupo = "tercio";
      else if (huerfanos.includes(i)) grupo = "huerfano";
      else if (juego0.includes(i)) grupo = "juego0";
      this.numerosRuletaVisual.push({ numero: i, grupo });
    }
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

  private getPosicionExacta(elemento: Element): { x: number; y: number } {
    const contenedor = document.querySelector('.tapete-wrapper') as HTMLElement;
    if (elemento && contenedor) {
      const rect = elemento.getBoundingClientRect();
      const contRect = contenedor.getBoundingClientRect();
      return {
        x: ((rect.left + rect.width / 2 - contRect.left) / contRect.width) * 100,
        y: ((rect.top + rect.height / 2 - contRect.top) / contRect.height) * 100,
      };
    }
    return { x: 50, y: 50 };
  }

  private getPosicionNumero(numero: number): { x: number; y: number } {
    let elemento: Element | null = null;
    if (numero === 0) {
      elemento = document.querySelector('.numero-casilla.cero');
    } else {
      elemento = document.querySelector(`.numero-casilla[data-numero="${numero}"]`);
    }
    return this.getPosicionExacta(elemento!);
  }

  private getPosicionCentradaEvento(evento: Event): { x: number; y: number } {
    const elemento = (evento.currentTarget || evento.target) as Element;
    return this.getPosicionExacta(elemento);
  }

  private guardarEstadoHistorial(): void {
    if (this.navegandoHistorial) return;
    const copia = JSON.parse(JSON.stringify(this.apuestasActuales));
    if (this.indiceHistorial < this.historialApuestas.length - 1) {
      this.historialApuestas = this.historialApuestas.slice(0, this.indiceHistorial + 1);
    }
    this.historialApuestas.push(copia);
    if (this.historialApuestas.length > 50) this.historialApuestas.shift();
    else this.indiceHistorial++;
    this.actualizarBotonesHistorial();
  }

  private actualizarBotonesHistorial(): void {
    this.hayDeshacer = this.indiceHistorial > 0;
    this.hayRehacer = this.indiceHistorial < this.historialApuestas.length - 1;
  }

  deshacer(): void {
    if (!this.hayDeshacer) return;
    this.navegandoHistorial = true;
    this.indiceHistorial--;
    this.apuestasActuales = JSON.parse(JSON.stringify(this.historialApuestas[this.indiceHistorial]));
    this.navegandoHistorial = false;
    this.actualizarBotonesHistorial();
  }

  rehacer(): void {
    if (!this.hayRehacer) return;
    this.navegandoHistorial = true;
    this.indiceHistorial++;
    this.apuestasActuales = JSON.parse(JSON.stringify(this.historialApuestas[this.indiceHistorial]));
    this.navegandoHistorial = false;
    this.actualizarBotonesHistorial();
  }

  private agregarApuestaAcumulada(
    tipo: ApuestaVisual['tipo'],
    numeros: number[],
    posX: number,
    posY: number
  ): void {
    const existente = this.apuestasActuales.find(
      a => a.tipo === tipo && JSON.stringify(a.numeros) === JSON.stringify(numeros) && a.modo === this.modoApuesta
    );
    if (existente) {
      existente.monto += this.montoApuesta;
    } else {
      this.apuestasActuales.push({
        id: this.nextIdApuesta++,
        tipo,
        numeros,
        monto: this.montoApuesta,
        posX,
        posY,
        modo: this.modoApuesta
      });
    }
    this.sonidoSeleccion();
    this.guardarEstadoHistorial();
  }

  agregarApuestaPleno(num: number): void {
    const pos = this.getPosicionNumero(num);
    this.agregarApuestaAcumulada('pleno', [num], pos.x, pos.y);
  }

  agregarApuestaExterna(tipo: ApuestaVisual['tipo'], numeros: number[], evento: Event): void {
    const pos = this.getPosicionCentradaEvento(evento);
    this.agregarApuestaAcumulada(tipo, numeros, pos.x, pos.y);
  }

  limpiarApuestas(): void {
    this.apuestasActuales = [];
    if (this.tiempoLimpiarApuestas) {
      clearTimeout(this.tiempoLimpiarApuestas);
      this.tiempoLimpiarApuestas = null;
    }
    this.guardarEstadoHistorial();
  }

  repetirApuesta(): void {
    if (!this.ultimasApuestas.length) {
      this.toast.warning("No hay apuestas previas para repetir.");
      return;
    }
    this.limpiarApuestas();
    for (const ap of this.ultimasApuestas) {
      this.apuestasActuales.push({
        ...ap,
        id: this.nextIdApuesta++,
        estado: undefined
      });
    }
    this.guardarEstadoHistorial();
    this.toast.success("Apuesta repetida.");
  }

  duplicarApuesta(): void {
    if (!this.apuestasActuales.length) {
      this.toast.warning("No hay apuestas para duplicar.");
      return;
    }
    const nuevoTotal = this.apuestasActuales.reduce((sum, a) => sum + a.monto * 2, 0);
    if (nuevoTotal > this.saldo) {
      this.toast.warning("Saldo insuficiente para duplicar la apuesta.");
      return;
    }
    for (const ap of this.apuestasActuales) {
      ap.monto *= 2;
    }
    this.guardarEstadoHistorial();
    this.toast.success("Apuesta duplicada.");
  }

  get montoTotalApostado(): number {
    return this.apuestasActuales.reduce((sum, a) => sum + a.monto, 0);
  }

  seleccionarColor(color: string): void {
    const numeros = color === 'rojo'
      ? [1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36]
      : [2,4,6,8,10,11,13,15,17,20,22,24,26,28,29,31,33,35];
    this.agregarApuestaExterna('color', numeros, window.event!);
  }

  seleccionarParidad(par: string): void {
    const numeros = par === 'par'
      ? Array.from({length: 18}, (_, i) => (i+1)*2)
      : Array.from({length: 18}, (_, i) => (i*2)+1);
    this.agregarApuestaExterna('paridad', numeros, window.event!);
  }

  seleccionarMitad(mitad: string): void {
    const numeros = mitad === '1-18'
      ? Array.from({length: 18}, (_, i) => i+1)
      : Array.from({length: 18}, (_, i) => i+19);
    this.agregarApuestaExterna('mitad', numeros, window.event!);
  }

  seleccionarDocena(doc: string): void {
    const base = (parseInt(doc)-1)*12;
    const numeros = Array.from({length: 12}, (_, i) => base + i + 1);
    this.agregarApuestaExterna('docena', numeros, window.event!);
  }

  seleccionarColumna(col: string): void {
    const inicio = parseInt(col);
    const numeros: number[] = [];
    for (let i = inicio; i <= 36; i += 3) numeros.push(i);
    this.agregarApuestaExterna('columna', numeros, window.event!);
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
        numeros = [...this.gruposEspeciales['vecinos0']];
        break;
      case 'tercio':
        numeros = [...this.gruposEspeciales['tercio']];
        break;
      case 'huerfanos':
        numeros = [...this.gruposEspeciales['huerfanos']];
        break;
      case 'juego0':
        numeros = [...this.gruposEspeciales['juego0']];
        break;
    }
    if (numeros.length > 0) {
      this.agregarApuestaExterna(tipo as ApuestaVisual['tipo'], numeros, window.event!);
    }
  }

  resaltarGrupoAvanzada(tipo: string): void {
    this.resaltarGrupo(tipo);
  }

  seleccionarFinal(f: string, evento: Event): void {
    const digito = parseInt(f);
    const numeros = [];
    for (let i = digito; i <= 36; i += 10) {
      numeros.push(i);
    }
    this.agregarApuestaExterna('finales', numeros, evento);
  }

  apuestaValida(): boolean {
    return this.apuestasActuales.length > 0 && this.montoTotalApostado <= this.saldo;
  }

  private mapearValorApuesta(a: ApuestaVisual): string {
    switch (a.tipo) {
      case 'docena': return (Math.floor((a.numeros[0] - 1) / 12) + 1).toString();
      case 'columna': return (((a.numeros[0] - 1) % 3) + 1).toString();
      case 'finales': return (a.numeros[0] % 10).toString();
      case 'color': return a.numeros[0] === 1 ? 'rojo' : 'negro';
      case 'paridad': return a.numeros[0] === 2 ? 'par' : 'impar';
      case 'mitad': return a.numeros[0] === 1 ? '1-18' : '19-36';
      default: return a.numeros.join(',');
    }
  }

  async apostar(): Promise<void> {
    if (!this.apuestaValida()) {
      this.toast.warning("Apuesta inválida o saldo insuficiente.");
      return;
    }

    this.saldo -= this.montoTotalApostado;

    const apuestasParaBackend = this.apuestasActuales.map(a => {
      let t = a.tipo.toString().toLowerCase();
      let v = this.mapearValorApuesta(a).toLowerCase().trim();

      if (t === 'paridad' || t === 'mitad') {
        t = v;
        v = '';
      }

      return {
        tipo: t,
        valor: v,
        monto: a.monto
      };
    });

    if (this.mesaId) {
      for (const ap of apuestasParaBackend) {
        await this.signalrService.invoke('AgregarApuestaMesa', this.mesaId, ap);
      }
      this.apuestasConfirmadas.push(...this.apuestasActuales);
      this.apuestasActuales = [];
      this.guardarEstadoHistorial();
      if (this.tiempoLimpiarApuestas) {
        clearTimeout(this.tiempoLimpiarApuestas);
        this.tiempoLimpiarApuestas = null;
      }
    } else {
      this.girando = true;
      this.sonidoGiro();
      this.numeroGanador = null;

      for (let ap of this.apuestasActuales) {
        delete ap.estado;
      }

      this.guardarEstadoHistorial();

      await this.signalrService.invoke(
        "GirarMultiple",
        "mesa-principal",
        apuestasParaBackend,
      );
    }
  }

  private iniciarCuentaAtras(startTimeMs: number): void {
    if (this.intervaloContador) clearInterval(this.intervaloContador);
    const startTime = new Date(startTimeMs);
    const duracion = 5;

    const actualizar = () => {
      const elapsed = (Date.now() - startTime.getTime()) / 1000;
      const remaining = Math.max(0, duracion - elapsed);
      this.tiempoRestante = Math.ceil(remaining);
      if (remaining <= 0) {
        clearInterval(this.intervaloContador);
        this.intervaloContador = null;
        if (this.esCreadorMesa) {
          this.girando = true;
          this.ejecutarGiroMesa();
        }
      }
    };
    actualizar();
    this.intervaloContador = setInterval(() => this.ngZone.run(actualizar), 1000);
  }

  private async ejecutarGiroMesa(): Promise<void> {
    if (!this.mesaId) return;
    await this.signalrService.invoke('GirarMesa', this.mesaId);
  }

  async girarMesa(): Promise<void> {
    if (!this.mesaId) return;
    if (this.girando) return;
    if (!this.esCreadorMesa) return;

    await this.signalrService.invoke('NotificarInicioGiro', this.mesaId);
  }

  private async unirseMesaRuleta(): Promise<void> {
    if (!this.mesaId) return;
    await this.signalrService.invoke('UnirseMesaRuleta', this.mesaId);
  }

  private normalizarString(str: string): string {
    if (!str) return '';
    return str.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  }

  private async obtenerInfoMesa(): Promise<void> {
    const mesas = JSON.parse(localStorage.getItem('mesasActivas') || '[]');
    const mesa = mesas.find((m: any) => m.id === this.mesaId);
    const creadorMesa = mesa ? (mesa.creador || mesa.creator) : null;
    
    if (creadorMesa && this.currentUser) {
      this.esCreadorMesa = this.normalizarString(creadorMesa) === this.normalizarString(this.currentUser);
    } else {
      this.esCreadorMesa = false;
    }
  }

  getFilaVisual(fila: number): number[] {
    if (fila === 0) return [3,6,9,12,15,18,21,24,27,30,33,36];
    if (fila === 1) return [2,5,8,11,14,17,20,23,26,29,32,35];
    return [1,4,7,10,13,16,19,22,25,28,31,34];
  }

  resaltarGrupo(tipo: string): void {
    const numeros = this.gruposEspeciales[tipo];
    if (!numeros) return;
    const elementos = document.querySelectorAll('.numero-racetrack');
    elementos.forEach(el => {
      const num = parseInt(el.getAttribute('data-numero') || '');
      if (numeros.includes(num)) {
        el.classList.add('highlight');
      }
    });
  }

  limpiarResaltado(): void {
    const elementos = document.querySelectorAll('.numero-racetrack');
    elementos.forEach(el => el.classList.remove('highlight'));
  }

  private evaluarResultadoApuestas(numeroGanador: number): void {
    const todasLasApuestas = [...this.apuestasActuales, ...this.apuestasConfirmadas];
    for (let apuesta of todasLasApuestas) {
      const gano = this.calcularPremioLocal(apuesta.tipo, apuesta.numeros, numeroGanador) > 0;
      apuesta.estado = gano ? 'win' : 'lose';
    }
  }

  private calcularPremioLocal(tipo: string, numerosApuesta: number[], numeroGanador: number): number {
    tipo = tipo.toLowerCase();
    switch (tipo) {
      case 'pleno': return numerosApuesta[0] === numeroGanador ? 36 : 0;
      case 'color': {
        const rojos = [1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36];
        const colorGanador = numeroGanador === 0 ? 'verde' : rojos.includes(numeroGanador) ? 'rojo' : 'negro';
        const colorApostado = numerosApuesta[0] === 1 ? 'rojo' : 'negro';
        return (colorApostado === colorGanador && numeroGanador !== 0) ? 2 : 0;
      }
      case 'paridad': {
        if (numeroGanador === 0) return 0;
        const esPar = numeroGanador % 2 === 0;
        const apuestaPar = numerosApuesta[0] === 2;
        return (esPar === apuestaPar) ? 2 : 0;
      }
      case 'mitad': {
        if (numeroGanador === 0) return 0;
        const apuestaMitad = numerosApuesta[0] === 1 ? 1 : 19;
        if (apuestaMitad === 1) {
            return (numeroGanador >= 1 && numeroGanador <= 18) ? 2 : 0;
        } else {
            return (numeroGanador >= 19 && numeroGanador <= 36) ? 2 : 0;
        }
      }
      case 'docena': {
        if (numeroGanador === 0) return 0;
        const docena = Math.floor((numeroGanador - 1) / 12) + 1;
        const docenaApostada = Math.floor((numerosApuesta[0] - 1) / 12) + 1;
        return docena === docenaApostada ? 3 : 0;
      }
      case 'columna': {
        if (numeroGanador === 0) return 0;
        const columna = ((numeroGanador - 1) % 3) + 1;
        const columnaApostada = ((numerosApuesta[0] - 1) % 3) + 1;
        return columna === columnaApostada ? 3 : 0;
      }
      case 'vecinos0': {
        const vecinos = this.gruposEspeciales['vecinos0'];
        return vecinos.includes(numeroGanador) ? 36/17 : 0;
      }
      case 'tercio': {
        const tercio = this.gruposEspeciales['tercio'];
        return tercio.includes(numeroGanador) ? 36/12 : 0;
      }
      case 'huerfanos': {
        const huerfanos = this.gruposEspeciales['huerfanos'];
        return huerfanos.includes(numeroGanador) ? 36/8 : 0;
      }
      case 'juego0': {
        const juego0 = this.gruposEspeciales['juego0'];
        return juego0.includes(numeroGanador) ? 36/7 : 0;
      }
      case 'finales': {
        const digito = numerosApuesta[0] % 10;
        return (numeroGanador % 10 === digito) ? 36/4 : 0;
      }
      default: return 0;
    }
  }

  private iniciarAnimacion(
    numeroFinal: number,
    gano: boolean,
    premio: number,
    saldoFinal?: number,
    historialGlobal?: any[]
  ): void {
    if (!this.ctx) {
      setTimeout(() => this.iniciarAnimacion(numeroFinal, gano, premio, saldoFinal, historialGlobal), 50);
      return;
    }
    const indice = this.numerosRuleta.indexOf(numeroFinal);
    if (indice === -1) {
      this.girando = false;
      return;
    }

    this.ultimasApuestas = JSON.parse(JSON.stringify(this.apuestasActuales.length ? this.apuestasActuales : this.apuestasConfirmadas));

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
          this.premioModal = premio;

          if (saldoFinal !== undefined) {
            this.saldo = saldoFinal;
            this.authService.actualizarSaldo(this.saldo);
          }

          if (historialGlobal) {
            historialGlobal.forEach(h => {
              this.historialResultados.unshift({
                numero: numeroFinal,
                usuario: h.usuario,
                gano: h.gano,
                premio: h.premio
              });
            });
          } else {
            this.historialResultados.unshift({
              numero: numeroFinal,
              usuario: this.currentUser,
              gano: gano,
              premio: premio
            });
          }
          if (this.historialResultados.length > 20) this.historialResultados = this.historialResultados.slice(0, 20);

          this.agregarAlHistorial(numeroFinal);
          this.evaluarResultadoApuestas(numeroFinal);
          this.mostrarModalGanador = true;
          gano ? this.sonidoGanar() : this.sonidoPerder();
          if (this.tiempoLimpiarApuestas) clearTimeout(this.tiempoLimpiarApuestas);
          this.tiempoLimpiarApuestas = setTimeout(() => {
            this.apuestasActuales = [];
            this.apuestasConfirmadas = [];
            this.tiempoLimpiarApuestas = null;
          }, 2000);
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
    this.premioModal = 0;
  }

  private obtenerColor(numero: number): string {
    if (numero === 0) return "verde";
    return [
      1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36,
    ].includes(numero)
      ? "rojo"
      : "negro";
  }

  private obtenerUsuarioActual(): void {
    const token = localStorage.getItem('token');
    if (token) {
      try {
        const payload = JSON.parse(atob(token.split('.')[1]));
        this.currentUser = payload['http://schemas.xmlsoap.org/ws/2005/05/identity/claims/name'] || payload.unique_name || 'Usuario';
        this.currentUserEmail = payload['http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress'] || payload.email || '';
      } catch (e) {
        this.currentUser = 'Usuario';
      }
    }
    const usuario = localStorage.getItem('usuario') ? JSON.parse(localStorage.getItem('usuario')!) : null;
    if (usuario && usuario.nombreUsuario) this.currentUser = usuario.nombreUsuario;
    if (usuario && usuario.email) this.currentUserEmail = usuario.email;
  }

  volverAlLobby(): void {
    if (this.mesaId) {
      const mesas = JSON.parse(localStorage.getItem('mesasActivas') || '[]');
      const actualizadas = mesas.filter((m: any) => m.id !== this.mesaId);
      localStorage.setItem('mesasActivas', JSON.stringify(actualizadas));
      this.router.navigate([RUTAS.lobby]);
    } else {
      this.router.navigate(['/']);
    }
  }

  confirmarSalir(): void {
    this.mostrarConfirmacionSalir = false;
    this.volverAlLobby();
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
      g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + i * 0.12 + 0.2);
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
      o.frequency.setValueAtTime(400 + Math.random() * 200, ctx.currentTime + i * (d / 30));
      g.gain.setValueAtTime(0.03, ctx.currentTime + i * (d / 30));
      g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + i * (d / 30) + 0.06);
      o.start(ctx.currentTime + i * (d / 30));
      o.stop(ctx.currentTime + i * (d / 30) + 0.06);
    }
  }
}