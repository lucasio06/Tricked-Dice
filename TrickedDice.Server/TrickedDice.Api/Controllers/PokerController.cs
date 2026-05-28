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
    public class PokerController : ControllerBase
    {
        private readonly string? _connectionString;
        private readonly ILogger<PokerController> _logger;
        private readonly PokerService _pokerService;

        public PokerController(IConfiguration configuration, ILogger<PokerController> logger, PokerService pokerService)
        {
            _connectionString = configuration.GetConnectionString("DefaultConnection");
            _logger = logger;
            _pokerService = pokerService;
        }

        [HttpPost("repartir")]
        public IActionResult Repartir([FromBody] ApuestaModel model)
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

                var baraja = _pokerService.CrearBaraja();
                var mano = _pokerService.RepartirMano(baraja, 5);

                transaction.Commit();

                return Ok(new
                {
                    mano,
                    saldoActualizado = nuevoSaldo
                });
            }
            catch (Exception ex)
            {
                transaction.Rollback();
                _logger.LogError(ex, "Error al repartir mano de póker.");
                return StatusCode(500, new { mensaje = "Error interno del servidor." });
            }
        }

        [HttpPost("cambiar")]
        public IActionResult CambiarCartas([FromBody] CambioModel model)
        {
            var email = User.FindFirst(ClaimTypes.Email)?.Value;
            if (string.IsNullOrEmpty(email))
                return Unauthorized();

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

                var baraja = _pokerService.CrearBaraja();
                var manoFinal = _pokerService.CambiarCartas(model.Mano, model.IndicesACambiar, baraja);
                var (multiplicador, nombreMano) = _pokerService.EvaluarMano(manoFinal);

                decimal premio = model.MontoApostado * multiplicador;
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

                return Ok(new
                {
                    manoFinal,
                    premio,
                    multiplicador,
                    nombreMano,
                    saldoActualizado = nuevoSaldo
                });
            }
            catch (Exception ex)
            {
                transaction.Rollback();
                _logger.LogError(ex, "Error al cambiar cartas.");
                return StatusCode(500, new { mensaje = "Error interno del servidor." });
            }
        }
    }

    public class ApuestaModel
    {
        public decimal Monto { get; set; }
    }

    public class CambioModel
    {
        public List<string> Mano { get; set; } = new();
        public List<int> IndicesACambiar { get; set; } = new();
        public decimal MontoApostado { get; set; }
    }
}