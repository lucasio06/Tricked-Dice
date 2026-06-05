using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.SignalR;
using TrickedDice.Api.Services;
using TrickedDice.Api.Extensions;

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
            var email = Context.User?.GetEmail();
            if (string.IsNullOrEmpty(email)) return;

            var validacion = _gameService.ValidarUsuario(email, monto);
            if (validacion == null)
            {
                await Clients.Caller.SendAsync("Error", "Saldo insuficiente.");
                return;
            }

            var idPartida = _gameService.IniciarPartida(email, Context.User?.GetUserName() ?? "Anónimo", monto, tableId);
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
                var resultados = new Dictionary<string, object>();
                foreach (var kvp in mesa.ManosJugadores)
                {
                    var nuevoSaldo = _gameService.ResolverPartida(kvp.Key, kvp.Value.Email);
                    var partida = kvp.Value;
                    int puntosJugador = _service.ValorMano(partida.ManoJugador);
                    int puntosCrupier = _service.ValorMano(mesa.ManoCrupier);
                    var resultado = _service.ObtenerResultado(kvp.Key);
                    bool gano = resultado == "jugador";
                    decimal premio = gano ? partida.Monto * 2 : (resultado == "empate" ? partida.Monto : 0);

                    resultados[kvp.Value.Email] = new
                    {
                        gano = gano,
                        premio = premio,
                        saldoActualizado = nuevoSaldo,
                        puntosJugador = puntosJugador,
                        puntosCrupier = puntosCrupier,
                        montoApostado = partida.Monto
                    };
                }

                await Clients.Group(tableId).SendAsync("MesaFinalizada", new { mesa, resultados });

                _service.LimpiarMesa(tableId);
            }
            else
            {
                await Clients.Group(tableId).SendAsync("MesaActualizada", mesa);
            }
        }
    }
}