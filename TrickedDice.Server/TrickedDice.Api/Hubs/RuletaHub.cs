using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.SignalR;
using System.Security.Claims;
using TrickedDice.Api.Services;

namespace TrickedDice.Api.Hubs
{
    [Authorize]
    public class RuletaHub : Hub
    {
        private readonly RuletaService _service;

        public RuletaHub(RuletaService service)
        {
            _service = service;
        }

        private string? ObtenerEmail()
        {
            return Context.User?.FindFirst(ClaimTypes.Email)?.Value;
        }

        public async Task UnirseMesaRuleta(string mesaId)
        {
            await Groups.AddToGroupAsync(Context.ConnectionId, $"ruleta_{mesaId}");
        }

        public async Task NotificarInicioGiro(string mesaId)
        {
        var email = ObtenerEmail();
        if (string.IsNullOrEmpty(email)) return;

        var startTime = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds();
        await Clients.Group($"ruleta_{mesaId}").SendAsync("GiroIniciado", startTime);
        }

        public async Task AgregarApuestaMesa(string mesaId, ApuestaDto apuesta)
        {
            var email = ObtenerEmail();
            if (string.IsNullOrEmpty(email))
            {
                await Clients.Caller.SendAsync("Error", "No autorizado.");
                return;
            }
            
            var nombre = Context.User?.Identity?.Name ?? email;
            
            await _service.AgregarApuestaMesa(mesaId, email, nombre, apuesta);
            await Clients.Group($"ruleta_{mesaId}").SendAsync("ApuestaAgregadaMesa", nombre, apuesta);
        }

        public async Task GirarMesa(string mesaId)
        {
            var email = ObtenerEmail();
            if (string.IsNullOrEmpty(email))
            {
                await Clients.Caller.SendAsync("Error", "No autorizado.");
                return;
            }
            try
            {
                var resultados = await _service.GirarMesa(mesaId);
                await Clients.Group($"ruleta_{mesaId}").SendAsync("ResultadoMesa", resultados);
            }
            catch (Exception ex)
            {
                await Clients.Caller.SendAsync("Error", ex.Message);
            }
        }
    }
}