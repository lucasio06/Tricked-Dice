using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Data.SqlClient;
using Microsoft.IdentityModel.Tokens;
using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using System.Text.RegularExpressions; // Requerido para usar Regex

namespace TrickedDice.Api.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    [Authorize]
    public class UsuariosController : ControllerBase
    {
        private readonly string? _conn;
        private readonly IConfiguration _config;
        private readonly ILogger<UsuariosController> _logger;

        public UsuariosController(IConfiguration config, ILogger<UsuariosController> logger)
        {
            _conn = config.GetConnectionString("DefaultConnection");
            _config = config;
            _logger = logger;
        }

        [AllowAnonymous]
        [HttpPost("registro")]
        public IActionResult Registrar([FromBody] RegistroModel model)
        {
            if (string.IsNullOrWhiteSpace(model.NombreUsuario) || string.IsNullOrWhiteSpace(model.Email))
            {
                return BadRequest("El nombre de usuario y el email son campos obligatorios.");
            }

            var edad = DateTime.Today.Year - model.FechaNacimiento.Year;
            if (model.FechaNacimiento.Date > DateTime.Today.AddYears(-edad)) edad--;
            if (edad < 18)
            {
                return BadRequest("Debes ser mayor de 18 años para registrarte.");
            }
            
            if (!ValidarContrasena(model.Password))
            {
                return BadRequest("La contraseña debe tener al menos 8 caracteres, incluir una mayúscula, una minúscula, un número y un carácter especial.");
            }

            if (!ValidarDNI(model.Dni))
            {
                return BadRequest("El DNI introducido no es válido.");
            }

            string hash = BCrypt.Net.BCrypt.HashPassword(model.Password);

            try
            {
                using (SqlConnection c = new SqlConnection(_conn))
                {
                    c.Open();
                    string sql = @"INSERT INTO USUARIO 
                        (EMAIL, CONTRASENA, NOMBRE, PRIMER_APELLIDO, SEGUNDO_APELLIDO, 
                         NOMBRE_USUARIO, NICKNAME, FECHA_NACIMIENTO, DNI, SALDO) 
                        VALUES (@e, @p, @n, @pa, @sa, @nu, @nick, @fn, @dni, 0)";

                    using (SqlCommand cmd = new SqlCommand(sql, c))
                    {
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
                return Ok(new { msg = "Usuario registrado correctamente." });
            }
            catch (SqlException ex) when (ex.Number == 2627 || ex.Number == 2601)
            {
                return Conflict("El email o nombre de usuario ya está en uso.");
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error interno al registrar usuario.");
                return StatusCode(500, "Error interno del servidor al registrar el usuario.");
            }
        }

        [AllowAnonymous]
        [HttpPost("login")]
        public IActionResult Login([FromBody] LoginModel model)
        {
            try
            {
                using (SqlConnection c = new SqlConnection(_conn))
                {
                    c.Open();
                    string sql = "SELECT ID_USUARIO, NOMBRE, CONTRASENA, SALDO, BANEADO FROM USUARIO WHERE EMAIL = @e";
                    using (SqlCommand cmd = new SqlCommand(sql, c))
                    {
                        cmd.Parameters.AddWithValue("@e", model.Email);
                        using (SqlDataReader r = cmd.ExecuteReader())
                        {
                            if (r.Read())
                            {
                                if (Convert.ToBoolean(r["BANEADO"]))
                                {
                                    return Unauthorized("Tu cuenta ha sido baneada. Contacta con soporte.");
                                }

                                string hashDB = r["CONTRASENA"].ToString()!;
                                if (BCrypt.Net.BCrypt.Verify(model.Password, hashDB))
                                {
                                    var token = GenerarToken(r["NOMBRE"].ToString()!, model.Email);
                                    return Ok(new
                                    {
                                        token = token,
                                        nombre = r["NOMBRE"],
                                        saldo = Convert.ToDecimal(r["SALDO"])
                                    });
                                }
                            }
                        }
                    }
                }
                return Unauthorized("Credenciales incorrectas.");
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error interno en login.");
                return StatusCode(500, "Error interno del servidor al iniciar sesión.");
            }
        }

        [HttpGet("perfil")]
        [Authorize]
        public IActionResult GetPerfil()
        {
            var email = User.FindFirst(ClaimTypes.Email)?.Value;
            if (string.IsNullOrEmpty(email))
            {
                return Unauthorized("Token inválido o email no encontrado.");
            }

            try
            {
                using (var connection = new SqlConnection(_conn))
                {
                    connection.Open();
                    string sql = "SELECT NOMBRE, EMAIL, SALDO FROM USUARIO WHERE EMAIL = @Email";
                    using (var cmd = new SqlCommand(sql, connection))
                    {
                        cmd.Parameters.AddWithValue("@Email", email);
                        using (var reader = cmd.ExecuteReader())
                        {
                            if (reader.Read())
                            {
                                return Ok(new
                                {
                                    nombre = reader["NOMBRE"].ToString(),
                                    email = reader["EMAIL"].ToString(),
                                    saldo = Convert.ToDecimal(reader["SALDO"])
                                });
                            }
                            return NotFound("Usuario no encontrado.");
                        }
                    }
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error interno al obtener perfil.");
                return StatusCode(500, "Error interno del servidor al obtener el perfil.");
            }
        }

        [HttpGet("saldo")]
        [Authorize]
        public IActionResult GetSaldo()
        {
            var email = User.FindFirst(ClaimTypes.Email)?.Value;
            if (string.IsNullOrEmpty(email))
            {
                return Unauthorized("Token inválido o email no encontrado.");
            }

            try
            {
                using (var connection = new SqlConnection(_conn))
                {
                    connection.Open();
                    string sql = "SELECT SALDO FROM USUARIO WHERE EMAIL = @Email";
                    using (var cmd = new SqlCommand(sql, connection))
                    {
                        cmd.Parameters.AddWithValue("@Email", email);
                        using (var reader = cmd.ExecuteReader())
                        {
                            if (reader.Read())
                            {
                                return Ok(new
                                {
                                    saldo = Convert.ToDecimal(reader["SALDO"])
                                });
                            }
                            return NotFound("Usuario no encontrado.");
                        }
                    }
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error interno al obtener saldo.");
                return StatusCode(500, "Error interno del servidor al obtener el saldo.");
            }
        }

        [HttpPut("recargar")]
        [Authorize]
        public IActionResult RecargarSaldo([FromBody] RecargaModel model)
        {
            var email = User.FindFirst(ClaimTypes.Email)?.Value;
            if (string.IsNullOrEmpty(email))
            {
                return Unauthorized("Token inválido o email no encontrado.");
            }

            using (SqlConnection c = new SqlConnection(_conn))
            {
                c.Open();
                SqlTransaction transaction = c.BeginTransaction();

                try
                {
                    int idUsuario;
                    decimal saldoActual;
                    string sqlGet = "SELECT ID_USUARIO, SALDO FROM USUARIO WHERE EMAIL = @Email";
                    using (var cmdGet = new SqlCommand(sqlGet, c, transaction))
                    {
                        cmdGet.Parameters.AddWithValue("@Email", email);
                        using (var reader = cmdGet.ExecuteReader())
                        {
                            if (!reader.Read())
                                return NotFound("Usuario no encontrado.");
                            idUsuario = reader.GetInt32(0);
                            saldoActual = reader.GetDecimal(1);
                        }
                    }

                    string sqlUpdate = "UPDATE USUARIO SET SALDO = SALDO + @cantidad WHERE ID_USUARIO = @idUsuario";
                    using (var cmdUpdate = new SqlCommand(sqlUpdate, c, transaction))
                    {
                        cmdUpdate.Parameters.AddWithValue("@cantidad", model.Cantidad);
                        cmdUpdate.Parameters.AddWithValue("@idUsuario", idUsuario);
                        cmdUpdate.ExecuteNonQuery();
                    }

                    decimal nuevoSaldo = saldoActual + model.Cantidad;

                    string sqlTrans = @"INSERT INTO TRANSACCION (ID_USUARIO, CANTIDAD, TIPO_TRANSACCION) 
                                       VALUES (@idUsuario, @cantidad, 'RECARGA')";
                    using (var cmdTrans = new SqlCommand(sqlTrans, c, transaction))
                    {
                        cmdTrans.Parameters.AddWithValue("@idUsuario", idUsuario);
                        cmdTrans.Parameters.AddWithValue("@cantidad", model.Cantidad);
                        cmdTrans.ExecuteNonQuery();
                    }

                    transaction.Commit();
                    return Ok(new { saldo = nuevoSaldo });
                }
                catch (Exception ex)
                {
                    transaction.Rollback();
                    _logger.LogError(ex, "Error al recargar saldo.");
                    return StatusCode(500, "Error interno al recargar saldo.");
                }
            }
        }

        [HttpGet("transacciones")]
        [Authorize]
        public IActionResult GetMisTransacciones()
        {
            var email = User.FindFirst(ClaimTypes.Email)?.Value;
            if (string.IsNullOrEmpty(email))
                return Unauthorized();

            try
            {
                using (var connection = new SqlConnection(_conn))
                {
                    connection.Open();
                    string sql = @"
                        SELECT T.FECHA_TRANSACCION, T.CANTIDAD, T.TIPO_TRANSACCION 
                        FROM TRANSACCION T
                        INNER JOIN USUARIO U ON T.ID_USUARIO = U.ID_USUARIO
                        WHERE U.EMAIL = @Email
                        ORDER BY T.FECHA_TRANSACCION DESC";
                    using (var cmd = new SqlCommand(sql, connection))
                    {
                        cmd.Parameters.AddWithValue("@Email", email);
                        using (var reader = cmd.ExecuteReader())
                        {
                            var transacciones = new List<object>();
                            while (reader.Read())
                            {
                                transacciones.Add(new
                                {
                                    fecha = reader.GetDateTime(0),
                                    cantidad = reader.GetDecimal(1),
                                    tipo = reader.GetString(2)
                                });
                            }
                            return Ok(transacciones);
                        }
                    }
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error al obtener transacciones.");
                return StatusCode(500, "Error interno del servidor.");
            }
        }

        private bool ValidarContrasena(string password)
        {
            if (string.IsNullOrWhiteSpace(password)) return false;
            string patron = @"^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$";
            
            return Regex.IsMatch(password, patron);
        }

        private bool ValidarDNI(string dni)
        {
            if (string.IsNullOrWhiteSpace(dni) || dni.Length != 9) return false;

            string letras = "TRWAGMYFPDXBNJZSQVHLCKE";
            string numerosPart = dni.Substring(0, 8);
            char letraPart = char.ToUpper(dni[8]);

            if (!char.IsLetter(letraPart)) return false;
            if (!int.TryParse(numerosPart, out int numeros)) return false;
            return letras[numeros % 23] == letraPart;
        }

        private string GenerarToken(string nombre, string email)
        {
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

    public record RecargaModel(decimal Cantidad);
}