using System.Collections.Concurrent;

namespace TrickedDice.Api.Services
{
    public class BlackjackService
    {
        private static readonly string[] Palos = { "C", "D", "T", "P" };
        private static readonly string[] Valores = { "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K", "A" };

        private readonly ConcurrentDictionary<string, PartidaBlackjack> _partidas = new();

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

        public string NuevaPartida(string email, decimal monto)
        {
            var id = Guid.NewGuid().ToString("N")[..8];
            var baraja = CrearBaraja();
            var manoJugador = RepartirCartas(baraja, 2);
            var manoCrupier = RepartirCartas(baraja.Except(manoJugador).ToList(), 1);
            _partidas[id] = new PartidaBlackjack
            {
                Email = email,
                Monto = monto,
                ManoJugador = manoJugador,
                ManoCrupier = manoCrupier,
                Baraja = baraja.Except(manoJugador).Except(manoCrupier).ToList()
            };
            return id;
        }

        public PartidaBlackjack? ObtenerPartida(string id)
        {
            _partidas.TryGetValue(id, out var partida);
            return partida;
        }

        public string? PedirCarta(string idPartida)
        {
            var partida = ObtenerPartida(idPartida);
            if (partida == null || partida.Terminada) return null;
            var carta = RepartirCartas(partida.Baraja, 1).FirstOrDefault();
            if (carta != null)
            {
                partida.ManoJugador.Add(carta);
                partida.Baraja.Remove(carta);
            }
            return carta;
        }

        public void Plantarse(string idPartida)
        {
            var partida = ObtenerPartida(idPartida);
            if (partida == null) return;
            while (ValorMano(partida.ManoCrupier) < 17)
            {
                var carta = RepartirCartas(partida.Baraja, 1).FirstOrDefault();
                if (carta == null) break;
                partida.ManoCrupier.Add(carta);
                partida.Baraja.Remove(carta);
            }
        }

        public string ObtenerResultado(string idPartida)
        {
            var partida = ObtenerPartida(idPartida);
            if (partida == null) return "error";
            int puntosJugador = ValorMano(partida.ManoJugador);
            int puntosCrupier = ValorMano(partida.ManoCrupier);

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
                if (int.TryParse(valor, out int num))
                {
                    total += num;
                }
                else if (valor == "A")
                {
                    ases++;
                    total += 11;
                }
                else
                {
                    total += 10;
                }
            }
            while (total > 21 && ases > 0)
            {
                total -= 10;
                ases--;
            }
            return total;
        }

        public void EliminarPartida(string id)
        {
            _partidas.TryRemove(id, out _);
        }
    }

    public class PartidaBlackjack
    {
        public string Email { get; set; } = string.Empty;
        public decimal Monto { get; set; }
        public List<string> ManoJugador { get; set; } = new();
        public List<string> ManoCrupier { get; set; } = new();
        public List<string> Baraja { get; set; } = new();
        public bool Terminada { get; set; }
    }
}