using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using TrickedDice.Api.Repositories.Interfaces;

namespace TrickedDice.Api.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    [Authorize(Roles = "Admin")]
    public class AdminController : ControllerBase
    {
        private readonly IAdminRepository _adminRepo;

        public AdminController(IAdminRepository adminRepo)
        {
            _adminRepo = adminRepo;
        }

        [HttpGet("usuarios")]
        public async Task<IActionResult> GetUsuarios()
        {
            var usuarios = await _adminRepo.GetUsuariosAsync();
            return Ok(usuarios);
        }

        [HttpGet("transacciones")]
        public async Task<IActionResult> GetTransacciones()
        {
            var transacciones = await _adminRepo.GetTransaccionesAsync();
            return Ok(transacciones);
        }

        [HttpGet("estadisticas")]
        public async Task<IActionResult> GetEstadisticas()
        {
            var stats = await _adminRepo.GetEstadisticasAsync();
            return Ok(stats);
        }

        [HttpPut("banear/{idUsuario}")]
        public async Task<IActionResult> BanearUsuario(int idUsuario, [FromBody] BanearModel model)
        {
            var exito = await _adminRepo.CambiarEstadoBaneoAsync(idUsuario, model.Baneado);
            if (!exito) return NotFound(new { mensaje = "Usuario no encontrado." });
            
            return Ok(new { mensaje = model.Baneado ? "Usuario baneado." : "Usuario desbaneado." });
        }
        
        [HttpPut("cambiar-rol/{idUsuario}")]
        public async Task<IActionResult> CambiarRolUsuario(int idUsuario, [FromBody] CambiarRolModel model)
        {
            if (model.Rol != "Admin" && model.Rol != "User")
                return BadRequest(new { mensaje = "El rol especificado no es válido." });

            var exito = await _adminRepo.CambiarRolUsuarioAsync(idUsuario, model.Rol);
            if (!exito) return NotFound(new { mensaje = "Usuario no encontrado." });
            
            return Ok(new { mensaje = $"Rol actualizado a {model.Rol} correctamente." });
        }

        public class BanearModel { public bool Baneado { get; set; } }
        public class CambiarRolModel { public required string Rol { get; set; } }
    }
}