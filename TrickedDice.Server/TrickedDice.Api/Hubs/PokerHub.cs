using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.SignalR;
using System.Security.Claims;
using TrickedDice.Api.Services;

namespace TrickedDice.Api.Hubs
{
    [Authorize]
    public class PokerHub : Hub
    {
        private readonly PokerService _pokerService;

        public PokerHub(PokerService pokerService)
        {
            _pokerService = pokerService;
        }

        private string? GetEmail() => Context.User?.FindFirst(ClaimTypes.Email)?.Value;
        private string? GetUserName() => Context.User?.FindFirst(ClaimTypes.Name)?.Value ?? Context.User?.FindFirst("unique_name")?.Value ?? GetEmail();

        public async Task UnirseMesa(string roomId)
        {
            await Groups.AddToGroupAsync(Context.ConnectionId, roomId);
            var mesa = _pokerService.ObtenerOCrearMesa(roomId);
            await Clients.Caller.SendAsync("MesaActualizada", mesa);
        }

        public async Task Sentarse(string roomId, decimal buyIn)
        {
            var email = GetEmail();
            if (string.IsNullOrEmpty(email)) return;

            var mesa = _pokerService.ObtenerOCrearMesa(roomId);
            
            lock (mesa.LockObj)
            {
                if (!mesa.Jugadores.ContainsKey(email))
                {
                    mesa.Jugadores[email] = new JugadorPoker
                    {
                        Email = email,
                        NombreUsuario = GetUserName() ?? "Jugador",
                        Saldo = buyIn
                    };
                }
            }
            
            await Clients.Group(roomId).SendAsync("MesaActualizada", mesa);
        }

        public async Task IniciarMano(string roomId)
        {
            _pokerService.IniciarMano(roomId);
            var mesa = _pokerService.ObtenerMesa(roomId);
            
            if (mesa != null)
            {
                await Clients.Group(roomId).SendAsync("MesaActualizada", mesa);
            }
        }

        public async Task AccionJugador(string roomId, string accion, decimal cantidad = 0)
        {
            var email = GetEmail();
            if (string.IsNullOrEmpty(email)) return;

            var mesa = _pokerService.ObtenerMesa(roomId);
            if (mesa == null) return;

            lock (mesa.LockObj)
            {
                if (!mesa.Jugadores.TryGetValue(email, out var jugador)) return;
                if (jugador.Folded || jugador.AllIn) return;

                jugador.HaActuado = true;

                switch (accion.ToLower())
                {
                    case "fold":
                        jugador.Folded = true;
                        break;

                    case "check":
                        break;

                    case "call":
                        decimal diferenciaCall = mesa.ApuestaActual - jugador.ApuestaActual;
                        if (jugador.Saldo <= diferenciaCall)
                        {
                            jugador.ApuestaActual += jugador.Saldo;
                            jugador.Saldo = 0;
                            jugador.AllIn = true;
                        }
                        else
                        {
                            jugador.Saldo -= diferenciaCall;
                            jugador.ApuestaActual += diferenciaCall;
                        }
                        break;

                    case "raise":
                        decimal diferenciaRaise = cantidad - jugador.ApuestaActual;
                        if (jugador.Saldo <= diferenciaRaise)
                        {
                            jugador.ApuestaActual += jugador.Saldo;
                            jugador.Saldo = 0;
                            jugador.AllIn = true;
                        }
                        else
                        {
                            jugador.Saldo -= diferenciaRaise;
                            jugador.ApuestaActual += diferenciaRaise;
                        }
                        mesa.ApuestaActual = jugador.ApuestaActual;
                        break;
                }

                _pokerService.AvanzarTurno(mesa);
            }

            await Clients.Group(roomId).SendAsync("MesaActualizada", mesa);
        }
    }
}