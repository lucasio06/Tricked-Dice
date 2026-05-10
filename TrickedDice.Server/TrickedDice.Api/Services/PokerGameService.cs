using Microsoft.Data.SqlClient;

namespace TrickedDice.Api.Services
{
    public class PokerGameService
    {
        private readonly string? _connectionString;
        private readonly PokerService _pokerService;

        public PokerGameService(IConfiguration configuration, PokerService pokerService)
        {
            _connectionString = configuration.GetConnectionString("DefaultConnection");
            _pokerService = pokerService;
        }

        public object Repartir(string email, decimal monto)
        {
            using var connection = new SqlConnection(_connectionString);
            connection.Open();
            using var transaction = connection.BeginTransaction();
            try
            {
                var (idUsuario, saldoActual) = ObtenerUsuario(connection, transaction, email);
                if (saldoActual < monto) throw new InvalidOperationException("Saldo insuficiente");

                var nuevoSaldo = saldoActual - monto;
                ActualizarSaldo(connection, transaction, idUsuario, nuevoSaldo);
                RegistrarTransaccion(connection, transaction, idUsuario, -monto, "APUESTA");
                transaction.Commit();

                var baraja = _pokerService.CrearBaraja();
                var mano = _pokerService.RepartirMano(baraja, 5);

                return new { mano, saldoActualizado = nuevoSaldo };
            }
            catch
            {
                transaction.Rollback();
                throw;
            }
        }

        public object Cambiar(string email, List<string> mano, List<int> indicesACambiar, decimal montoApostado)
        {
            using var connection = new SqlConnection(_connectionString);
            connection.Open();
            using var transaction = connection.BeginTransaction();
            try
            {
                var (idUsuario, saldoActual) = ObtenerUsuario(connection, transaction, email);
                var baraja = _pokerService.CrearBaraja();
                var manoFinal = _pokerService.CambiarCartas(mano, indicesACambiar, baraja);
                var (multiplicador, nombreMano) = _pokerService.EvaluarMano(manoFinal);
                var premio = montoApostado * multiplicador;
                var nuevoSaldo = saldoActual + premio;

                ActualizarSaldo(connection, transaction, idUsuario, nuevoSaldo);
                if (premio > 0) RegistrarTransaccion(connection, transaction, idUsuario, premio, "PREMIO");
                transaction.Commit();

                return new { manoFinal, premio, nombreMano, saldoActualizado = nuevoSaldo };
            }
            catch
            {
                transaction.Rollback();
                throw;
            }
        }

        private (int idUsuario, decimal saldo) ObtenerUsuario(SqlConnection c, SqlTransaction t, string email)
        {
            using var cmd = new SqlCommand("SELECT ID_USUARIO, SALDO FROM USUARIO WHERE EMAIL = @Email", c, t);
            cmd.Parameters.AddWithValue("@Email", email);
            using var reader = cmd.ExecuteReader();
            if (!reader.Read()) throw new InvalidOperationException("Usuario no encontrado");
            return (reader.GetInt32(0), reader.GetDecimal(1));
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