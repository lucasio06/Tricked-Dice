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
        private readonly ILogger<RuletaHub> _logger;

        public RuletaHub(RuletaService service, ILogger<RuletaHub> logger)
        {
            _service = service;
            _logger = logger;
        }

        private string? ObtenerEmail() => Context.User?.FindFirst(ClaimTypes.Email)?.Value;
        private string? ObtenerNombre() => Context.User?.FindFirst(ClaimTypes.Name)?.Value ?? ObtenerEmail();

        public override async Task OnConnectedAsync()
        {
            _logger.LogInformation("Cliente conectado a RuletaHub: {ConnectionId}", Context.ConnectionId);
            await base.OnConnectedAsync();
        }

        public override async Task OnDisconnectedAsync(Exception? exception)
        {
            _logger.LogInformation("Cliente desconectado de RuletaHub: {ConnectionId}", Context.ConnectionId);
            await base.OnDisconnectedAsync(exception);
        }

        public async Task UnirseMesaRuleta(string mesaId)
        {
            var email = ObtenerEmail();
            var nombre = ObtenerNombre();
            if (string.IsNullOrEmpty(email))
            {
                await Clients.Caller.SendAsync("Error", "No autorizado.");
                return;
            }
            _logger.LogInformation("UnirseMesaRuleta: {Nombre} ({Email}) en mesa {MesaId}", nombre, email, mesaId);
            await Groups.AddToGroupAsync(Context.ConnectionId, $"ruleta_{mesaId}");
            var estadoMesa = _service.UnirseMesa(mesaId, email, nombre ?? email);
            await Clients.Caller.SendAsync("EstadoMesaActualizado", estadoMesa);
            await Clients.Group($"ruleta_{mesaId}").SendAsync("EstadoMesaActualizado", estadoMesa);
        }

        public async Task AgregarApuestaMesa(string mesaId, ApuestaDto apuesta)
        {
            var email = ObtenerEmail();
            var nombre = ObtenerNombre();
            if (string.IsNullOrEmpty(email))
            {
                await Clients.Caller.SendAsync("Error", "No autorizado.");
                return;
            }
            _logger.LogInformation("Apuesta en mesa {MesaId}: {Nombre} apuesta {Monto}€ a {Tipo}:{Valor}", mesaId, nombre, apuesta.Monto, apuesta.Tipo, apuesta.Valor);
            await _service.AgregarApuestaMesa(mesaId, email, apuesta);
            await Clients.Group($"ruleta_{mesaId}").SendAsync("ApuestaAgregadaMesa", nombre ?? email, apuesta);
            await Clients.Group($"ruleta_{mesaId}").SendAsync("JugadorHaApostado", nombre ?? email);
        }

        public async Task GirarMesa(string mesaId)
        {
            var email = ObtenerEmail();
            if (string.IsNullOrEmpty(email))
            {
                await Clients.Caller.SendAsync("Error", "No autorizado.");
                return;
            }
            _logger.LogInformation("GirarMesa: {Email} en mesa {MesaId}", email, mesaId);
            try
            {
                var resultados = await _service.GirarMesa(mesaId, email);
                await Clients.Group($"ruleta_{mesaId}").SendAsync("ResultadoMesa", resultados);
                _service.LimpiarEstadoMesa(mesaId);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error al girar mesa");
                await Clients.Caller.SendAsync("Error", ex.Message);
            }
        }

        public async Task JugadorListo(string mesaId, bool listo)
        {
            var email = ObtenerEmail();
            var nombre = ObtenerNombre();
            if (string.IsNullOrEmpty(email)) return;
            _logger.LogInformation("JugadorListo: {Nombre} listo={Listo} en mesa {MesaId}", nombre, listo, mesaId);
            
            var estado = _service.MarcarJugadorListo(mesaId, email, listo);
            if (estado == null) return;
            
            await Clients.Group($"ruleta_{mesaId}").SendAsync("EstadoMesaActualizado", estado);
            
            if (estado.TodosListos && estado.Jugadores.Count > 0)
            {
                _logger.LogInformation("Todos listos en mesa {MesaId}, girando automáticamente", mesaId);
                var resultados = await _service.GirarMesa(mesaId, email);
                await Clients.Group($"ruleta_{mesaId}").SendAsync("ResultadoMesa", resultados);
                _service.LimpiarEstadoMesa(mesaId);
            }
        }

        public async Task JugadorAutoSkip(string mesaId, bool autoSkip)
        {
            var email = ObtenerEmail();
            var nombre = ObtenerNombre();
            if (string.IsNullOrEmpty(email)) return;
            _logger.LogInformation("JugadorAutoSkip: {Nombre} autoSkip={AutoSkip} en mesa {MesaId}", nombre, autoSkip, mesaId);
            var estado = _service.MarcarAutoSkip(mesaId, email, autoSkip);
            if (estado != null)
                await Clients.Group($"ruleta_{mesaId}").SendAsync("EstadoMesaActualizado", estado);
        }

        public async Task EnviarMensajeChat(string mesaId, string mensaje)
        {
            var nombre = ObtenerNombre();
            if (string.IsNullOrEmpty(nombre)) return;
            await Clients.Group($"ruleta_{mesaId}").SendAsync("NuevoMensajeChat", new
            {
                jugador = nombre,
                mensaje = mensaje,
                hora = DateTime.Now.ToString("HH:mm")
            });
        }

        public async Task ReiniciarRonda(string mesaId)
        {
            var email = ObtenerEmail();
            if (string.IsNullOrEmpty(email)) return;
            _logger.LogInformation("ReiniciarRonda: {Email} en mesa {MesaId}", email, mesaId);
            var estado = _service.ReiniciarRonda(mesaId, email);
            if (estado != null)
                await Clients.Group($"ruleta_{mesaId}").SendAsync("EstadoMesaActualizado", estado);
            else
                await Clients.Caller.SendAsync("Error", "Solo el creador puede reiniciar la ronda");
        }

        public async Task ObtenerEstadoMesa(string mesaId)
        {
            var estado = _service.ObtenerEstadoMesa(mesaId);
            if (estado != null)
                await Clients.Caller.SendAsync("EstadoMesaActualizado", estado);
            else
                await Clients.Caller.SendAsync("Error", "Mesa no encontrada");
        }

        public async Task SyncTimer(string mesaId, int timeLeft)
        {
            await Clients.Group($"ruleta_{mesaId}").SendAsync("TimerSynced", timeLeft);
        }
    }
}