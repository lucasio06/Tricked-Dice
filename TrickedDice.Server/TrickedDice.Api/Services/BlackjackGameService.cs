using Microsoft.Data.SqlClient;

namespace TrickedDice.Api.Services
{
    public class BlackjackGameService
    {
        private readonly string? _connectionString;
        private readonly BlackjackService _blackjackService;
        private readonly ILogger<BlackjackGameService> _logger;

        public BlackjackGameService(IConfiguration configuration, BlackjackService blackjackService, ILogger<BlackjackGameService> logger)
        {
            _connectionString = configuration.GetConnectionString("DefaultConnection");
            _blackjackService = blackjackService;
            _logger = logger;
        }

        public (int idUsuario, decimal saldoActual)? ValidarUsuario(string email, decimal monto)
        {
            using var connection = new SqlConnection(_connectionString);
            connection.Open();
            var sql = "SELECT ID_USUARIO, SALDO FROM USUARIO WHERE EMAIL = @Email";
            using var cmd = new SqlCommand(sql, connection);
            cmd.Parameters.AddWithValue("@Email", email);
            using var reader = cmd.ExecuteReader();
            if (!reader.Read()) return null;
            var id = reader.GetInt32(0);
            var saldo = reader.GetDecimal(1);
            if (saldo < monto) return null;
            return (id, saldo);
        }

        public string IniciarPartida(string email, decimal monto)
        {
            using var connection = new SqlConnection(_connectionString);
            connection.Open();
            using var transaction = connection.BeginTransaction();
            try
            {
                var idUsuario = ObtenerIdUsuario(connection, transaction, email);
                var nuevoSaldo = ActualizarSaldo(connection, transaction, idUsuario, -monto);
                RegistrarTransaccion(connection, transaction, idUsuario, -monto, "APUESTA");
                transaction.Commit();

                return _blackjackService.NuevaPartida(email, monto);
            }
            catch (Exception ex)
            {
                transaction.Rollback();
                _logger.LogError(ex, "Error al iniciar partida.");
                throw;
            }
        }

        public decimal ResolverPartida(string idPartida, string email)
        {
            var partida = _blackjackService.ObtenerPartida(idPartida);
            if (partida == null) return 0;

            var resultado = _blackjackService.ObtenerResultado(idPartida);
            decimal premio = 0;
            if (resultado == "jugador") premio = partida.Monto * 2;
            else if (resultado == "empate") premio = partida.Monto;

            using var connection = new SqlConnection(_connectionString);
            connection.Open();
            using var transaction = connection.BeginTransaction();
            try
            {
                var idUsuario = ObtenerIdUsuario(connection, transaction, email);
                var nuevoSaldo = ActualizarSaldo(connection, transaction, idUsuario, premio);
                if (premio > 0) RegistrarTransaccion(connection, transaction, idUsuario, premio, "PREMIO");
                transaction.Commit();
                _blackjackService.EliminarPartida(idPartida);
                return nuevoSaldo;
            }
            catch (Exception ex)
            {
                transaction.Rollback();
                _logger.LogError(ex, "Error al resolver partida.");
                throw;
            }
        }

        private int ObtenerIdUsuario(SqlConnection connection, SqlTransaction transaction, string email)
        {
            var sql = "SELECT ID_USUARIO FROM USUARIO WHERE EMAIL = @Email";
            using var cmd = new SqlCommand(sql, connection, transaction);
            cmd.Parameters.AddWithValue("@Email", email);
            return (int)cmd.ExecuteScalar()!;
        }

        private decimal ActualizarSaldo(SqlConnection connection, SqlTransaction transaction, int idUsuario, decimal cantidad)
        {
            var sql = "UPDATE USUARIO SET SALDO = SALDO + @Cantidad WHERE ID_USUARIO = @IdUsuario";
            using var cmd = new SqlCommand(sql, connection, transaction);
            cmd.Parameters.AddWithValue("@Cantidad", cantidad);
            cmd.Parameters.AddWithValue("@IdUsuario", idUsuario);
            cmd.ExecuteNonQuery();

            var sqlSelect = "SELECT SALDO FROM USUARIO WHERE ID_USUARIO = @IdUsuario";
            using var cmdSelect = new SqlCommand(sqlSelect, connection, transaction);
            cmdSelect.Parameters.AddWithValue("@IdUsuario", idUsuario);
            return (decimal)cmdSelect.ExecuteScalar()!;
        }

        private void RegistrarTransaccion(SqlConnection connection, SqlTransaction transaction, int idUsuario, decimal cantidad, string tipo)
        {
            var sql = "INSERT INTO TRANSACCION (ID_USUARIO, CANTIDAD, TIPO_TRANSACCION) VALUES (@IdUsuario, @Cantidad, @Tipo)";
            using var cmd = new SqlCommand(sql, connection, transaction);
            cmd.Parameters.AddWithValue("@IdUsuario", idUsuario);
            cmd.Parameters.AddWithValue("@Cantidad", cantidad);
            cmd.Parameters.AddWithValue("@Tipo", tipo);
            cmd.ExecuteNonQuery();
        }
    }
}