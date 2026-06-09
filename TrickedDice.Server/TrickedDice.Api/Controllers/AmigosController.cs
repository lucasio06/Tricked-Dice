using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Security.Claims;
using TrickedDice.Api.Models;
using TrickedDice.Api.Repositories.Interfaces;

namespace TrickedDice.Api.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    [Authorize]
    public class AmigosController : ControllerBase
    {
        private readonly IUsuarioRepository _usuarioRepo;

        public AmigosController(IUsuarioRepository usuarioRepo)
        {
            _usuarioRepo = usuarioRepo;
        }

        [HttpGet]
        public async Task<IActionResult> GetAmigos()
        {
            var usuario = await ObtenerUsuarioAutenticadoAsync();
            if (usuario == null) return Unauthorized(new { mensaje = "Token inválido o usuario no encontrado." });

            var listaAmigos = await _usuarioRepo.GetAmigosYPendientesAsync(usuario.IdUsuario);
            return Ok(listaAmigos);
        }

        [HttpPost("enviar")]
        public async Task<IActionResult> EnviarSolicitud([FromBody] SolicitarAmigoModel model)
        {
            var usuario = await ObtenerUsuarioAutenticadoAsync();
            if (usuario == null) return Unauthorized();

            if (usuario.IdUsuario == model.IdReceptor)
                return BadRequest(new { mensaje = "No puedes enviarte una solicitud a ti mismo." });

            var exito = await _usuarioRepo.EnviarSolicitudAmistadAsync(usuario.IdUsuario, model.IdReceptor);
            
            if (!exito) return BadRequest(new { mensaje = "La solicitud ya existe o ha ocurrido un error." });

            return Ok(new { mensaje = "Solicitud enviada correctamente." });
        }

        [HttpPut("responder")]
        public async Task<IActionResult> ResponderSolicitud([FromBody] ResponderAmigoModel model)
        {
            var usuario = await ObtenerUsuarioAutenticadoAsync();
            if (usuario == null) return Unauthorized();

            if (model.Respuesta != "Aceptado" && model.Respuesta != "Rechazado")
                return BadRequest(new { mensaje = "Respuesta no válida." });

            var exito = await _usuarioRepo.ResponderSolicitudAmistadAsync(model.IdSolicitante, usuario.IdUsuario, model.Respuesta);

            if (!exito) return BadRequest(new { mensaje = "No se pudo procesar la solicitud. Es posible que ya no exista." });

            return Ok(new { mensaje = $"Solicitud {model.Respuesta.ToLower()} correctamente." });
        }

        private async Task<UsuarioPerfilDto?> ObtenerUsuarioAutenticadoAsync()
        {
            var email = User.FindFirst(ClaimTypes.Email)?.Value;
            if (string.IsNullOrEmpty(email)) return null;

            return await _usuarioRepo.GetUsuarioPorEmailAsync(email);
        }
    }

    public record SolicitarAmigoModel(int IdReceptor);
    public record ResponderAmigoModel(int IdSolicitante, string Respuesta);
}