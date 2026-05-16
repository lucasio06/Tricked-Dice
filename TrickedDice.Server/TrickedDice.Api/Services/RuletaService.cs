using Microsoft.Data.SqlClient;
using System.Collections.Concurrent;

namespace TrickedDice.Api.Services
{
    public class RuletaService
    {
        private readonly string? _connectionString;
        private static readonly int[] NumerosRuleta = { 0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11, 30, 8, 23, 10, 5, 24, 16, 33, 1, 20, 14, 31, 9, 22, 18, 29, 7, 28, 12, 35, 3, 26 };
        private static readonly int[] Rojos = { 1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36 };
        private static readonly ConcurrentDictionary<string, List<ApuestaUsuario>> MesasApuestas = new();

        public RuletaService(IConfiguration configuration)
        {
            _connectionString = configuration.GetConnectionString("DefaultConnection");
        }

        public object GirarRuleta(string email, decimal monto, string tipoApuesta, string valorApuesta)
        {
            using var connection = new SqlConnection(_connectionString);
            connection.Open();
            using var transaction = connection.BeginTransaction();
            try
            {
                var idUsuario = ObtenerIdUsuario(connection, transaction, email);
                var saldoActual = ObtenerSaldo(connection, transaction, idUsuario);

                if (saldoActual < monto) throw new InvalidOperationException("Saldo insuficiente");

                var rnd = new Random();
                int numeroGanador = NumerosRuleta[rnd.Next(0, NumerosRuleta.Length)];
                var (gano, premio) = CalcularPremio(monto, tipoApuesta, valorApuesta, numeroGanador);

                var nuevoSaldo = gano ? saldoActual - monto + premio : saldoActual - monto;

                ActualizarSaldo(connection, transaction, idUsuario, nuevoSaldo);
                RegistrarTransaccion(connection, transaction, idUsuario, -monto, "APUESTA");
                if (gano) RegistrarTransaccion(connection, transaction, idUsuario, premio, "PREMIO");

                transaction.Commit();

                return new
                {
                    numeroGanador,
                    gano,
                    premio,
                    saldoActualizado = nuevoSaldo
                };
            }
            catch
            {
                transaction.Rollback();
                throw;
            }
        }

        public object GirarRuletaMultiple(string email, List<ApuestaDto> apuestas)
        {
            using var connection = new SqlConnection(_connectionString);
            connection.Open();
            using var transaction = connection.BeginTransaction();
            try
            {
                var idUsuario = ObtenerIdUsuario(connection, transaction, email);
                var saldoActual = ObtenerSaldo(connection, transaction, idUsuario);

                var montoTotal = apuestas.Sum(a => a.Monto);
                if (saldoActual < montoTotal) throw new InvalidOperationException("Saldo insuficiente");

                var rnd = new Random();
                int numeroGanador = NumerosRuleta[rnd.Next(0, NumerosRuleta.Length)];

                decimal premioTotal = 0;
                bool algunaGanadora = false;

                foreach (var apuesta in apuestas)
                {
                    var (gano, premio) = CalcularPremio(apuesta.Monto, apuesta.Tipo, apuesta.Valor, numeroGanador);
                    if (gano)
                    {
                        algunaGanadora = true;
                        premioTotal += premio;
                    }
                }

                var nuevoSaldo = saldoActual - montoTotal + premioTotal;

                ActualizarSaldo(connection, transaction, idUsuario, nuevoSaldo);
                RegistrarTransaccion(connection, transaction, idUsuario, -montoTotal, "APUESTA");
                if (premioTotal > 0) RegistrarTransaccion(connection, transaction, idUsuario, premioTotal, "PREMIO");

                transaction.Commit();

                return new
                {
                    numeroGanador,
                    gano = algunaGanadora,
                    premio = premioTotal,
                    saldoActualizado = nuevoSaldo
                };
            }
            catch
            {
                transaction.Rollback();
                throw;
            }
        }

        public async Task AgregarApuestaMesa(string mesaId, string email, ApuestaDto apuesta)
        {
            if (!MesasApuestas.ContainsKey(mesaId))
                MesasApuestas[mesaId] = new List<ApuestaUsuario>();
            MesasApuestas[mesaId].Add(new ApuestaUsuario { Email = email, Apuesta = apuesta });
            await Task.CompletedTask;
        }

        public async Task<Dictionary<string, object>> GirarMesa(string mesaId, string emailSolicitante)
        {
            using var connection = new SqlConnection(_connectionString);
            connection.Open();
            using var transaction = connection.BeginTransaction();
            try
            {
                var rnd = new Random();
                int numeroGanador = NumerosRuleta[rnd.Next(0, NumerosRuleta.Length)];
                var resultados = new Dictionary<string, object>();
                var apuestasMesa = MesasApuestas.ContainsKey(mesaId) ? MesasApuestas[mesaId] : new List<ApuestaUsuario>();
                var agrupado = apuestasMesa.GroupBy(a => a.Email);
                foreach (var grupo in agrupado)
                {
                    var email = grupo.Key;
                    var apuestas = grupo.Select(a => a.Apuesta).ToList();
                    var resultado = GirarRuletaMultipleInterno(email, apuestas, connection, transaction, numeroGanador);
                    resultados[email] = resultado;
                }
                transaction.Commit();
                MesasApuestas.TryRemove(mesaId, out _);
                return new Dictionary<string, object>
                {
                    ["numeroGanador"] = numeroGanador,
                    ["resultados"] = resultados
                };
            }
            catch
            {
                transaction.Rollback();
                throw;
            }
        }

