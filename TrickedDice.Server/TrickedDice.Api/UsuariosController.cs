using Microsoft.AspNetCore.Mvc;
using Microsoft.Data.SqlClient;
using BCrypt.Net;
using Microsoft.IdentityModel.Tokens;
using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;

namespace TrickedDice.Api.Controllers {
    [ApiController]
    [Route("api/[controller]")]
    public class UsuariosController : ControllerBase {
        private readonly string? _conn;
        private readonly IConfiguration _config;

        public UsuariosController(IConfiguration config) { 
            _conn = config.GetConnectionString("DefaultConnection"); 
            _config = config;
        }

        [HttpPost("registro")]
        public IActionResult Registrar([FromBody] RegistroModel model) {
            // Hasheo de contraseñas en el registro.
            string hash = BCrypt.Net.BCrypt.HashPassword(model.Password); 
            
            try {
                using (SqlConnection c = new SqlConnection(_conn)) {
                    c.Open();
                    // Definición de la query en la base de datos.
                    string sql = @"INSERT INTO USUARIO 
                        (EMAIL, CONTRASENA, NOMBRE, PRIMER_APELLIDO, SEGUNDO_APELLIDO, 
                         NOMBRE_USUARIO, NICKNAME, FECHA_NACIMIENTO, DNI, SALDO) 
                        VALUES (@e, @p, @n, @pa, @sa, @nu, @nick, @fn, @dni, 1000)";
                    
                    using (SqlCommand cmd = new SqlCommand(sql, c)) {
                        cmd.Parameters.AddWithValue("@e", model.Email);
                        cmd.Parameters.AddWithValue("@p", hash);
                        cmd.Parameters.AddWithValue("@n", model.Nombre);
                        cmd.Parameters.AddWithValue("@pa", model.PrimerApellido);
                        cmd.Parameters.AddWithValue("@sa", (object?)model.SegundoApellido ?? DBNull.Value);
                        cmd.Parameters.AddWithValue("@nu", model.NombreUsuario);
                        cmd.Parameters.AddWithValue("@nick", (object?)model.Nickname ?? DBNull.Value);
                        cmd.Parameters.AddWithValue("@fn", model.FechaNacimiento);
                        cmd.Parameters.AddWithValue("@dni", model.Dni);
                        
                        cmd.ExecuteNonQuery();
                    }
                }
                return Ok(new { msg = "Usuario registrado" });
            } catch (Exception ex) { 
                return BadRequest("Error de dase de datos: " + ex.Message); 
            }
        }

        [HttpPost("login")]
        public IActionResult Login([FromBody] LoginModel model) {
            try {
                using (SqlConnection c = new SqlConnection(_conn)) {
                    c.Open();
                    string sql = "SELECT NOMBRE, CONTRASENA, SALDO FROM USUARIO WHERE EMAIL = @e";
                    using (SqlCommand cmd = new SqlCommand(sql, c)) {
                        cmd.Parameters.AddWithValue("@e", model.Email);
                        using (SqlDataReader r = cmd.ExecuteReader()) {
                            if (r.Read()) {
                                string hashDB = r["CONTRASENA"].ToString()!;
                                // Verificación del Hash BCrypt.
                                if (BCrypt.Net.BCrypt.Verify(model.Password, hashDB)) {
                                    var token = GenerarToken(r["NOMBRE"].ToString()!, model.Email);
                                    return Ok(new { 
                                        token = token, 
                                        nombre = r["NOMBRE"], 
                                        saldo = r["SALDO"] 
                                    });
                                }
                            }
                        }
                    }
                }
                return Unauthorized("Credenciales incorrectas.");
            } catch (Exception ex) { return StatusCode(500, ex.Message); }
        }

        private string GenerarToken(string nombre, string email) {
            var securityKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(_config["Jwt:Key"]!));
            var credentials = new SigningCredentials(securityKey, SecurityAlgorithms.HmacSha256);
            var claims = new[] { new Claim(ClaimTypes.Name, nombre), new Claim(ClaimTypes.Email, email) };
            var token = new JwtSecurityToken(_config["Jwt:Issuer"], _config["Jwt:Audience"], claims,
              expires: DateTime.Now.AddMinutes(120), signingCredentials: credentials);
            return new JwtSecurityTokenHandler().WriteToken(token);
        }
    }

    public record RegistroModel(
        string Email, string Password, string Nombre, string PrimerApellido, 
        string? SegundoApellido, string NombreUsuario, string? Nickname, 
        DateTime FechaNacimiento, string Dni
    );

    public record LoginModel(string Email, string Password);
}