using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.IdentityModel.Tokens;
using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using System.Text.RegularExpressions;
using Google.Apis.Auth;
using TrickedDice.Api.Models;
using TrickedDice.Api.Repositories.Interfaces;

namespace TrickedDice.Api.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    [Authorize]
    public class UsuariosController : ControllerBase
    {
        private readonly IUsuarioRepository _usuarioRepo;
        private readonly IConfiguration _config;

        public UsuariosController(IUsuarioRepository usuarioRepo, IConfiguration config)
        {
            _usuarioRepo = usuarioRepo;
            _config = config;
        }

        [AllowAnonymous]
        [HttpPost("registro")]
        public async Task<IActionResult> Registrar([FromBody] RegistroModel model)
        {
            if (string.IsNullOrWhiteSpace(model.NombreUsuario) || string.IsNullOrWhiteSpace(model.Email))
                return BadRequest("El nombre de usuario y el email son campos obligatorios.");

            var edad = DateTime.Today.Year - model.FechaNacimiento.Year;
            if (model.FechaNacimiento.Date > DateTime.Today.AddYears(-edad)) edad--;
            if (edad < 18) return BadRequest("Debes ser mayor de 18 años para registrarte.");
            if (!ValidarContrasena(model.Password)) return BadRequest("La contraseña no cumple los requisitos de seguridad.");
            if (!ValidarDNI(model.Dni)) return BadRequest("El DNI introducido no es válido.");

            string hash = BCrypt.Net.BCrypt.HashPassword(model.Password);
            var exito = await _usuarioRepo.RegistrarUsuarioAsync(model, hash);
            
            if (!exito) return Conflict("El email o nombre de usuario ya está en uso.");
            return Ok(new { msg = "Usuario registrado correctamente." });
        }

        [AllowAnonymous]
        [HttpPost("login")]
        public async Task<IActionResult> Login([FromBody] LoginModel model)
        {
            var usuario = await _usuarioRepo.GetUsuarioPorEmailAsync(model.Email);
            
            if (usuario == null || !BCrypt.Net.BCrypt.Verify(model.Password, usuario.Contrasena))
                return Unauthorized(new { mensaje = "Credenciales incorrectas." });
                
            if (usuario.Baneado)
                return Unauthorized(new { mensaje = "Tu cuenta ha sido baneada. Contacta con soporte." });

            var token = GenerarToken(usuario.Nombre, usuario.Email, usuario.Rol);
            return Ok(new { token = token, nombre = usuario.Nombre, saldo = usuario.Saldo, rol = usuario.Rol });
        }

        [AllowAnonymous]
        [HttpPost("google-login")]
        public async Task<IActionResult> GoogleLogin([FromBody] GoogleLoginModel model)
        {
            try
            {
                var payload = await GoogleJsonWebSignature.ValidateAsync(model.IdToken);
                string email = payload.Email;
                string nombre = payload.GivenName ?? "Usuario";
                string apellido = payload.FamilyName ?? "Google";

                var usuario = await _usuarioRepo.GetUsuarioPorEmailAsync(email);

                if (usuario != null)
                {
                    if (usuario.Baneado) return Unauthorized("Tu cuenta ha sido baneada. Contacta con soporte.");
                    
                    var tokenExistente = GenerarToken(usuario.Nombre, email, usuario.Rol);
                    return Ok(new { token = tokenExistente, nombre = usuario.Nombre, saldo = usuario.Saldo, rol = usuario.Rol, esNuevo = false });
                }

                string dniTemporal = "TMP" + Guid.NewGuid().ToString()[..6].ToUpper();
                await _usuarioRepo.RegistrarGoogleUsuarioAsync(email, nombre, apellido, email.Split('@')[0], dniTemporal);
                
                var tokenNuevo = GenerarToken(nombre, email, "User");
                return Ok(new { token = tokenNuevo, nombre = nombre, saldo = 0m, rol = "User", esNuevo = true });
            }
            catch (InvalidJwtException)
            {
                return Unauthorized("El token de Google ha expirado o es inválido.");
            }
        }

        [HttpPost("completar-perfil")]
        public async Task<IActionResult> CompletarPerfil([FromBody] CompletarPerfilModel model)
        {
            var email = User.FindFirst(ClaimTypes.Email)?.Value;
            if (string.IsNullOrEmpty(email)) return Unauthorized("Token inválido.");

            var edad = DateTime.Today.Year - model.FechaNacimiento.Year;
            if (model.FechaNacimiento.Date > DateTime.Today.AddYears(-edad)) edad--;
            if (edad < 18) return BadRequest(new { mensaje = "Debes ser mayor de 18 años para apostar." });
            if (!ValidarDNI(model.Dni)) return BadRequest(new { mensaje = "El DNI introducido no es válido." });

            var exito = await _usuarioRepo.CompletarPerfilAsync(email, model.Dni, model.FechaNacimiento);
            if (!exito) return Conflict(new { mensaje = "Este DNI ya está registrado en otra cuenta." });
            
            return Ok(new { msg = "Perfil completado correctamente." });
        }

        [HttpGet("perfil")]
        public async Task<IActionResult> GetPerfil()
        {
            var email = User.FindFirst(ClaimTypes.Email)?.Value;
            if (string.IsNullOrEmpty(email)) return Unauthorized();

            var usuario = await _usuarioRepo.GetUsuarioPorEmailAsync(email);
            if (usuario == null) return NotFound(new { mensaje = "Usuario no encontrado." });

            return Ok(new { nombre = usuario.Nombre, email = usuario.Email, saldo = usuario.Saldo, rol = usuario.Rol });
        }

        [HttpGet("saldo")]
        public async Task<IActionResult> GetSaldo()
        {
            var email = User.FindFirst(ClaimTypes.Email)?.Value;
            if (string.IsNullOrEmpty(email)) return Unauthorized();

            var usuario = await _usuarioRepo.GetUsuarioPorEmailAsync(email);
            if (usuario == null) return NotFound();

            return Ok(new { saldo = usuario.Saldo });
        }

        [HttpPut("recargar")]
        public async Task<IActionResult> RecargarSaldo([FromBody] RecargaModel model)
        {
            var email = User.FindFirst(ClaimTypes.Email)?.Value;
            if (string.IsNullOrEmpty(email)) return Unauthorized();

            var nuevoSaldo = await _usuarioRepo.RecargarSaldoAsync(email, model.Cantidad);
            if (nuevoSaldo == null) return NotFound("Usuario no encontrado.");
            
            return Ok(new { saldo = nuevoSaldo });
        }

        [HttpGet("transacciones")]
        public async Task<IActionResult> GetMisTransacciones()
        {
            var email = User.FindFirst(ClaimTypes.Email)?.Value;
            if (string.IsNullOrEmpty(email)) return Unauthorized();

            var transacciones = await _usuarioRepo.GetTransaccionesUsuarioAsync(email);
            return Ok(transacciones);
        }

        private bool ValidarContrasena(string password)
        {
            if (string.IsNullOrWhiteSpace(password)) return false;
            return Regex.IsMatch(password, @"^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&#])[A-Za-z\d@$!%*?&#]{8,}$");
        }

        private bool ValidarDNI(string dni)
        {
            if (string.IsNullOrWhiteSpace(dni) || dni.Length != 9) return false;
            string letras = "TRWAGMYFPDXBNJZSQVHLCKE";
            if (!char.IsLetter(dni[8]) || !int.TryParse(dni[..8], out int numeros)) return false;
            return letras[numeros % 23] == char.ToUpper(dni[8]);
        }

        private string GenerarToken(string nombre, string email, string rol = "User")
        {
            var credentials = new SigningCredentials(new SymmetricSecurityKey(Encoding.UTF8.GetBytes(_config["Jwt:Key"]!)), SecurityAlgorithms.HmacSha256);
            var claims = new[] { new Claim(ClaimTypes.Name, nombre), new Claim(ClaimTypes.Email, email), new Claim(ClaimTypes.Role, rol) };
            var token = new JwtSecurityToken(_config["Jwt:Issuer"], _config["Jwt:Audience"], claims, expires: DateTime.Now.AddMinutes(120), signingCredentials: credentials);
            return new JwtSecurityTokenHandler().WriteToken(token);
        }
    }
}