        private object GirarRuletaMultipleInterno(string email, List<ApuestaDto> apuestas, SqlConnection connection, SqlTransaction transaction, int numeroGanador)
        {
            var idUsuario = ObtenerIdUsuario(connection, transaction, email);
            var saldoActual = ObtenerSaldo(connection, transaction, idUsuario);
            var montoTotal = apuestas.Sum(a => a.Monto);
            if (saldoActual < montoTotal) throw new InvalidOperationException("Saldo insuficiente");
            decimal premioTotal = 0;
            bool algunaGanadora = false;
            foreach (var apuesta in apuestas)
            {
                var (gano, premio) = CalcularPremio(apuesta.Monto, apuesta.Tipo, apuesta.Valor, numeroGanador);
                if (gano)
                {
                    algunaGanadora = true;
                    premioTotal += premio;
                }
            }
            var nuevoSaldo = saldoActual - montoTotal + premioTotal;
            ActualizarSaldo(connection, transaction, idUsuario, nuevoSaldo);
            RegistrarTransaccion(connection, transaction, idUsuario, -montoTotal, "APUESTA");
            if (premioTotal > 0) RegistrarTransaccion(connection, transaction, idUsuario, premioTotal, "PREMIO");
            return new { gano = algunaGanadora, premio = premioTotal, saldoActualizado = nuevoSaldo };
        }

        private (bool gano, decimal premio) CalcularPremio(decimal monto, string tipo, string valor, int numero)
        {
            tipo = tipo.ToLower();
            switch (tipo)
            {
                case "color":
                    var colorApostado = valor.ToLower();
                    var colorGanador = Rojos.Contains(numero) ? "rojo" : numero == 0 ? "verde" : "negro";
                    if (colorApostado == colorGanador && numero != 0) return (true, monto * 2);
                    break;
                case "paridad":
                    if (numero != 0 && valor.ToLower() == (numero % 2 == 0 ? "par" : "impar")) return (true, monto * 2);
                    break;
                case "mitad":
                    if (numero != 0 && ((valor == "1-18" && numero <= 18) || (valor == "19-36" && numero > 18))) return (true, monto * 2);
                    break;
                case "docena":
                    if (numero != 0 && int.TryParse(valor, out int docena) && ((numero - 1) / 12 + 1) == docena) return (true, monto * 3);
                    break;
                case "columna":
                    if (numero != 0 && int.TryParse(valor, out int columna) && (numero % 3 == columna % 3)) return (true, monto * 3);
                    break;
                case "numero":
                    if (valor == numero.ToString()) return (true, monto * 36);
                    break;
                case "pleno":
                    if (int.TryParse(valor, out int numPleno) && numPleno == numero) return (true, monto * 36);
                    break;
                case "caballo":
                    var numsCaballo = valor.Split(',').Select(int.Parse).ToArray();
                    if (numsCaballo.Contains(numero)) return (true, monto * 18);
                    break;
                case "calle":
                    var numsCalle = valor.Split(',').Select(int.Parse).ToArray();
                    if (numsCalle.Contains(numero)) return (true, monto * 12);
                    break;
                case "cuadro":
                    var numsCuadro = valor.Split(',').Select(int.Parse).ToArray();
                    if (numsCuadro.Contains(numero)) return (true, monto * 9);
                    break;
                case "seisena":
                    var numsSeisena = valor.Split(',').Select(int.Parse).ToArray();
                    if (numsSeisena.Contains(numero)) return (true, monto * 6);
                    break;
                case "vecinos0":
                    var numsVecinos = new[] { 0, 2, 3, 4, 7, 12, 15, 18, 19, 21, 22, 25, 26, 28, 29, 32, 35 };
                    if (numsVecinos.Contains(numero)) return (true, monto * (36m / numsVecinos.Length));
                    break;
                case "tercio":
                    var numsTercio = new[] { 5, 8, 10, 11, 13, 16, 23, 24, 27, 30, 33, 36 };
                    if (numsTercio.Contains(numero)) return (true, monto * (36m / numsTercio.Length));
                    break;
                case "huerfanos":
                    var numsHuerfanos = new[] { 1, 6, 9, 14, 17, 20, 31, 34 };
                    if (numsHuerfanos.Contains(numero)) return (true, monto * (36m / numsHuerfanos.Length));
                    break;
                case "juego0":
                    var numsJuego0 = new[] { 0, 3, 12, 15, 26, 32, 35 };
                    if (numsJuego0.Contains(numero)) return (true, monto * (36m / numsJuego0.Length));
                    break;
                case "finales":
                    if (valor.Length == 1 && int.TryParse(valor, out int digito) && numero % 10 == digito) return (true, monto * (36m / 4m));
                    break;
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
        public ApuestaDto Apuesta { get; set; } = new();
    }
}