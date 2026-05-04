using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Data.SqlClient;
using System.Security.Claims;
using TrickedDice.Api.Services;

namespace TrickedDice.Api.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    [Authorize]
    public class BlackjackController : ControllerBase
    {
        private readonly string? _connectionString;
        private readonly ILogger<BlackjackController> _logger;
        private readonly BlackjackService _blackjackService;

        public BlackjackController(IConfiguration configuration, ILogger<BlackjackController> logger, BlackjackService blackjackService)
        {
            _connectionString = configuration.GetConnectionString("DefaultConnection");
            _logger = logger;
            _blackjackService = blackjackService;
        }

        public class RepartirModel
        {
            public decimal Monto { get; set; }
        }

        [HttpPost("repartir")]
        public IActionResult Repartir([FromBody] RepartirModel model)
        {
            var email = User.FindFirst(ClaimTypes.Email)?.Value;
            if (string.IsNullOrEmpty(email))
                return Unauthorized();

            if (model.Monto <= 0)
                return BadRequest(new { mensaje = "El monto de la apuesta debe ser mayor a 0." });

            using var connection = new SqlConnection(_connectionString);
            connection.Open();
            using var transaction = connection.BeginTransaction();

            try
            {
                var sqlUsuario = "SELECT ID_USUARIO, SALDO FROM USUARIO WHERE EMAIL = @Email";
                int idUsuario;
                decimal saldoActual;

                using (var cmd = new SqlCommand(sqlUsuario, connection, transaction))
                {
                    cmd.Parameters.AddWithValue("@Email", email);
                    using var reader = cmd.ExecuteReader();
                    if (!reader.Read())
                        return NotFound(new { mensaje = "Usuario no encontrado." });
                    idUsuario = reader.GetInt32(0);
                    saldoActual = reader.GetDecimal(1);
                }

                if (saldoActual < model.Monto)
                    return BadRequest(new { mensaje = "Saldo insuficiente." });

                var nuevoSaldo = saldoActual - model.Monto;
                var sqlUpdate = "UPDATE USUARIO SET SALDO = @Saldo WHERE ID_USUARIO = @IdUsuario";
                using (var cmd = new SqlCommand(sqlUpdate, connection, transaction))
                {
                    cmd.Parameters.AddWithValue("@Saldo", nuevoSaldo);
                    cmd.Parameters.AddWithValue("@IdUsuario", idUsuario);
                    cmd.ExecuteNonQuery();
                }

                var sqlTrans = @"INSERT INTO TRANSACCION (ID_USUARIO, CANTIDAD, TIPO_TRANSACCION) 
                                 VALUES (@idUsuario, @cantidad, 'APUESTA')";
                using (var cmd = new SqlCommand(sqlTrans, connection, transaction))
                {
                    cmd.Parameters.AddWithValue("@idUsuario", idUsuario);
                    cmd.Parameters.AddWithValue("@cantidad", -model.Monto);
                    cmd.ExecuteNonQuery();
                }

                var idPartida = _blackjackService.NuevaPartida(email, model.Monto);
                var partida = _blackjackService.ObtenerPartida(idPartida)!;

                transaction.Commit();

                return Ok(new
                {
                    idPartida,
                    manoJugador = partida.ManoJugador,
                    manoCrupier = partida.ManoCrupier,
                    saldoActualizado = nuevoSaldo
                });
            }
            catch (Exception ex)
            {
                transaction.Rollback();
                _logger.LogError(ex, "Error al repartir blackjack.");
                return StatusCode(500, new { mensaje = "Error interno del servidor." });
            }
        }

        public class PedirModel
        {
            public string IdPartida { get; set; } = string.Empty;
        }

        [HttpPost("pedir")]
        public IActionResult PedirCarta([FromBody] PedirModel model)
        {
            var partida = _blackjackService.ObtenerPartida(model.IdPartida);
            if (partida == null)
                return NotFound(new { mensaje = "Partida no encontrada." });

            var carta = _blackjackService.PedirCarta(model.IdPartida);
            if (carta == null)
                return BadRequest(new { mensaje = "No se pudo pedir carta." });

            var valorMano = _blackjackService.ValorMano(partida.ManoJugador);
            var terminada = valorMano > 21;

            if (terminada)
            {
                var email = partida.Email;
                using var connection = new SqlConnection(_connectionString);
                connection.Open();
                var sqlUsuario = "SELECT ID_USUARIO, SALDO FROM USUARIO WHERE EMAIL = @Email";
                int idUsuario;
                decimal saldoActual;

                using (var cmd = new SqlCommand(sqlUsuario, connection))
                {
                    cmd.Parameters.AddWithValue("@Email", email);
                    using var reader = cmd.ExecuteReader();
                    reader.Read();
                    idUsuario = reader.GetInt32(0);
                    saldoActual = reader.GetDecimal(1);
                }

                _blackjackService.EliminarPartida(model.IdPartida);

                return Ok(new
                {
                    carta,
                    manoJugador = partida.ManoJugador,
                    terminada = true,
                    resultado = "crupier",
                    saldoActualizado = saldoActual
                });
            }

            return Ok(new
            {
                carta,
                manoJugador = partida.ManoJugador,
                terminada = false
            });
        }

        public class PlantarseModel
        {
            public string IdPartida { get; set; } = string.Empty;
        }

        [HttpPost("plantarse")]
        public IActionResult Plantarse([FromBody] PlantarseModel model)
        {
            var partida = _blackjackService.ObtenerPartida(model.IdPartida);
            if (partida == null)
                return NotFound(new { mensaje = "Partida no encontrada." });

            _blackjackService.Plantarse(model.IdPartida);
            var resultado = _blackjackService.ObtenerResultado(model.IdPartida);

            var email = partida.Email;

            using var connection = new SqlConnection(_connectionString);
            connection.Open();
            using var transaction = connection.BeginTransaction();

            try
            {
                var sqlUsuario = "SELECT ID_USUARIO, SALDO FROM USUARIO WHERE EMAIL = @Email";
                int idUsuario;
                decimal saldoActual;

                using (var cmd = new SqlCommand(sqlUsuario, connection, transaction))
                {
                    cmd.Parameters.AddWithValue("@Email", email);
                    using var reader = cmd.ExecuteReader();
                    reader.Read();
                    idUsuario = reader.GetInt32(0);
                    saldoActual = reader.GetDecimal(1);
                }

                decimal premio = 0;
                if (resultado == "jugador")
                {
                    premio = partida.Monto * 2;
                }
                else if (resultado == "empate")
                {
                    premio = partida.Monto;
                }

                var nuevoSaldo = saldoActual + premio;

                var sqlUpdate = "UPDATE USUARIO SET SALDO = @Saldo WHERE ID_USUARIO = @IdUsuario";
                using (var cmd = new SqlCommand(sqlUpdate, connection, transaction))
                {
                    cmd.Parameters.AddWithValue("@Saldo", nuevoSaldo);
                    cmd.Parameters.AddWithValue("@IdUsuario", idUsuario);
                    cmd.ExecuteNonQuery();
                }

                if (premio > 0)
                {
                    var sqlTrans = @"INSERT INTO TRANSACCION (ID_USUARIO, CANTIDAD, TIPO_TRANSACCION) 
                                     VALUES (@idUsuario, @cantidad, 'PREMIO')";
                    using (var cmd = new SqlCommand(sqlTrans, connection, transaction))
                    {
                        cmd.Parameters.AddWithValue("@idUsuario", idUsuario);
                        cmd.Parameters.AddWithValue("@cantidad", premio);
                        cmd.ExecuteNonQuery();
                    }
                }

                transaction.Commit();

                _blackjackService.EliminarPartida(model.IdPartida);

                return Ok(new
                {
                    manoCrupier = partida.ManoCrupier,
                    resultado,
                    premio,
                    saldoActualizado = nuevoSaldo
                });
            }
            catch (Exception ex)
            {
                transaction.Rollback();
                _logger.LogError(ex, "Error al plantarse en blackjack.");
                return StatusCode(500, new { mensaje = "Error interno del servidor." });
            }
        }
    }
}