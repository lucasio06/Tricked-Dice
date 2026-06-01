using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Data.SqlClient;
using System.Security.Claims;

namespace TrickedDice.Api.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    [Authorize(Roles = "Admin")]
    public class AdminController : ControllerBase
    {
        private readonly string? _connectionString;
        private readonly ILogger<AdminController> _logger;

        public AdminController(IConfiguration configuration, ILogger<AdminController> logger)
        {
            _connectionString = configuration.GetConnectionString("DefaultConnection");
            _logger = logger;
        }

        [HttpGet("usuarios")]
        public IActionResult GetUsuarios()
        {
            try
            {
                using var connection = new SqlConnection(_connectionString);
                connection.Open();

                var sql = @"SELECT ID_USUARIO, EMAIL, NOMBRE, PRIMER_APELLIDO, NOMBRE_USUARIO, SALDO, FECHA_NACIMIENTO, DNI, BANEADO 
                            FROM USUARIO ORDER BY ID_USUARIO DESC";

                using var cmd = new SqlCommand(sql, connection);
                using var reader = cmd.ExecuteReader();

                var usuarios = new List<object>();
                while (reader.Read())
                {
                    usuarios.Add(new
                    {
                        idUsuario = reader.GetInt32(0),
                        email = reader.GetString(1),
                        nombre = reader.GetString(2),
                        primerApellido = reader.GetString(3),
                        nombreUsuario = reader.GetString(4),
                        saldo = reader.GetDecimal(5),
                        fechaNacimiento = reader.GetDateTime(6),
                        dni = reader.GetString(7),
                        baneado = reader.GetBoolean(8)
                    });
                }

                return Ok(usuarios);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error al obtener usuarios.");
                return StatusCode(500, new { mensaje = "Error interno del servidor." });
            }
        }

        [HttpGet("transacciones")]
        public IActionResult GetTransacciones([FromQuery] int? idUsuario)
        {
            try
            {
                using var connection = new SqlConnection(_connectionString);
                connection.Open();

                var sql = @"SELECT T.ID_TRANSACCION, T.FECHA_TRANSACCION, T.CANTIDAD, T.TIPO_TRANSACCION, U.EMAIL, U.NOMBRE
                            FROM TRANSACCION T
                            INNER JOIN USUARIO U ON T.ID_USUARIO = U.ID_USUARIO";

                if (idUsuario.HasValue)
                {
                    sql += " WHERE T.ID_USUARIO = @IdUsuario";
                }

                sql += " ORDER BY T.FECHA_TRANSACCION DESC";

                using var cmd = new SqlCommand(sql, connection);

                if (idUsuario.HasValue)
                {
                    cmd.Parameters.AddWithValue("@IdUsuario", idUsuario.Value);
                }

                using var reader = cmd.ExecuteReader();

                var transacciones = new List<object>();
                while (reader.Read())
                {
                    transacciones.Add(new
                    {
                        idTransaccion = reader.GetInt32(0),
                        fecha = reader.GetDateTime(1),
                        cantidad = reader.GetDecimal(2),
                        tipo = reader.GetString(3),
                        email = reader.GetString(4),
                        nombre = reader.GetString(5)
                    });
                }

                return Ok(transacciones);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error al obtener transacciones.");
                return StatusCode(500, new { mensaje = "Error interno del servidor." });
            }
        }

        [HttpGet("estadisticas")]
        public IActionResult GetEstadisticas()
        {
            try
            {
                using var connection = new SqlConnection(_connectionString);
                connection.Open();

                var sqlTotalUsuarios = "SELECT COUNT(*) FROM USUARIO";
                var sqlTotalRecargas = "SELECT ISNULL(SUM(CANTIDAD), 0) FROM TRANSACCION WHERE TIPO_TRANSACCION = 'RECARGA'";
                var sqlTotalApostado = "SELECT ISNULL(SUM(ABS(CANTIDAD)), 0) FROM TRANSACCION WHERE TIPO_TRANSACCION = 'APUESTA'";
                var sqlTotalPremios = "SELECT ISNULL(SUM(CANTIDAD), 0) FROM TRANSACCION WHERE TIPO_TRANSACCION = 'PREMIO'";
                var sqlSaldoTotal = "SELECT ISNULL(SUM(SALDO), 0) FROM USUARIO";

                int totalUsuarios;
                decimal totalRecargas;
                decimal totalApostado;
                decimal totalPremios;
                decimal saldoTotal;

                using (var cmd = new SqlCommand(sqlTotalUsuarios, connection))
                {
                    totalUsuarios = (int)cmd.ExecuteScalar()!;
                }

                using (var cmd = new SqlCommand(sqlTotalRecargas, connection))
                {
                    totalRecargas = (decimal)cmd.ExecuteScalar()!;
                }

                using (var cmd = new SqlCommand(sqlTotalApostado, connection))
                {
                    totalApostado = (decimal)cmd.ExecuteScalar()!;
                }

                using (var cmd = new SqlCommand(sqlTotalPremios, connection))
                {
                    totalPremios = (decimal)cmd.ExecuteScalar()!;
                }

                using (var cmd = new SqlCommand(sqlSaldoTotal, connection))
                {
                    saldoTotal = (decimal)cmd.ExecuteScalar()!;
                }

                var beneficio = totalRecargas - totalPremios;

                return Ok(new
                {
                    totalUsuarios,
                    totalRecargas,
                    totalApostado,
                    totalPremios,
                    beneficio,
                    saldoTotal
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error al obtener estadísticas.");
                return StatusCode(500, new { mensaje = "Error interno del servidor." });
            }
        }

        [HttpPut("banear/{idUsuario}")]
        public IActionResult BanearUsuario(int idUsuario, [FromBody] BanearModel model)
        {
            try
            {
                using var connection = new SqlConnection(_connectionString);
                connection.Open();
                
                var sql = "UPDATE USUARIO SET BANEADO = @Baneado WHERE ID_USUARIO = @IdUsuario";
                using var cmd = new SqlCommand(sql, connection);
                cmd.Parameters.AddWithValue("@Baneado", model.Baneado ? 1 : 0);
                cmd.Parameters.AddWithValue("@IdUsuario", idUsuario);
                
                var filas = cmd.ExecuteNonQuery();
                if (filas == 0) return NotFound(new { mensaje = "Usuario no encontrado." });
                
                return Ok(new { mensaje = model.Baneado ? "Usuario baneado." : "Usuario desbaneado." });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error al banear/desbanear usuario.");
                return StatusCode(500, new { mensaje = "Error interno del servidor." });
            }
        }

        public class BanearModel
        {
            public bool Baneado { get; set; }
        }
    }
}