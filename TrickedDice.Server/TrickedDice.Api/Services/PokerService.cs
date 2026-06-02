using System.Collections.Concurrent;
using System.Linq;

namespace TrickedDice.Api.Services
{
    public enum PokerFase { Preflop, Flop, Turn, River, Showdown }

    public class PokerService
    {
        private static readonly string[] Palos = { "C", "D", "T", "P" };
        private static readonly string[] Valores = { "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K", "A" };

        private readonly ConcurrentDictionary<string, MesaPoker> _mesas = new();

        public List<string> CrearBaraja()
        {
            var baraja = new List<string>();
            foreach (var valor in Valores)
                foreach (var palo in Palos)
                    baraja.Add(valor + palo);
            
            return baraja.OrderBy(x => Random.Shared.Next()).ToList();
        }

        public MesaPoker ObtenerOCrearMesa(string roomId)
        {
            return _mesas.GetOrAdd(roomId, id => new MesaPoker { RoomId = id });
        }

        public MesaPoker? ObtenerMesa(string roomId)
        {
            _mesas.TryGetValue(roomId, out var mesa);
            return mesa;
        }

        public void IniciarMano(string roomId)
        {
            var mesa = ObtenerMesa(roomId);
            if (mesa == null || mesa.Jugadores.Count < 1) return;

            lock (mesa.LockObj)
            {
                mesa.Baraja = CrearBaraja();
                mesa.CartasComunitarias.Clear();
                mesa.Bote = 0;
                mesa.Fase = PokerFase.Preflop;
                mesa.ApuestaActual = 0;
                mesa.UltimoMensaje = "";

                foreach (var jugador in mesa.Jugadores.Values)
                {
                    jugador.Mano.Clear();
                    jugador.ApuestaActual = 0;
                    jugador.Folded = false;
                    jugador.AllIn = false;
                    jugador.HaActuado = false;
                    
                    jugador.Mano.Add(SacarCarta(mesa.Baraja));
                    jugador.Mano.Add(SacarCarta(mesa.Baraja));
                }
                
                mesa.TurnoActualEmail = mesa.Jugadores.Keys.FirstOrDefault() ?? "";
                AvanzarTurno(mesa);
            }
        }

        public void AvanzarTurno(MesaPoker mesa)
        {
            var jugadoresActivos = mesa.Jugadores.Values.Where(j => !j.Folded).ToList();

            if (jugadoresActivos.Count == 1 && mesa.Jugadores.Count > 1)
            {
                FinalizarMano(mesa, jugadoresActivos[0].Email);
                return;
            }

            var jugadoresQueDebenHablar = jugadoresActivos.Where(j => !j.AllIn).ToList();
            
            bool rondaTerminada = false;
            if (jugadoresQueDebenHablar.Any())
            {
                rondaTerminada = jugadoresQueDebenHablar.All(j => j.ApuestaActual == mesa.ApuestaActual && j.HaActuado);
            }
            else
            {
                rondaTerminada = true;
            }

            if (rondaTerminada)
            {
                if (mesa.Fase == PokerFase.River)
                {
                    mesa.Fase = PokerFase.Showdown;
                    ResolverShowdown(mesa);
                }
                else
                {
                    AvanzarFase(mesa);
                    AsignarSiguienteTurno(mesa, resetearRonda: true);
                }
                return;
            }

            AsignarSiguienteTurno(mesa, resetearRonda: false);
        }

        public void AvanzarFase(MesaPoker mesa)
        {
            lock (mesa.LockObj)
            {
                foreach(var j in mesa.Jugadores.Values)
                {
                    mesa.Bote += j.ApuestaActual;
                    j.ApuestaActual = 0;
                    j.HaActuado = false;
                }
                mesa.ApuestaActual = 0;

                if (mesa.Fase == PokerFase.Preflop)
                {
                    mesa.Fase = PokerFase.Flop;
                    mesa.CartasComunitarias.Add(SacarCarta(mesa.Baraja));
                    mesa.CartasComunitarias.Add(SacarCarta(mesa.Baraja));
                    mesa.CartasComunitarias.Add(SacarCarta(mesa.Baraja));
                }
                else if (mesa.Fase == PokerFase.Flop)
                {
                    mesa.Fase = PokerFase.Turn;
                    mesa.CartasComunitarias.Add(SacarCarta(mesa.Baraja));
                }
                else if (mesa.Fase == PokerFase.Turn)
                {
                    mesa.Fase = PokerFase.River;
                    mesa.CartasComunitarias.Add(SacarCarta(mesa.Baraja));
                }
                else if (mesa.Fase == PokerFase.River)
                {
                    mesa.Fase = PokerFase.Showdown;
                }
            }
        }

