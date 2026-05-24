using Microsoft.Data.SqlClient;
using System.Collections.Concurrent;

namespace TrickedDice.Api.Services
{
    public class RuletaService
    {
        private readonly string? _connectionString;
        private static readonly int[] NumerosRuleta = { 0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11, 30, 8, 23, 10, 5, 24, 16, 33, 1, 20, 14, 31, 9, 22, 18, 29, 7, 28, 12, 35, 3, 26 };
        private static readonly int[] Rojos = { 1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36 };
        private static readonly ConcurrentDictionary<string, ConcurrentBag<ApuestaUsuario>> MesasApuestas = new();

        public RuletaService(IConfiguration configuration)
        {
            _connectionString = configuration.GetConnectionString("DefaultConnection");
        }

        public async Task AgregarApuestaMesa(string mesaId, string email, string nombre, ApuestaDto apuesta)
        {
            var bag = MesasApuestas.GetOrAdd(mesaId, _ => new ConcurrentBag<ApuestaUsuario>());
            bag.Add(new ApuestaUsuario { Email = email, Nombre = nombre, Apuesta = apuesta });
            await Task.CompletedTask;
        }

        public async Task<Dictionary<string, object>> GirarMesa(string mesaId)
        {
            using var connection = new SqlConnection(_connectionString);
            connection.Open();
            using var transaction = connection.BeginTransaction();
            try
            {
                var rnd = new Random();
                int numeroGanador = NumerosRuleta[rnd.Next(0, NumerosRuleta.Length)];
                var resultados = new Dictionary<string, object>();
                var historialGlobal = new List<object>();
                
                var apuestasMesa = MesasApuestas.TryGetValue(mesaId, out var bag) ? bag.ToList() : new List<ApuestaUsuario>();
                var agrupado = apuestasMesa.GroupBy(a => new { a.Email, a.Nombre });
                
                foreach (var grupo in agrupado)
                {
                    var email = grupo.Key.Email;
                    var nombre = grupo.Key.Nombre;
                    var apuestas = grupo.Select(a => a.Apuesta).ToList();
                    
                    var res = GirarRuletaMultipleInterno(email, apuestas, connection, transaction, numeroGanador);
                    resultados[email] = new { gano = res.gano, premio = res.premio, saldoActualizado = res.saldoActualizado };
                    
                    historialGlobal.Add(new { usuario = nombre, gano = res.gano, premio = res.premio });
                }
                
                transaction.Commit();
                MesasApuestas.TryRemove(mesaId, out _);
                return new Dictionary<string, object>
                {
                    ["numeroGanador"] = numeroGanador,
                    ["resultados"] = resultados,
                    ["historialGlobal"] = historialGlobal
                };
            }
            catch
            {
                transaction.Rollback();
                throw;
            }
        }

        private (bool gano, decimal premio, decimal saldoActualizado) GirarRuletaMultipleInterno(string email, List<ApuestaDto> apuestas, SqlConnection connection, SqlTransaction transaction, int numeroGanador)
        {
            var idUsuario = ObtenerIdUsuario(connection, transaction, email);
            var saldoActual = ObtenerSaldo(connection, transaction, idUsuario);
            var montoTotal = apuestas.Sum(a => a.Monto);
            
            decimal premioTotal = 0;
            bool algunaGanadora = false;
            foreach (var apuesta in apuestas)
            {
                var (gano, premio) = CalcularPremio(apuesta.Monto, apuesta.Tipo, apuesta.Valor, numeroGanador);
                if (gano) { algunaGanadora = true; premioTotal += premio; }
            }
            var nuevoSaldo = saldoActual - montoTotal + premioTotal;
            ActualizarSaldo(connection, transaction, idUsuario, nuevoSaldo);
            RegistrarTransaccion(connection, transaction, idUsuario, -montoTotal, "APUESTA");
            if (premioTotal > 0) RegistrarTransaccion(connection, transaction, idUsuario, premioTotal, "PREMIO");
            
            return (algunaGanadora, premioTotal, nuevoSaldo);
        }

