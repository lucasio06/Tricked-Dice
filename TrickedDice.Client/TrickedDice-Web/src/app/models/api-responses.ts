export interface LoginResponse {
  token: string;
  nombre: string;
  saldo: number;
}

export interface UsuarioPerfil {
  nombre: string;
  email: string;
  saldo: number;
}

export interface RecargarResponse {
  saldo: number;
}

export interface GiroRuletaResponse {
  numeroGanador: number;
  gano: boolean;
  premio: number;
  saldoActualizado: number;
}

export interface RepartirResponse {
  mano: string[];
  saldoActualizado: number;
}

export interface CambiarResponse {
  manoFinal: string[];
  premio: number;
  nombreMano: string;
  saldoActualizado: number;
}

export interface UsuarioAdmin {
  idUsuario: number;
  email: string;
  nombre: string;
  primerApellido: string;
  nombreUsuario: string;
  saldo: number;
  fechaNacimiento: string;
  dni: string;
  baneado: boolean;
}

export interface TransaccionAdmin {
  idTransaccion: number;
  fecha: string;
  cantidad: number;
  tipo: string;
  email: string;
  nombre: string;
}

export interface Estadisticas {
  totalUsuarios: number;
  totalRecargas: number;
  totalApostado: number;
  totalPremios: number;
  beneficio: number;
  saldoTotal: number;
}

export interface Transaccion {
  fecha: string;
  cantidad: number;
  tipo: string;
}