        private void AsignarSiguienteTurno(MesaPoker mesa, bool resetearRonda)
        {
            if (mesa.OrdenJugadores.Count != mesa.Jugadores.Count)
                mesa.OrdenJugadores = mesa.Jugadores.Keys.ToList();

            if (!mesa.OrdenJugadores.Any()) return;

            int indiceActual = mesa.OrdenJugadores.IndexOf(mesa.TurnoActualEmail);
            
            if (resetearRonda || indiceActual == -1) 
                indiceActual = -1;

            bool encontrado = false;
            for (int i = 1; i <= mesa.OrdenJugadores.Count; i++)
            {
                int siguienteIndice = (indiceActual + i) % mesa.OrdenJugadores.Count;
                string siguienteEmail = mesa.OrdenJugadores[siguienteIndice];
                var j = mesa.Jugadores[siguienteEmail];

                if (!j.Folded && !j.AllIn)
                {
                    mesa.TurnoActualEmail = siguienteEmail;
                    encontrado = true;
                    return;
                }
            }

            if (!encontrado)
            {
                mesa.TurnoActualEmail = "";
                if (mesa.Fase != PokerFase.Showdown)
                {
                    AvanzarTurno(mesa);
                }
            }
        }

        private void ResolverShowdown(MesaPoker mesa)
        {
            var jugadoresActivos = mesa.Jugadores.Values.Where(j => !j.Folded).ToList();
            
            if (jugadoresActivos.Count == 0)
            {
                mesa.UltimoMensaje = "Te has retirado. Fin de la mano.";
                mesa.Bote = 0;
                mesa.TurnoActualEmail = "";
                return;
            }

            if (jugadoresActivos.Count == 1)
            {
                FinalizarMano(mesa, jugadoresActivos[0].Email);
                return;
            }
            
            long maxScore = -1;
            List<string> ganadores = new();
            string mejorManoNombre = "";

            foreach (var j in jugadoresActivos)
            {
                try 
                {
                    var evaluacion = EvaluarManoHoldem(j.Mano, mesa.CartasComunitarias);
                    if (evaluacion.Puntuacion > maxScore)
                    {
                        maxScore = evaluacion.Puntuacion;
                        ganadores.Clear();
                        ganadores.Add(j.Email);
                        mejorManoNombre = evaluacion.NombreMano;
                    }
                    else if (evaluacion.Puntuacion == maxScore)
                    {
                        ganadores.Add(j.Email);
                    }
                }
                catch (Exception)
                {
                }
            }

            if (ganadores.Any())
            {
                decimal premioPorGanador = mesa.Bote / ganadores.Count;
                List<string> nombresGanadores = new();
                
                foreach (var emailGanador in ganadores)
                {
                    var ganador = mesa.Jugadores[emailGanador];
                    ganador.Saldo += premioPorGanador;
                    nombresGanadores.Add(ganador.NombreUsuario);
                }

                if (ganadores.Count == 1)
                {
                    mesa.UltimoMensaje = $"{nombresGanadores[0]} GANA {mesa.Bote}€ con {mejorManoNombre}";
                }
                else
                {
                    mesa.UltimoMensaje = $"¡EMPATE! Bote repartido con {mejorManoNombre}";
                }
            }
            else
            {
                mesa.UltimoMensaje = "Error en el Showdown. Se devuelve el dinero.";
            }

            mesa.Bote = 0;
            mesa.TurnoActualEmail = "";
        }

        private void FinalizarMano(MesaPoker mesa, string emailGanadorPorAbandono)
        {
            foreach(var j in mesa.Jugadores.Values)
            {
                mesa.Bote += j.ApuestaActual;
                j.ApuestaActual = 0;
            }
            mesa.ApuestaActual = 0;

            if (mesa.Jugadores.TryGetValue(emailGanadorPorAbandono, out var ganador))
            {
                ganador.Saldo += mesa.Bote;
                mesa.UltimoMensaje = $"{ganador.NombreUsuario} GANA {mesa.Bote}€ (Los demás se retiraron)";
            }

            mesa.Bote = 0;
            mesa.Fase = PokerFase.Showdown;
            mesa.TurnoActualEmail = "";
        }

        private string SacarCarta(List<string> baraja)
        {
            var carta = baraja[0];
            baraja.RemoveAt(0);
            return carta;
        }

        public (long Puntuacion, string NombreMano, List<string> Mejores5) EvaluarManoHoldem(List<string> manoJugador, List<string> comunitarias)
        {
            var todasLasCartas = new List<string>(manoJugador);
            todasLasCartas.AddRange(comunitarias);
            var combinaciones = ObtenerCombinacionesDe5(todasLasCartas);
            
            long maxPuntuacion = -1;
            string mejorNombre = "";
            List<string> mejores5 = new();

            foreach (var comb in combinaciones)
            {
                var evaluacion = Puntuar5Cartas(comb);
                if (evaluacion.Puntuacion > maxPuntuacion)
                {
                    maxPuntuacion = evaluacion.Puntuacion;
                    mejorNombre = evaluacion.NombreMano;
                    mejores5 = comb;
                }
            }

            return (maxPuntuacion, mejorNombre, mejores5);
        }

