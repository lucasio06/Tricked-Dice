namespace TrickedDice.Api.Services
{
    public static class LogicaPoker
    {
        private static readonly Random rnd = new Random();

        public static List<string> Baraja = new List<string>
        {
            "2C","2D","2T","2P", "3C","3D","3T","3P", "4C","4D","4T","4P",
            "5C","5D","5T","5P", "6C","6D","6T","6P", "7C","7D","7T","7P",
            "8C","8D","8T","8P", "9C","9D","9T","9P", "10C","10D","10T","10P",
            "JC","JD","JT","JP", "QC","QD","QT","QP", "KC","KD","KT","KP",
            "AC","AD","AT","AP"
        };

        public static List<string> RepartirMano()
        {
            return Baraja.OrderBy(x => rnd.Next()).Take(5).ToList();
        }

        public static List<string> CambiarCartas(List<string> manoActual, List<int> indicesACambiar)
        {
            var cartasDisponibles = Baraja.Except(manoActual).ToList();
            foreach (var indice in indicesACambiar)
            {
                if (indice >= 0 && indice < manoActual.Count)
                {
                    var nuevaCarta = cartasDisponibles[rnd.Next(cartasDisponibles.Count)];
                    manoActual[indice] = nuevaCarta;
                    cartasDisponibles.Remove(nuevaCarta);
                }
            }
            return manoActual;
        }

        public static int EvaluarMano(List<string> mano)
        {
            // TODO: Implementar evaluación de manos (Jacks or Better)
            return 0;
        }
    }
}