        private (bool gano, decimal premio) CalcularPremio(decimal monto, string tipo, string valor, int numero)
        {
            tipo = tipo.ToLower();
            switch (tipo)
            {
                case "color":
                    var colorApostado = valor.ToLower();
                    var colorGanador = Rojos.Contains(numero) ? "rojo" : numero == 0 ? "verde" : "negro";
                    return (colorApostado == colorGanador && numero != 0) ? (true, monto * 2) : (false, 0);
                case "pleno":
                    return valor == numero.ToString() ? (true, monto * 36) : (false, 0);
                case "caballo":
                    return valor.Split(',').Select(int.Parse).Contains(numero) ? (true, monto * 18) : (false, 0);
                case "calle":
                    return valor.Split(',').Select(int.Parse).Contains(numero) ? (true, monto * 12) : (false, 0);
                case "cuadro":
                    return valor.Split(',').Select(int.Parse).Contains(numero) ? (true, monto * 9) : (false, 0);
                case "seisena":
                    return valor.Split(',').Select(int.Parse).Contains(numero) ? (true, monto * 6) : (false, 0);
                case "vecinos0":
                    var vecinos = new[] { 0, 2, 3, 4, 7, 12, 15, 18, 19, 21, 22, 25, 26, 28, 29, 32, 35 };
                    return vecinos.Contains(numero) ? (true, monto * (36m / vecinos.Length)) : (false, 0);
                case "tercio":
                    var tercio = new[] { 5, 8, 10, 11, 13, 16, 23, 24, 27, 30, 33, 36 };
                    return tercio.Contains(numero) ? (true, monto * (36m / tercio.Length)) : (false, 0);
                case "huerfanos":
                    var huerfanos = new[] { 1, 6, 9, 14, 17, 20, 31, 34 };
                    return huerfanos.Contains(numero) ? (true, monto * (36m / huerfanos.Length)) : (false, 0);
                case "juego0":
                    var juego0 = new[] { 0, 3, 12, 15, 26, 32, 35 };
                    return juego0.Contains(numero) ? (true, monto * (36m / juego0.Length)) : (false, 0);
                case "finales":
                    if (int.TryParse(valor, out int digito) && numero % 10 == digito)
                        return (true, monto * (36m / 4m));
                    break;
                default:
                    return (false, 0);
            }
            return (false, 0);
        }

        private int ObtenerIdUsuario(SqlConnection c, SqlTransaction t, string email)
        {
            using var cmd = new SqlCommand("SELECT ID_USUARIO FROM USUARIO WHERE EMAIL = @Email", c, t);
            cmd.Parameters.AddWithValue("@Email", email);
            return (int)cmd.ExecuteScalar()!;
        }

        private decimal ObtenerSaldo(SqlConnection c, SqlTransaction t, int id)
        {
            using var cmd = new SqlCommand("SELECT SALDO FROM USUARIO WHERE ID_USUARIO = @Id", c, t);
            cmd.Parameters.AddWithValue("@Id", id);
            return (decimal)cmd.ExecuteScalar()!;
        }

        private void ActualizarSaldo(SqlConnection c, SqlTransaction t, int id, decimal saldo)
        {
            using var cmd = new SqlCommand("UPDATE USUARIO SET SALDO = @Saldo WHERE ID_USUARIO = @Id", c, t);
            cmd.Parameters.AddWithValue("@Saldo", saldo);
            cmd.Parameters.AddWithValue("@Id", id);
            cmd.ExecuteNonQuery();
        }

        private void RegistrarTransaccion(SqlConnection c, SqlTransaction t, int id, decimal cantidad, string tipo)
        {
            using var cmd = new SqlCommand("INSERT INTO TRANSACCION (ID_USUARIO, CANTIDAD, TIPO_TRANSACCION) VALUES (@Id, @Cantidad, @Tipo)", c, t);
            cmd.Parameters.AddWithValue("@Id", id);
            cmd.Parameters.AddWithValue("@Cantidad", cantidad);
            cmd.Parameters.AddWithValue("@Tipo", tipo);
            cmd.ExecuteNonQuery();
        }
    }

    public class ApuestaDto
    {
        public string Tipo { get; set; } = string.Empty;
        public string Valor { get; set; } = string.Empty;
        public decimal Monto { get; set; }
    }

    public class ApuestaUsuario
    {
        public string Email { get; set; } = string.Empty;
        public string Nombre { get; set; } = string.Empty;
        public ApuestaDto Apuesta { get; set; } = new();
    }
}