        private List<List<string>> ObtenerCombinacionesDe5(List<string> cartas)
        {
            var result = new List<List<string>>();
            for(int i = 0; i < 6; i++)
            {
                for(int j = i + 1; j < 7; j++)
                {
                    var comb = new List<string>(cartas);
                    comb.RemoveAt(j);
                    comb.RemoveAt(i);
                    result.Add(comb);
                }
            }
            return result;
        }

        private (long Puntuacion, string NombreMano) Puntuar5Cartas(List<string> mano)
        {
            var cartas = mano.Select(c => 
            {
                string vStr = c.Length == 3 ? c.Substring(0, 2) : c.Substring(0, 1);
                string pStr = c.Substring(c.Length - 1);
                int vInt = vStr switch { "J" => 11, "Q" => 12, "K" => 13, "A" => 14, _ => int.Parse(vStr) };
                return new CartaPoker { Valor = vInt, Palo = pStr, Original = c };
            }).OrderByDescending(c => c.Valor).ToList();

            bool esColor = cartas.GroupBy(c => c.Palo).Any(g => g.Count() == 5);
            
            bool esEscalera = true;
            for (int i = 0; i < 4; i++) {
                if (cartas[i].Valor - 1 != cartas[i + 1].Valor) esEscalera = false;
            }
            
            if (!esEscalera && cartas[0].Valor == 14 && cartas[1].Valor == 5 && cartas[2].Valor == 4 && cartas[3].Valor == 3 && cartas[4].Valor == 2) 
            {
                esEscalera = true;
                var asCard = cartas[0];
                cartas.RemoveAt(0);
                cartas.Add(asCard);
            }

            var agrupados = cartas.GroupBy(c => c.Valor).OrderByDescending(g => g.Count()).ThenByDescending(g => g.Key).ToList();
            
            long categoria = 0;
            string nombre = "";

            if (esColor && esEscalera && cartas[0].Valor == 14) { categoria = 9; nombre = "ESCALERA REAL"; }
            else if (esColor && esEscalera) { categoria = 8; nombre = "ESCALERA DE COLOR"; }
            else if (agrupados[0].Count() == 4) { categoria = 7; nombre = "POKER"; }
            else if (agrupados[0].Count() == 3 && agrupados[1].Count() == 2) { categoria = 6; nombre = "FULL HOUSE"; }
            else if (esColor) { categoria = 5; nombre = "COLOR"; }
            else if (esEscalera) { categoria = 4; nombre = "ESCALERA"; }
            else if (agrupados[0].Count() == 3) { categoria = 3; nombre = "TRIO"; }
            else if (agrupados[0].Count() == 2 && agrupados[1].Count() == 2) { categoria = 2; nombre = "DOBLE PAREJA"; }
            else if (agrupados[0].Count() == 2) { categoria = 1; nombre = "PAREJA"; }
            else { categoria = 0; nombre = "CARTA ALTA"; }

            long score = categoria * 10000000000L;
            long multiplicador = 100000000L;
            foreach (var grupo in agrupados)
            {
                foreach (var c in grupo)
                {
                    score += c.Valor * multiplicador;
                    multiplicador /= 100;
                }
            }

            return (score, nombre);
        }
    }

    public class MesaPoker
    {
        public string RoomId { get; set; } = string.Empty;
        public List<string> Baraja { get; set; } = new();
        public List<string> CartasComunitarias { get; set; } = new();
        public ConcurrentDictionary<string, JugadorPoker> Jugadores { get; set; } = new();
        public List<string> OrdenJugadores { get; set; } = new();
        public decimal Bote { get; set; }
        public decimal ApuestaActual { get; set; }
        public PokerFase Fase { get; set; }
        public string TurnoActualEmail { get; set; } = string.Empty;
        public string UltimoMensaje { get; set; } = string.Empty;
        
        public readonly object LockObj = new object();
    }

    public class JugadorPoker
    {
        public string Email { get; set; } = string.Empty;
        public string NombreUsuario { get; set; } = string.Empty;
        public decimal Saldo { get; set; }
        public List<string> Mano { get; set; } = new();
        public decimal ApuestaActual { get; set; }
        public bool Folded { get; set; }
        public bool AllIn { get; set; }
        public bool HaActuado { get; set; }
    }

    public class CartaPoker
    {
        public int Valor { get; set; }
        public string Palo { get; set; } = string.Empty;
        public string Original { get; set; } = string.Empty;
    }
}