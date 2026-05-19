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
import { Subscription, interval } from "rxjs";
import { AuthService } from "../auth.service";
import { UsuarioPerfil } from "../models/api-responses";
import { ToastService } from "../services/toast.service";
import { NavbarComponent } from "../shared/navbar/navbar.component";
import { SignalrService } from "../services/signalr.service";
import { ApiService } from "../services/api.service";
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
  estado?: 'win' | 'lose';
}

interface JugadorMesa {
  email: string;
  nombre: string;
  haApostado: boolean;
  listo: boolean;
  autoSkip: boolean;
  montoApostado: number;
}

interface EstadoMesa {
  mesaId: string;
  jugadores: JugadorMesa[];
  rondaActiva: boolean;
  inicioRonda: string;
  todosListos: boolean;
  creadorEmail: string;
}

interface MensajeChat {
  jugador: string;
  mensaje: string;
  hora: string;
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
  premioModal: number = 0;

  historialTiradas: HistorialTirada[] = [];
  usuarioActivo: UsuarioPerfil | null = null;

  apuestasActuales: ApuestaVisual[] = [];
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

  valorApuestaSeisena: string = "1-6";
  valorApuestaCuadro: string = "0,1,2,3";
  valorApuestaCalle: string = "1,2,3";
  valorApuestaCaballo: string = "0,1";
  valorApuestaFinal: string = "0";

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

  seisenas: string[] = [];
  cuadros: string[] = [];
  calles: string[] = [];
  caballos: string[] = [];

  private usuarioSub: Subscription | null = null;
  private audioContext: AudioContext | null = null;

  mesaId: string = '';
  currentUser: string = '';
  esCreadorMesa: boolean = false;
  creadorEmail: string = '';

  estadoMesa: EstadoMesa | null = null;
  contadorSegundos: number = 0;
  private contadorSubscription: any = null;
  rondaActiva: boolean = false;
  skipActivado: boolean = false;
  autoSkipActivado: boolean = false;
  mensajesChat: MensajeChat[] = [];
  nuevoMensajeChat: string = '';
  mostrandoContador: boolean = false;

  private signalRCallbacks: { event: string; callback: (...args: any[]) => void }[] = [];

  constructor(
    private signalrService: SignalrService,
    private apiService: ApiService,
    private authService: AuthService,
    private toast: ToastService,
    private router: Router,
    private route: ActivatedRoute,
    private ngZone: NgZone,
  ) {
    this.inicializarColores();
    this.generarApuestasMultiples();
    this.inicializarNumerosVisuales();
  }

  async ngOnInit(): Promise<void> {
    this.route.queryParams.subscribe(params => {
      this.mesaId = params['mesa'] || '';
      this.creadorEmail = params['creador'] || '';
      if (this.mesaId) {
        this.unirseMesaRuleta();
        this.obtenerInfoMesa();
        this.configurarSignalR();
      }
    });

    this.usuarioSub = this.authService.usuario$.subscribe((usuario) => {
      this.usuarioActivo = usuario;
      if (usuario) this.saldo = usuario.saldo;
    });
    this.cargarHistorial();

    if (!this.mesaId) {
      await this.signalrService.stopConnection();
    } else {
      await this.signalrService.startConnection('/hubs/ruleta');
      this.obtenerUsuarioActual();
      await this.signalrService.invoke('ObtenerEstadoMesa', this.mesaId);
    }
  }

