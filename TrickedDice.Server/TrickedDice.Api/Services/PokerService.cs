namespace TrickedDice.Api.Services
{
    public class PokerService
    {
        private static readonly string[] Palos = { "C", "D", "T", "P" };
        private static readonly string[] Valores = { "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K", "A" };

        public List<string> CrearBaraja()
        {
            var baraja = new List<string>();
            foreach (var valor in Valores)
            {
                foreach (var palo in Palos)
                {
                    baraja.Add(valor + palo);
                }
            }
            return baraja;
        }

        public List<string> RepartirMano(List<string> baraja, int numCartas)
        {
            var random = new Random();
            return baraja.OrderBy(x => random.Next()).Take(numCartas).ToList();
        }

        public List<string> CambiarCartas(List<string> manoActual, List<int> indicesACambiar, List<string> barajaDisponible)
        {
            var random = new Random();
            var cartasRestantes = barajaDisponible.Except(manoActual).ToList();
            
            foreach (var indice in indicesACambiar)
            {
                if (indice >= 0 && indice < manoActual.Count && cartasRestantes.Any())
                {
                    var nuevaCarta = cartasRestantes[random.Next(cartasRestantes.Count)];
                    manoActual[indice] = nuevaCarta;
                    cartasRestantes.Remove(nuevaCarta);
                }
            }
            return manoActual;
        }

        public (int multiplicador, string nombreMano) EvaluarMano(List<string> mano)
        {
            var valores = new List<string>();
            var palos = new List<string>();

            foreach (var carta in mano)
            {
                if (carta.Length == 3)
                {
                    valores.Add(carta.Substring(0, 2));
                    palos.Add(carta.Substring(2, 1));
                }
                else
                {
                    valores.Add(carta.Substring(0, 1));
                    palos.Add(carta.Substring(1, 1));
                }
            }

            var valorCounts = valores.GroupBy(v => v).ToDictionary(g => g.Key, g => g.Count());
            var paloCounts = palos.GroupBy(p => p).ToDictionary(g => g.Key, g => g.Count());
            
            bool esColor = paloCounts.Values.Any(c => c == 5);
            
            var ordenValores = new List<string> { "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K", "A" };
            var indicesValores = valores.Select(v => ordenValores.IndexOf(v)).OrderBy(i => i).ToList();
            
            bool esEscalera = false;
            if (indicesValores.Distinct().Count() == 5)
            {
                esEscalera = indicesValores.Last() - indicesValores.First() == 4;
                if (!esEscalera && indicesValores.SequenceEqual(new List<int> { 0, 1, 2, 3, 12 }))
                {
                    esEscalera = true;
                }
            }

            if (esColor && esEscalera && valores.Contains("A") && valores.Contains("10"))
                return (250, "ESCALERA REAL");
            if (esColor && esEscalera)
                return (50, "ESCALERA DE COLOR");
            if (valorCounts.Values.Any(c => c == 4))
                return (25, "POKER");
            if (valorCounts.Values.Any(c => c == 3) && valorCounts.Values.Any(c => c == 2))
                return (9, "FULL HOUSE");
            if (esColor)
                return (6, "COLOR");
            if (esEscalera)
                return (4, "ESCALERA");
            if (valorCounts.Values.Any(c => c == 3))
                return (3, "TRIO");
            if (valorCounts.Values.Count(c => c == 2) == 2)
                return (2, "DOBLE PAREJA");
            
            var parejaAlta = valorCounts.Where(kv => kv.Value == 2)
                .Select(kv => kv.Key)
                .Where(v => v == "J" || v == "Q" || v == "K" || v == "A")
                .Any();
                
            if (parejaAlta)
                return (1, "PAREJA (JACKS OR BETTER)");
                
            return (0, "SIN PREMIO");
        }
    }
}