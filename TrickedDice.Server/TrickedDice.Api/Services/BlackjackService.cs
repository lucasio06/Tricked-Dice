using System.Collections.Concurrent;

namespace TrickedDice.Api.Services
{
    public class BlackjackService
    {
        private static readonly string[] Palos = { "C", "D", "T", "P" };
        private static readonly string[] Valores = { "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K", "A" };

        private readonly ConcurrentDictionary<string, MesaBlackjack> _mesas = new();
        private readonly ConcurrentDictionary<string, string> _partidaToMesa = new();

        public List<string> CrearBaraja()
        {
            var baraja = new List<string>();
            foreach (var valor in Valores)
                foreach (var palo in Palos)
                    baraja.Add(valor + palo);
            return baraja;
        }

        public List<string> RepartirCartas(List<string> baraja, int cantidad)
        {
            var random = new Random();
            return baraja.OrderBy(x => random.Next()).Take(cantidad).ToList();
        }

        public MesaBlackjack? ObtenerMesa(string roomId)
        {
            if (_mesas.TryGetValue(roomId, out var mesa)) return mesa;
            return null;
        }

        public string NuevaPartida(string email, string nombreUsuario, decimal monto, string roomId)
        {
            var idPartida = Guid.NewGuid().ToString("N")[..8];
            var mesa = _mesas.GetOrAdd(roomId, id => new MesaBlackjack { RoomId = id, Baraja = CrearBaraja() });

            if (mesa.ManoCrupier.Count == 0)
            {
                mesa.ManoCrupier = RepartirCartas(mesa.Baraja, 1);
            }

            mesa.ManosJugadores[idPartida] = new PartidaBlackjack
            {
                Email = email,
                NombreUsuario = nombreUsuario,
                Monto = monto,
                ManoJugador = RepartirCartas(mesa.Baraja, 2),
                Terminada = false
            };

            _partidaToMesa[idPartida] = roomId;
            return idPartida;
        }

        public PartidaBlackjack? ObtenerPartida(string idPartida)
        {
            if (_partidaToMesa.TryGetValue(idPartida, out var roomId))
                if (_mesas.TryGetValue(roomId, out var mesa))
                    if (mesa.ManosJugadores.TryGetValue(idPartida, out var partida))
                        return partida;
            return null;
        }

        public string? PedirCarta(string idPartida)
        {
            if (!_partidaToMesa.TryGetValue(idPartida, out var roomId)) return null;
            if (!_mesas.TryGetValue(roomId, out var mesa)) return null;
            if (!mesa.ManosJugadores.TryGetValue(idPartida, out var partida)) return null;
            if (partida.Terminada) return null;

            var carta = RepartirCartas(mesa.Baraja, 1).FirstOrDefault();
            if (carta != null)
            {
                partida.ManoJugador.Add(carta);
                mesa.Baraja.Remove(carta);
            }
            return carta;
        }

        public void Plantarse(string idPartida)
        {
            if (!_partidaToMesa.TryGetValue(idPartida, out var roomId)) return;
            if (!_mesas.TryGetValue(roomId, out var mesa)) return;
            if (!mesa.ManosJugadores.TryGetValue(idPartida, out var partida)) return;

            partida.Terminada = true;

            if (mesa.ManosJugadores.Values.All(p => p.Terminada))
            {
                while (ValorMano(mesa.ManoCrupier) < 17)
                {
                    var carta = RepartirCartas(mesa.Baraja, 1).FirstOrDefault();
                    if (carta == null) break;
                    mesa.ManoCrupier.Add(carta);
                    mesa.Baraja.Remove(carta);
                }
            }
        }

        public string ObtenerResultado(string idPartida)
        {
            if (!_partidaToMesa.TryGetValue(idPartida, out var roomId) || !_mesas.TryGetValue(roomId, out var mesa) || !mesa.ManosJugadores.TryGetValue(idPartida, out var partida))
                return "error";

            int puntosJugador = ValorMano(partida.ManoJugador);
            int puntosCrupier = ValorMano(mesa.ManoCrupier);

            if (puntosJugador > 21) return "crupier";
            if (puntosCrupier > 21) return "jugador";
            if (puntosJugador == puntosCrupier) return "empate";
            return puntosJugador > puntosCrupier ? "jugador" : "crupier";
        }

        public int ValorMano(List<string> mano)
        {
            int total = 0;
            int ases = 0;
            foreach (var carta in mano)
            {
                var valor = carta.Length == 3 ? carta[..2] : carta[..1];
                if (int.TryParse(valor, out int num)) total += num;
                else if (valor == "A") { ases++; total += 11; }
                else total += 10;
            }
            while (total > 21 && ases > 0)
            {
                total -= 10;
                ases--;
            }
            return total;
        }

        public void LimpiarMesa(string roomId)
        {
            if (_mesas.TryGetValue(roomId, out var mesa))
            {
                mesa.ManoCrupier.Clear();
                mesa.ManosJugadores.Clear();
                mesa.Baraja = CrearBaraja();
            }
        }
    }

    public class MesaBlackjack
    {
        public string RoomId { get; set; } = string.Empty;
        public List<string> ManoCrupier { get; set; } = new();
        public List<string> Baraja { get; set; } = new();
        public ConcurrentDictionary<string, PartidaBlackjack> ManosJugadores { get; set; } = new();
    }

    public class PartidaBlackjack
    {
        public string Email { get; set; } = string.Empty;
        public string NombreUsuario { get; set; } = string.Empty;
        public decimal Monto { get; set; }
        public List<string> ManoJugador { get; set; } = new();
        public bool Terminada { get; set; }
    }
}