  private configurarSignalR(): void {
    const onError = (mensaje: string) => {
      this.girando = false;
      this.toast.error(mensaje);
    };
    this.signalrService.on("Error", onError);
    this.signalRCallbacks.push({ event: "Error", callback: onError });

    const onApuestaAgregada = (nombreJugador: string, apuesta: any) => {
      this.toast.info(`${nombreJugador} apostó ${apuesta.monto}€`);
    };
    this.signalrService.on("ApuestaAgregadaMesa", onApuestaAgregada);
    this.signalRCallbacks.push({ event: "ApuestaAgregadaMesa", callback: onApuestaAgregada });

    const onResultadoMesa = (data: any) => {
      const numeroGanador = data.numeroGanador;
      const miResultado = data.resultados[this.currentUser];
      if (miResultado) {
        this.saldo = miResultado.saldoActualizado;
        this.authService.actualizarSaldo(this.saldo);
        this.iniciarAnimacion(numeroGanador, miResultado.gano, miResultado.premio);
      } else {
        this.iniciarAnimacion(numeroGanador, false, 0);
      }
      this.girando = false;
      this.detenerContador();
      this.rondaActiva = false;
      this.skipActivado = false;
    };
    this.signalrService.on("ResultadoMesa", onResultadoMesa);
    this.signalRCallbacks.push({ event: "ResultadoMesa", callback: onResultadoMesa });

    const onEstadoMesa = (estado: EstadoMesa) => {
      this.estadoMesa = estado;
      this.actualizarInterfazPorEstado();
    };
    this.signalrService.on("EstadoMesaActualizado", onEstadoMesa);
    this.signalRCallbacks.push({ event: "EstadoMesaActualizado", callback: onEstadoMesa });

    const onJugadorHaApostado = (nombreJugador: string) => {
      if (this.estadoMesa) {
        const jugador = this.estadoMesa.jugadores.find(j => j.nombre === nombreJugador);
        if (jugador) jugador.haApostado = true;
      }
    };
    this.signalrService.on("JugadorHaApostado", onJugadorHaApostado);
    this.signalRCallbacks.push({ event: "JugadorHaApostado", callback: onJugadorHaApostado });

    const onRondaReiniciada = () => {
      this.toast.success("¡Nueva ronda! Tienes 15 segundos para apostar");
      this.iniciarContador();
      this.rondaActiva = true;
      this.skipActivado = false;
      this.apuestasActuales = [];
    };
    this.signalrService.on("RondaReiniciada", onRondaReiniciada);
    this.signalRCallbacks.push({ event: "RondaReiniciada", callback: onRondaReiniciada });

    const onNuevoMensaje = (msg: MensajeChat) => {
      this.mensajesChat.push(msg);
      if (this.mensajesChat.length > 50) this.mensajesChat.shift();
    };
    this.signalrService.on("NuevoMensajeChat", onNuevoMensaje);
    this.signalRCallbacks.push({ event: "NuevoMensajeChat", callback: onNuevoMensaje });
  }

  private actualizarInterfazPorEstado(): void {
    if (!this.estadoMesa) return;
    const usuarioActualObj = this.estadoMesa.jugadores.find(j => j.email === this.currentUser || j.nombre === this.currentUser);
    this.esCreadorMesa = this.estadoMesa.creadorEmail === this.currentUser;
    if (this.estadoMesa.rondaActiva && !this.rondaActiva && !this.girando) {
      this.iniciarContador();
      this.rondaActiva = true;
    }
    if (usuarioActualObj) {
      this.skipActivado = usuarioActualObj.listo;
      this.autoSkipActivado = usuarioActualObj.autoSkip;
    }
  }

  private async unirseMesaRuleta(): Promise<void> {
    if (!this.mesaId) return;
    await this.signalrService.invoke('UnirseMesaRuleta', this.mesaId);
  }

  private async obtenerInfoMesa(): Promise<void> {
    const mesas = JSON.parse(localStorage.getItem('mesasActivas') || '[]');
    const mesa = mesas.find((m: any) => m.id === this.mesaId);
    if (mesa) {
      this.esCreadorMesa = mesa.creador === this.currentUser;
      this.creadorEmail = mesa.creador;
    }
  }

  async iniciarContador(): Promise<void> {
    this.detenerContador();
    this.contadorSegundos = 15;
    this.mostrandoContador = true;
    this.contadorSubscription = interval(1000).subscribe(async () => {
      this.contadorSegundos--;
      if (this.contadorSegundos <= 0) {
        this.detenerContador();
        if (this.rondaActiva && !this.girando) {
          await this.girarMesaAutomatico();
        }
      }
    });
  }

  detenerContador(): void {
    if (this.contadorSubscription) {
      this.contadorSubscription.unsubscribe();
      this.contadorSubscription = null;
    }
    this.mostrandoContador = false;
  }

  async toggleSkip(): Promise<void> {
    if (!this.mesaId || this.girando) return;
    this.skipActivado = !this.skipActivado;
    await this.signalrService.invoke('JugadorListo', this.mesaId, this.skipActivado);
  }

