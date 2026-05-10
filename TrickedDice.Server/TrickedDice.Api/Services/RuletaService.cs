using Microsoft.Data.SqlClient;

namespace TrickedDice.Api.Services
{
    public class RuletaService
    {
        private readonly string? _connectionString;
        private static readonly int[] NumerosRuleta = { 0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11, 30, 8, 23, 10, 5, 24, 16, 33, 1, 20, 14, 31, 9, 22, 18, 29, 7, 28, 12, 35, 3, 26 };
        private static readonly int[] Rojos = { 1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36 };

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
}