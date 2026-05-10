using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.SignalR;
using System.Security.Claims;
using TrickedDice.Api.Services;

namespace TrickedDice.Api.Hubs
{
    [Authorize]
    public class BlackjackHub : Hub
    {
        private readonly BlackjackService _service;
        private readonly BlackjackGameService _gameService;

        public BlackjackHub(BlackjackService service, BlackjackGameService gameService)
        {
            _service = service;
            _gameService = gameService;
        }

        private string? GetEmail()
        {
            return Context.User?.FindFirst(ClaimTypes.Email)?.Value;
        }

        public async Task JoinTable(string tableId)
        {
            await Groups.AddToGroupAsync(Context.ConnectionId, tableId);
        }

        public async Task Repartir(string tableId, decimal monto)
        {
            var email = GetEmail();
            if (string.IsNullOrEmpty(email))
            {
                await Clients.Caller.SendAsync("Error", "No se pudo identificar al usuario.");
                return;
            }

            var validacion = _gameService.ValidarUsuario(email, monto);
            if (validacion == null)
            {
                await Clients.Caller.SendAsync("Error", "Saldo insuficiente o usuario no encontrado.");
                return;
            }

            var idPartida = _gameService.IniciarPartida(email, monto);
            var partida = _service.ObtenerPartida(idPartida);
            var nuevoSaldo = validacion.Value.saldoActual - monto;

            await Clients.Caller.SendAsync("CartasRepartidas", new
            {
                idPartida,
                manoJugador = partida!.ManoJugador,
                manoCrupier = partida.ManoCrupier,
                saldoActualizado = nuevoSaldo
            });
        }

        public async Task PedirCarta(string partidaId)
        {
            var email = GetEmail();
            if (string.IsNullOrEmpty(email))
            {
                await Clients.Caller.SendAsync("Error", "No autorizado.");
                return;
            }

            var carta = _service.PedirCarta(partidaId);
            var partida = _service.ObtenerPartida(partidaId);
            await Clients.Caller.SendAsync("CartaPedida", new
            {
                carta,
                manoJugador = partida?.ManoJugador
            });
        }

        public async Task Plantarse(string partidaId)
        {
            var email = GetEmail();
            if (string.IsNullOrEmpty(email))
            {
                await Clients.Caller.SendAsync("Error", "No autorizado.");
                return;
            }

            _service.Plantarse(partidaId);
            var partida = _service.ObtenerPartida(partidaId);
            if (partida == null)
            {
                await Clients.Caller.SendAsync("Error", "Partida no encontrada.");
                return;
            }

            var resultado = _service.ObtenerResultado(partidaId);
            var nuevoSaldo = _gameService.ResolverPartida(partidaId, email);

            await Clients.Caller.SendAsync("ResultadoBlackjack", new
            {
                resultado,
                manoCrupierCompleta = partida.ManoCrupier,
                saldoActualizado = nuevoSaldo
            });
        }
    }
}