  async toggleAutoSkip(): Promise<void> {
    if (!this.mesaId) return;
    this.autoSkipActivado = !this.autoSkipActivado;
    await this.signalrService.invoke('JugadorAutoSkip', this.mesaId, this.autoSkipActivado);
    if (this.autoSkipActivado && this.apuestasActuales.length > 0) {
      this.skipActivado = true;
      await this.signalrService.invoke('JugadorListo', this.mesaId, true);
    }
  }

  async girarMesaAutomatico(): Promise<void> {
    if (!this.mesaId || this.girando) return;
    this.girando = true;
    await this.signalrService.invoke('GirarMesa', this.mesaId);
  }

  async reiniciarRonda(): Promise<void> {
    if (!this.mesaId || !this.esCreadorMesa) {
      this.toast.warning("Solo el creador puede reiniciar la ronda");
      return;
    }
    await this.signalrService.invoke('ReiniciarRonda', this.mesaId);
  }

  async enviarMensaje(): Promise<void> {
    if (!this.nuevoMensajeChat.trim() || !this.mesaId) return;
    await this.signalrService.invoke('EnviarMensajeChat', this.mesaId, this.nuevoMensajeChat.trim());
    this.nuevoMensajeChat = '';
  }

  async apostar(): Promise<void> {
    if (!this.apuestaValida()) {
      this.toast.warning("Apuesta inválida o saldo insuficiente.");
      return;
    }
    if (this.mesaId) {
      for (const ap of this.apuestasActuales) {
        let valor: string;
        switch (ap.tipo) {
          case 'docena':
            const docenaNum = Math.floor((ap.numeros[0] - 1) / 12) + 1;
            valor = docenaNum.toString();
            break;
          case 'columna':
            const columnaNum = ((ap.numeros[0] - 1) % 3) + 1;
            valor = columnaNum.toString();
            break;
          case 'finales':
            valor = (ap.numeros[0] % 10).toString();
            break;
          case 'color':
            valor = ap.numeros[0] === 1 ? 'rojo' : 'negro';
            break;
          case 'paridad':
            valor = ap.numeros[0] === 2 ? 'par' : 'impar';
            break;
          case 'mitad':
            valor = ap.numeros[0] === 1 ? '1-18' : '19-36';
            break;
          case 'vecinos0':
          case 'tercio':
          case 'huerfanos':
          case 'juego0':
            valor = ap.tipo;
            break;
          default:
            valor = ap.numeros.join(',');
            break;
        }
        await this.signalrService.invoke('AgregarApuestaMesa', this.mesaId, {
          tipo: ap.tipo,
          valor: valor,
          monto: ap.monto
        });
      }
      this.toast.success("Apuestas enviadas a la mesa");
      this.limpiarApuestas();
      if (this.autoSkipActivado && !this.skipActivado) {
        this.skipActivado = true;
        await this.signalrService.invoke('JugadorListo', this.mesaId, true);
      }
    } else {
      this.girando = true;
      this.sonidoGiro();
      this.numeroGanador = null;
      for (let ap of this.apuestasActuales) {
        delete ap.estado;
      }
      const apuestasParaBackend = this.apuestasActuales.map(a => {
        let valor: string;
        switch (a.tipo) {
          case 'docena':
            const docenaNum = Math.floor((a.numeros[0] - 1) / 12) + 1;
            valor = docenaNum.toString();
            break;
          case 'columna':
            const columnaNum = ((a.numeros[0] - 1) % 3) + 1;
            valor = columnaNum.toString();
            break;
          case 'finales':
            valor = (a.numeros[0] % 10).toString();
            break;
          case 'color':
            valor = a.numeros[0] === 1 ? 'rojo' : 'negro';
            break;
          case 'paridad':
            valor = a.numeros[0] === 2 ? 'par' : 'impar';
            break;
          case 'mitad':
            valor = a.numeros[0] === 1 ? '1-18' : '19-36';
            break;
          case 'vecinos0':
          case 'tercio':
          case 'huerfanos':
          case 'juego0':
            valor = a.tipo;
            break;
          case 'pleno':
            valor = a.numeros[0].toString();
            break;
          default:
            valor = a.numeros.join(',');
            break;
        }
        return {
          tipo: a.tipo,
          valor: valor,
          monto: a.monto,
        };
      });
      this.guardarEstadoHistorial();
      try {
        const resultado: any = await this.apiService.post('/ruleta/girar-multiple', apuestasParaBackend).toPromise();
        this.saldo = resultado.saldoActualizado;
        this.authService.actualizarSaldo(resultado.saldoActualizado);
        this.iniciarAnimacion(resultado.numeroGanador, resultado.gano, resultado.premio);
      } catch (error: any) {
        this.girando = false;
        this.toast.error(error.error?.mensaje || "Error al procesar la apuesta");
      }
    }
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
    let elemento: Element | null = null;
    if (numero === 0) {
      elemento = document.querySelector('.numero-casilla.cero');
    } else {
      elemento = document.querySelector(`.numero-casilla[data-numero="${numero}"]`);
    }
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

  private getPosicionExterna(evento: MouseEvent): { x: number; y: number } {
    const contenedor = document.querySelector('.tapete-wrapper') as HTMLElement;
    if (!contenedor) return { x: 50, y: 50 };
    const contRect = contenedor.getBoundingClientRect();
    return {
      x: ((evento.clientX - contRect.left) / contRect.width) * 100,
      y: ((evento.clientY - contRect.top) / contRect.height) * 100,
    };
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
      a => a.tipo === tipo && JSON.stringify(a.numeros) === JSON.stringify(numeros)
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
      });
    }
    this.sonidoSeleccion();
    this.guardarEstadoHistorial();
  }

  agregarApuestaPleno(num: number): void {
    const pos = this.getPosicionNumero(num);
    this.agregarApuestaAcumulada('pleno', [num], pos.x, pos.y);
  }

  agregarApuestaCaballo(num1: number, num2: number): void {
    const pos = this.getPosicionEntreNumeros(num1, num2);
    this.agregarApuestaAcumulada('caballo', [num1, num2], pos.x, pos.y);
  }

  agregarApuestaCalle(num1: number, num2: number, num3: number): void {
    const pos = this.getPosicionEntreNumeros(num1, num3);
    this.agregarApuestaAcumulada('calle', [num1, num2, num3], pos.x, pos.y);
  }

  agregarApuestaCuadro(num1: number, num2: number, num3: number, num4: number): void {
    const pos = this.getPosicionEntreNumeros(num1, num4);
    this.agregarApuestaAcumulada('cuadro', [num1, num2, num3, num4], pos.x, pos.y);
  }

  agregarApuestaSeisena(num1: number, num2: number, num3: number, num4: number, num5: number, num6: number): void {
    const pos = this.getPosicionEntreNumeros(num1, num6);
    this.agregarApuestaAcumulada('seisena', [num1, num2, num3, num4, num5, num6], pos.x, pos.y);
  }

  agregarApuestaSeisenaDesdeSelect(): void {
    const partes = this.valorApuestaSeisena.split('-');
    if (partes.length === 2) {
      const inicio = parseInt(partes[0]);
      const fin = parseInt(partes[1]);
      const numeros: number[] = [];
      for (let i = inicio; i <= fin; i++) numeros.push(i);
      if (numeros.length === 6) {
        const pos = this.getPosicionEntreNumeros(numeros[0], numeros[5]);
        this.agregarApuestaAcumulada('seisena', numeros, pos.x, pos.y);
      }
    }
  }

  agregarApuestaCuadroDesdeSelect(): void {
    const numeros = this.valorApuestaCuadro.split(',').map(n => parseInt(n));
    if (numeros.length === 4) {
      const pos = this.getPosicionEntreNumeros(numeros[0], numeros[3]);
      this.agregarApuestaAcumulada('cuadro', numeros, pos.x, pos.y);
    }
  }

  agregarApuestaCalleDesdeSelect(): void {
    const numeros = this.valorApuestaCalle.split(',').map(n => parseInt(n));
    if (numeros.length === 3) {
      const pos = this.getPosicionEntreNumeros(numeros[0], numeros[2]);
      this.agregarApuestaAcumulada('calle', numeros, pos.x, pos.y);
    }
  }

  agregarApuestaCaballoDesdeSelect(): void {
    const numeros = this.valorApuestaCaballo.split(',').map(n => parseInt(n));
    if (numeros.length === 2) {
      const pos = this.getPosicionEntreNumeros(numeros[0], numeros[1]);
      this.agregarApuestaAcumulada('caballo', numeros, pos.x, pos.y);
    }
  }

  agregarApuestaExterna(tipo: ApuestaVisual['tipo'], numeros: number[], evento: MouseEvent): void {
    const pos = this.getPosicionExterna(evento);
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
      this.agregarApuestaExterna(tipo as ApuestaVisual['tipo'], numeros, window.event as MouseEvent);
    }
  }

  seleccionarFinal(): void {
    const digito = parseInt(this.valorApuestaFinal);
    const numeros = [];
    for (let i = digito; i <= 36; i += 10) {
      if (i !== 0) numeros.push(i);
    }
    if (digito === 0) numeros.push(0, 10, 20, 30);
    else numeros.push(digito, digito+10, digito+20, digito+30);
    this.agregarApuestaExterna('finales', numeros, window.event as MouseEvent);
  }

  apuestaValida(): boolean {
    return this.apuestasActuales.length > 0 && this.montoTotalApostado <= this.saldo;
  }

  getFilaVisual(fila: number): number[] {
    if (fila === 0) return [3,6,9,12,15,18,21,24,27,30,33,36];
    if (fila === 1) return [2,5,8,11,14,17,20,23,26,29,32,35];
    return [1,4,7,10,13,16,19,22,25,28,31,34];
  }

  obtenerHotspotsCaballo(): { posX: number; posY: number; num1: number; num2: number }[] {
    const hotspots: { posX: number; posY: number; num1: number; num2: number }[] = [];
    for (let fila = 0; fila < 3; fila++) {
      const numerosFila = this.getFilaVisual(fila);
      for (let col = 0; col < 11; col++) {
        hotspots.push({
          posX: 0, posY: 0, num1: numerosFila[col], num2: numerosFila[col + 1]
        });
      }
    }
    for (let fila = 0; fila < 3; fila++) {
      const numerosFila = this.getFilaVisual(fila);
      if (fila === 0) {
        for (let i = 0; i < 12; i++) {
          hotspots.push({ posX: 0, posY: 0, num1: 0, num2: numerosFila[i] });
        }
      }
      if (fila < 2) {
        const numerosFilaSiguiente = this.getFilaVisual(fila + 1);
        for (let col = 0; col < 12; col++) {
          hotspots.push({ posX: 0, posY: 0, num1: numerosFila[col], num2: numerosFilaSiguiente[col] });
        }
      }
    }
    hotspots.forEach(h => {
      const pos = this.getPosicionEntreNumeros(h.num1, h.num2);
      h.posX = pos.x;
      h.posY = pos.y;
    });
    return hotspots;
  }

  obtenerHotspotsCalle(): { posX: number; posY: number; num1: number; num2: number; num3: number }[] {
    const hotspots: { posX: number; posY: number; num1: number; num2: number; num3: number }[] = [];
    for (let fila = 0; fila < 3; fila++) {
      const numerosFila = this.getFilaVisual(fila);
      for (let col = 0; col < 10; col++) {
        hotspots.push({
          posX: 0, posY: 0,
          num1: numerosFila[col], num2: numerosFila[col + 1], num3: numerosFila[col + 2]
        });
      }
    }
    hotspots.push({ posX: 0, posY: 0, num1: 0, num2: 1, num3: 2 });
    hotspots.push({ posX: 0, posY: 0, num1: 0, num2: 2, num3: 3 });
    hotspots.forEach(h => {
      const pos = this.getPosicionEntreNumeros(h.num1, h.num3);
      h.posX = pos.x;
      h.posY = pos.y;
    });
    return hotspots;
  }

  obtenerHotspotsCuadro(): { posX: number; posY: number; num1: number; num2: number; num3: number; num4: number }[] {
    const hotspots: { posX: number; posY: number; num1: number; num2: number; num3: number; num4: number }[] = [];
    for (let fila = 0; fila < 2; fila++) {
      const filaActual = this.getFilaVisual(fila);
      const filaSiguiente = this.getFilaVisual(fila + 1);
      for (let col = 0; col < 11; col++) {
        hotspots.push({
          posX: 0, posY: 0,
          num1: filaActual[col], num2: filaActual[col + 1],
          num3: filaSiguiente[col], num4: filaSiguiente[col + 1]
        });
      }
    }
    const primeraFila = this.getFilaVisual(0);
    hotspots.push({ posX: 0, posY: 0, num1: 0, num2: primeraFila[0], num3: 1, num4: primeraFila[1] });
    hotspots.push({ posX: 0, posY: 0, num1: 0, num2: primeraFila[1], num3: 2, num4: primeraFila[2] });
    hotspots.forEach(h => {
      const pos = this.getPosicionEntreNumeros(h.num1, h.num4);
      h.posX = pos.x;
      h.posY = pos.y;
    });
    return hotspots;
  }

  obtenerHotspotsSeisena(): { posX: number; posY: number; num1: number; num2: number; num3: number; num4: number; num5: number; num6: number }[] {
    const hotspots: { posX: number; posY: number; num1: number; num2: number; num3: number; num4: number; num5: number; num6: number }[] = [];
    for (let fila = 0; fila < 2; fila++) {
      const filaActual = this.getFilaVisual(fila);
      const filaSiguiente = this.getFilaVisual(fila + 1);
      for (let col = 0; col < 10; col++) {
        hotspots.push({
          posX: 0, posY: 0,
          num1: filaActual[col], num2: filaActual[col + 1], num3: filaActual[col + 2],
          num4: filaSiguiente[col], num5: filaSiguiente[col + 1], num6: filaSiguiente[col + 2]
        });
      }
    }
    hotspots.forEach(h => {
      const pos = this.getPosicionEntreNumeros(h.num1, h.num6);
      h.posX = pos.x;
      h.posY = pos.y;
    });
    return hotspots;
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
    for (let apuesta of this.apuestasActuales) {
      const gano = this.calcularPremioLocal(apuesta.tipo, apuesta.numeros, numeroGanador) > 0;
      apuesta.estado = gano ? 'win' : 'lose';
    }
  }

  private calcularPremioLocal(tipo: string, numerosApuesta: number[], numeroGanador: number): number {
    tipo = tipo.toLowerCase();
    switch (tipo) {
      case 'pleno': return numerosApuesta[0] === numeroGanador ? 36 : 0;
      case 'caballo': return numerosApuesta.includes(numeroGanador) ? 18 : 0;
      case 'calle': return numerosApuesta.includes(numeroGanador) ? 12 : 0;
      case 'cuadro': return numerosApuesta.includes(numeroGanador) ? 9 : 0;
      case 'seisena': return numerosApuesta.includes(numeroGanador) ? 6 : 0;
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
        const esBaja = numeroGanador <= 18;
        const apuestaBaja = numerosApuesta[0] === 1;
        return (esBaja === apuestaBaja) ? 2 : 0;
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

    this.ultimasApuestas = JSON.parse(JSON.stringify(this.apuestasActuales));

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
          this.agregarAlHistorial(numeroFinal);
          this.evaluarResultadoApuestas(numeroFinal);
          this.mostrarModalGanador = true;
          gano ? this.sonidoGanar() : this.sonidoPerder();
          if (this.tiempoLimpiarApuestas) clearTimeout(this.tiempoLimpiarApuestas);
          this.tiempoLimpiarApuestas = setTimeout(() => {
            this.apuestasActuales = [];
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
    const usuario = localStorage.getItem('usuario') ? JSON.parse(localStorage.getItem('usuario')!) : null;
    this.currentUser = usuario?.nombreUsuario || usuario?.nombre || 'Usuario';
  }

  async volverAlLobby(): Promise<void> {
    await this.signalrService.startConnection('/hubs/lobby');
    this.router.navigate([RUTAS.lobby]);
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

  get jugadoresLista(): JugadorMesa[] {
    return this.estadoMesa?.jugadores || [];
  }

  get contadorVisible(): boolean {
    return this.mostrandoContador && this.rondaActiva && !this.girando;
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
    this.detenerContador();
    this.signalRCallbacks.forEach(cb => {
      this.signalrService.off(cb.event, cb.callback);
    });
    this.signalRCallbacks = [];
  }
}