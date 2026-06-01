using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.SignalR;
using TrickedDice.Api.Hubs;
using TrickedDice.Api.Repositories.Interfaces;

namespace TrickedDice.Api.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    [Authorize(Roles = "Admin")]
    public class AdminController : ControllerBase
    {
        private readonly IAdminRepository _adminRepo;
        private readonly IHubContext<LobbyHub> _lobbyHub;
        private readonly IHubContext<RuletaHub> _ruletaHub;
        private readonly IHubContext<BlackjackHub> _blackjackHub;
        private readonly IHubContext<PokerHub> _pokerHub;

        public AdminController(
            IAdminRepository adminRepo, 
            IHubContext<LobbyHub> lobbyHub,
            IHubContext<RuletaHub> ruletaHub,
            IHubContext<BlackjackHub> blackjackHub,
            IHubContext<PokerHub> pokerHub)
        {
            _adminRepo = adminRepo;
            _lobbyHub = lobbyHub;
            _ruletaHub = ruletaHub;
            _blackjackHub = blackjackHub;
            _pokerHub = pokerHub;
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
            
            if (model.Baneado)
            {
                var usuarios = await _adminRepo.GetUsuariosAsync();
                var usuarioBaneado = usuarios.FirstOrDefault(u => u.IdUsuario == idUsuario);
                if (usuarioBaneado != null)
                {
                    await _lobbyHub.Clients.All.SendAsync("ForceLogout", usuarioBaneado.Email);
                    await _ruletaHub.Clients.All.SendAsync("ForceLogout", usuarioBaneado.Email);
                    await _blackjackHub.Clients.All.SendAsync("ForceLogout", usuarioBaneado.Email);
                    await _pokerHub.Clients.All.SendAsync("ForceLogout", usuarioBaneado.Email);
                }
            }
            
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