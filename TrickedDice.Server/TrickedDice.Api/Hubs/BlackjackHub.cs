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

        private string? GetEmail() => Context.User?.FindFirst(ClaimTypes.Email)?.Value;
        private string? GetUserName() => Context.User?.FindFirst(ClaimTypes.Name)?.Value ?? Context.User?.FindFirst("unique_name")?.Value ?? GetEmail();

        public async Task JoinTable(string tableId)
        {
            await Groups.AddToGroupAsync(Context.ConnectionId, tableId);
            var mesa = _service.ObtenerMesa(tableId);
            if (mesa != null)
            {
                await Clients.Caller.SendAsync("MesaActualizada", mesa);
            }
        }

        public async Task Repartir(string tableId, decimal monto)
        {
            var email = GetEmail();
            if (string.IsNullOrEmpty(email)) return;

            var validacion = _gameService.ValidarUsuario(email, monto);
            if (validacion == null)
            {
                await Clients.Caller.SendAsync("Error", "Saldo insuficiente.");
                return;
            }

            var idPartida = _gameService.IniciarPartida(email, GetUserName() ?? "Anónimo", monto, tableId);
            await Clients.Caller.SendAsync("PartidaIniciada", new { idPartida, saldo = validacion.Value.saldoActual - monto });

            var mesa = _service.ObtenerMesa(tableId);
            await Clients.Group(tableId).SendAsync("MesaActualizada", mesa);
        }

        public async Task PedirCarta(string partidaId, string tableId)
        {
            _service.PedirCarta(partidaId);
            var partida = _service.ObtenerPartida(partidaId);
            if (partida != null && _service.ValorMano(partida.ManoJugador) > 21)
            {
                _service.Plantarse(partidaId);
                await CheckMesaFinalizada(tableId);
            }
            else
            {
                var mesa = _service.ObtenerMesa(tableId);
                await Clients.Group(tableId).SendAsync("MesaActualizada", mesa);
            }
        }

        public async Task Plantarse(string partidaId, string tableId)
        {
            _service.Plantarse(partidaId);
            await CheckMesaFinalizada(tableId);
        }

        private async Task CheckMesaFinalizada(string tableId)
        {
            var mesa = _service.ObtenerMesa(tableId);
            if (mesa != null && mesa.ManosJugadores.Count > 0 && mesa.ManosJugadores.Values.All(p => p.Terminada))
            {
                await Clients.Group(tableId).SendAsync("MesaFinalizada", mesa);

                foreach (var kvp in mesa.ManosJugadores)
                {
                    _gameService.ResolverPartida(kvp.Key, kvp.Value.Email);
                }
                
                _service.LimpiarMesa(tableId);
            }
            else
            {
                await Clients.Group(tableId).SendAsync("MesaActualizada", mesa);
            }
        }
    }
}