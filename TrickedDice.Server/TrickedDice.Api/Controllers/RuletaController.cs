using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Data.SqlClient;
using TrickedDice.Api.Services;
using TrickedDice.Api.Extensions;

namespace TrickedDice.Api.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    [Authorize]
    public class RuletaController : ControllerBase
    {
        private readonly string? _connectionString;
        private readonly RuletaService _ruletaService;

        public RuletaController(IConfiguration configuration, RuletaService ruletaService)
        {
            _connectionString = configuration.GetConnectionString("DefaultConnection");
            _ruletaService = ruletaService;
        }

        public class ApuestaModel
        {
            public decimal Monto { get; set; }
            public string TipoApuesta { get; set; } = string.Empty;
            public string? ValorApuesta { get; set; }
        }

        [HttpPost("girar")]
        public async Task<IActionResult> Girar([FromBody] ApuestaModel apuesta)
        {
            if (apuesta.Monto <= 0)
                return BadRequest(new { mensaje = "El monto de la apuesta debe ser mayor a 0." });

            var email = User.GetEmail();

            if (string.IsNullOrEmpty(email))
                return Unauthorized(new { mensaje = "No se pudo determinar el email del usuario." });

            try
            {
                var apuestasLista = new List<ApuestaDto> 
                { 
                    new ApuestaDto 
                    { 
                        Monto = apuesta.Monto, 
                        Tipo = apuesta.TipoApuesta, 
                        Valor = apuesta.ValorApuesta ?? string.Empty 
                    } 
                };

                var resultado = await _ruletaService.ProcesarGiroIndividual(email, apuestasLista);
                
                return Ok(resultado);
            }
            catch (InvalidOperationException ex)
            {
                return BadRequest(new { mensaje = ex.Message });
            }
            catch (Exception)
            {
                return StatusCode(500, new { mensaje = "Error interno del servidor." });
            }
        }

        [HttpGet("saldo")]
        public IActionResult GetSaldo()
        {
            var email = User.GetEmail();

            if (string.IsNullOrEmpty(email))
                return Unauthorized(new { mensaje = "No se pudo determinar el email del usuario." });

            using (var connection = new SqlConnection(_connectionString))
            {
                connection.Open();
                string sql = "SELECT SALDO FROM USUARIO WHERE EMAIL = @Email";
                using (var cmd = new SqlCommand(sql, connection))
                {
                    cmd.Parameters.AddWithValue("@Email", email);
                    var result = cmd.ExecuteScalar();
                    if (result == null || result == DBNull.Value)
                        return NotFound(new { mensaje = "Usuario no encontrado." });
                    return Ok(new { saldo = Convert.ToDecimal(result) });
                }
            }
        }
    }
}