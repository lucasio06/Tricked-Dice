using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.SignalR;
using System.Collections.Concurrent;
using System.Security.Claims;
using System.Threading;
using System.Threading.Tasks;
using TrickedDice.Api.Services;

namespace TrickedDice.Api.Hubs
{
    [Authorize]
    public class PokerHub : Hub
    {
        private readonly PokerService _pokerService;
        private readonly IHubContext<PokerHub> _hubContext;
        private static readonly ConcurrentDictionary<string, string> ConexionesMesas = new();
        private static readonly ConcurrentDictionary<string, CancellationTokenSource> _turnTimers = new();

        public PokerHub(PokerService pokerService, IHubContext<PokerHub> hubContext)
        {
            _pokerService = pokerService;
            _hubContext = hubContext;
        }

        private string? GetEmail() => Context.User?.FindFirst(ClaimTypes.Email)?.Value;
        private string? GetUserName() => Context.User?.FindFirst(ClaimTypes.Name)?.Value ?? Context.User?.FindFirst("unique_name")?.Value ?? GetEmail();

        public override async Task OnDisconnectedAsync(Exception? exception)
        {
            if (ConexionesMesas.TryGetValue(Context.ConnectionId, out var roomId))
            {
                var email = GetEmail();
                if (!string.IsNullOrEmpty(email))
                {
                    bool turnoAvanzado = _pokerService.AutoFoldDesconectado(roomId, email);
                    var mesa = _pokerService.ObtenerMesa(roomId);
                    if (mesa != null)
                    {
                        mesa.UltimoMensaje = $"{GetUserName()} se ha desconectado.";
                        if (turnoAvanzado) IniciarTemporizadorTurno(roomId, mesa);
                        await Clients.Group(roomId).SendAsync("MesaActualizada", mesa);
                    }
                }
                ConexionesMesas.TryRemove(Context.ConnectionId, out _);
            }
            await base.OnDisconnectedAsync(exception);
        }

        private void IniciarTemporizadorTurno(string roomId, MesaPoker mesa)
        {
            lock (mesa.LockObj)
            {
                if (mesa.Fase == PokerFase.Showdown) return;
                mesa.TurnoId = Guid.NewGuid().ToString();
            }

            string turnoGuardado = mesa.TurnoId;
            string emailActual = mesa.TurnoActualEmail;

            if (_turnTimers.TryRemove(roomId, out var oldCts))
            {
                oldCts.Cancel();
                oldCts.Dispose();
            }

            var cts = new CancellationTokenSource();
            _turnTimers[roomId] = cts;
            var token = cts.Token;

            _ = Task.Run(async () =>
            {
                try
                {
                    await Task.Delay(60000, token);

                    bool seForzoFold = false;
                    lock (mesa.LockObj)
                    {
                        if (token.IsCancellationRequested) return;

                        if (mesa.TurnoId == turnoGuardado && mesa.TurnoActualEmail == emailActual && mesa.Fase != PokerFase.Showdown)
                        {
                            if (mesa.Jugadores.TryGetValue(emailActual, out var jugador) && !jugador.Folded && !jugador.AllIn)
                            {
                                jugador.Folded = true;
                                jugador.HaActuado = true;
                                _pokerService.AvanzarTurno(mesa);
                                mesa.UltimoMensaje = $"⏳ {jugador.NombreUsuario} se quedó sin tiempo y hace Fold.";
                                seForzoFold = true;
                            }
                        }
                    }

                    if (seForzoFold)
                    {
                        await _hubContext.Clients.Group(roomId).SendAsync("MesaActualizada", mesa);
                        IniciarTemporizadorTurno(roomId, mesa);
                    }
                }
                catch (TaskCanceledException)
                {
                    
                }
                catch (Exception ex)
                {
                    Console.WriteLine($"[CRÍTICO] Error en temporizador de Poker: {ex.Message}");
                }
            }, token);
        }

        public async Task UnirseMesa(string roomId)
        {
            await Groups.AddToGroupAsync(Context.ConnectionId, roomId);
            ConexionesMesas[Context.ConnectionId] = roomId;
            var mesa = _pokerService.ObtenerOCrearMesa(roomId);
            await Clients.Caller.SendAsync("MesaActualizada", mesa);
        }

        public async Task Sentarse(string roomId, decimal buyIn)
        {
            buyIn = Math.Round(buyIn, 2);
            var email = GetEmail();
            if (string.IsNullOrEmpty(email)) return;
            var mesa = _pokerService.ObtenerOCrearMesa(roomId);
            lock (mesa.LockObj)
            {
                if (!mesa.Jugadores.ContainsKey(email))
                {
                    mesa.Jugadores[email] = new JugadorPoker { Email = email, NombreUsuario = GetUserName() ?? "Jugador", Saldo = buyIn };
                }
                else if (mesa.Jugadores[email].Saldo == 0 && mesa.Fase == PokerFase.Showdown)
                {
                    mesa.Jugadores[email].Saldo = buyIn;
                }
            }
            await Clients.Group(roomId).SendAsync("MesaActualizada", mesa);
        }

        public async Task IniciarMano(string roomId)
        {
            bool manoIniciada = _pokerService.IniciarMano(roomId);
            if (manoIniciada)
            {
                var mesa = _pokerService.ObtenerMesa(roomId);
                if (mesa != null)
                {
                    lock(mesa.LockObj) { IniciarTemporizadorTurno(roomId, mesa); }
                    await Clients.Group(roomId).SendAsync("MesaActualizada", mesa);
                }
            }
        }

        public async Task AccionJugador(string roomId, string accion, decimal cantidad = 0)
        {
            cantidad = Math.Round(cantidad, 2);
            var email = GetEmail();
            if (string.IsNullOrEmpty(email)) return;
            var mesa = _pokerService.ObtenerMesa(roomId);
            if (mesa == null) return;

            lock (mesa.LockObj)
            {
                if (!mesa.Jugadores.TryGetValue(email, out var jugador)) return;
                if (jugador.Folded || jugador.AllIn || mesa.TurnoActualEmail != email) return;

                jugador.HaActuado = true;
                switch (accion.ToLower())
                {
                    case "fold": jugador.Folded = true; break;
                    case "check": if (jugador.ApuestaActual < mesa.ApuestaActual) return; break;
                    case "call":
                        decimal dCall = mesa.ApuestaActual - jugador.ApuestaActual;
                        if (jugador.Saldo <= dCall) { jugador.ApuestaActual += jugador.Saldo; jugador.Saldo = 0; jugador.AllIn = true; }
                        else { jugador.Saldo -= dCall; jugador.ApuestaActual += dCall; }
                        break;
                    case "raise":
                        if (cantidad <= 0) return;
                        decimal dRaise = cantidad - jugador.ApuestaActual;
                        if (jugador.Saldo <= dRaise) { jugador.ApuestaActual += jugador.Saldo; jugador.Saldo = 0; jugador.AllIn = true; }
                        else { jugador.Saldo -= dRaise; jugador.ApuestaActual += dRaise; }
                        mesa.ApuestaActual = jugador.ApuestaActual;
                        foreach (var j in mesa.Jugadores.Values) if (j.Email != email && !j.Folded && !j.AllIn) j.HaActuado = false;
                        break;
                }
                _pokerService.AvanzarTurno(mesa);
                IniciarTemporizadorTurno(roomId, mesa);
            }
            await Clients.Group(roomId).SendAsync("MesaActualizada", mesa);
        }
    }
}