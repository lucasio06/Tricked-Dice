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

        private string? GetEmail()
        {
            return Context.User?.FindFirst(ClaimTypes.Email)?.Value;
        }

        public async Task Girar(string mesaId, decimal monto, string tipoApuesta, string valorApuesta)
        {
            var email = GetEmail();
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
            var email = GetEmail();
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
    }
}