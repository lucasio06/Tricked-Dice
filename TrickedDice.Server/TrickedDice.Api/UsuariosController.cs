using Microsoft.AspNetCore.Mvc;
using Microsoft.Data.SqlClient;
using BCrypt.Net;

namespace TrickedDice.Api.Controllers {
    [ApiController]
    [Route("api/[controller]")]
    public class UsuariosController : ControllerBase {
        private readonly string? _conn;
        public UsuariosController(IConfiguration config) { _conn = config.GetConnectionString("DefaultConnection"); }

        [HttpPost("registro")]
        public IActionResult Registrar([FromBody] RegistroModel model) {
            string hash = BCrypt.Net.BCrypt.HashPassword(model.Password); // Seguridad RNF03
            try {
                using (SqlConnection c = new SqlConnection(_conn)) {
                    c.Open();
                    string sql = "INSERT INTO USUARIO (NOMBRE, EMAIL, CONTRASENA, SALDO) VALUES (@n, @e, @p, 1000)";
                    using (SqlCommand cmd = new SqlCommand(sql, c)) {
                        cmd.Parameters.AddWithValue("@n", model.Nombre);
                        cmd.Parameters.AddWithValue("@e", model.Email);
                        cmd.Parameters.AddWithValue("@p", hash);
                        cmd.ExecuteNonQuery();
                    }
                }
                return Ok(new { msg = "Registrado correctamente" });
            } catch (Exception ex) { return BadRequest(ex.Message); }
        }
    }
    public record RegistroModel(string Nombre, string Email, string Password);
}