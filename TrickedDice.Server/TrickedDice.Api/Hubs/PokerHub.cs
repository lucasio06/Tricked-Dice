using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.SignalR;
using System.Security.Claims;
using TrickedDice.Api.Services;

namespace TrickedDice.Api.Hubs
{
    [Authorize]
    public class PokerHub : Hub
    {
        private readonly PokerGameService _gameService;

        public PokerHub(PokerGameService gameService)
        {
            _gameService = gameService;
        }

        public async Task Repartir(decimal monto)
        {
            var email = Context.User?.FindFirst(ClaimTypes.Email)?.Value;
            if (string.IsNullOrEmpty(email)) return;

            try
            {
                var resultado = _gameService.Repartir(email, monto);
                await Clients.Caller.SendAsync("ManoRepartida", resultado);
            }
            catch (InvalidOperationException ex)
            {
                await Clients.Caller.SendAsync("Error", ex.Message);
            }
        }

        public async Task CambiarCartas(List<string> mano, List<int> indices, decimal montoApostado)
        {
            var email = Context.User?.FindFirst(ClaimTypes.Email)?.Value;
            if (string.IsNullOrEmpty(email)) return;

            try
            {
                var resultado = _gameService.Cambiar(email, mano, indices, montoApostado);
                await Clients.Caller.SendAsync("CartasCambiadas", resultado);
            }
            catch (Exception ex)
            {
                await Clients.Caller.SendAsync("Error", ex.Message);
            }
        }
    }
}