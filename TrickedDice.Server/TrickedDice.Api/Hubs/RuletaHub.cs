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

        public async Task Girar(string mesaId, decimal monto, string tipoApuesta, string valorApuesta)
        {
            var email = ObtenerEmail();
            if (string.IsNullOrEmpty(email))
            {
                await Clients.Caller.SendAsync("Error", "No autorizado.");
                return;
            }

            try
            {
                var resultado = _service.GirarRuleta(email, monto, tipoApuesta, valorApuesta);
                await Clients.Caller.SendAsync("ResultadoGiro", resultado);
            }
            catch (Exception ex)
            {
                await Clients.Caller.SendAsync("Error", ex.Message);
            }
        }

        public async Task GirarMultiple(string mesaId, List<ApuestaDto> apuestas)
        {
            var email = ObtenerEmail();
            if (string.IsNullOrEmpty(email))
            {
                await Clients.Caller.SendAsync("Error", "No autorizado.");
                return;
            }

            try
            {
                var resultado = _service.GirarRuletaMultiple(email, apuestas);
                await Clients.Caller.SendAsync("ResultadoGiro", resultado);
            }
            catch (Exception ex)
            {
                await Clients.Caller.SendAsync("Error", ex.Message);
            }
        }

        public async Task UnirseMesaRuleta(string mesaId)
        {
            await Groups.AddToGroupAsync(Context.ConnectionId, $"ruleta_{mesaId}");
        }

        public async Task AgregarApuestaMesa(string mesaId, ApuestaDto apuesta)
        {
            var email = ObtenerEmail();
            if (string.IsNullOrEmpty(email))
            {
                await Clients.Caller.SendAsync("Error", "No autorizado.");
                return;
            }
            await _service.AgregarApuestaMesa(mesaId, email, apuesta);
            await Clients.Group($"ruleta_{mesaId}").SendAsync("ApuestaAgregadaMesa", email, apuesta);
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
                var resultados = await _service.GirarMesa(mesaId, email);
                await Clients.Group($"ruleta_{mesaId}").SendAsync("ResultadoMesa", resultados);
            }
            catch (Exception ex)
            {
                await Clients.Caller.SendAsync("Error", ex.Message);
            }
        }
    }
}