using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.SignalR;
using System.Collections.Concurrent;
using System.Text.Json.Serialization;
using TrickedDice.Api.Extensions;
using TrickedDice.Api.Repositories.Interfaces;

namespace TrickedDice.Api.Hubs
{
    [Authorize]
    public class LobbyHub : Hub
    {
        private static readonly ConcurrentDictionary<string, Room> Rooms = new();
        private static readonly ConcurrentDictionary<string, string> UserRooms = new();
        private static readonly ConcurrentDictionary<string, string> OnlineUsers = new();

        private readonly ILogger<LobbyHub> _logger;
        private readonly IUsuarioRepository _usuarioRepo;

        public LobbyHub(ILogger<LobbyHub> logger, IUsuarioRepository usuarioRepo)
        {
            _logger = logger;
            _usuarioRepo = usuarioRepo;
        }

        private string? UserName 
        {
            get 
            {
                if (OnlineUsers.TryGetValue(Context.ConnectionId, out var username)) return username;
                return Context.User?.GetUserName() ?? Context.ConnectionId;
            }
        }

        public async Task GetOnlineUsers() => await Clients.Caller.SendAsync("OnlineUsers", OnlineUsers.Values.Distinct().ToList());

        public async Task GetFriendList()
        {
            var email = Context.User?.GetEmail();
            if (email == null) return;
            
            var user = await _usuarioRepo.GetUsuarioPorEmailAsync(email);
            if (user == null) return;

            var relaciones = await _usuarioRepo.GetAmigosYPendientesAsync(user.IdUsuario);

            var amigos = relaciones.Where(r => r.Estado == "Aceptado").Select(r => r.NombreUsuario).ToList();
            var pendientes = relaciones.Where(r => r.Estado == "Pendiente" && !r.EsSolicitante).Select(r => r.NombreUsuario).ToList();

            await Clients.Caller.SendAsync("FriendList", amigos);
            await Clients.Caller.SendAsync("PendingRequests", pendientes);
        }

        public async Task SendFriendRequest(string targetUsername)
        {
            var email = Context.User?.GetEmail();
            if (email == null) return;
            
            var sender = await _usuarioRepo.GetUsuarioPorEmailAsync(email);
            var target = await _usuarioRepo.GetUsuarioPorNombreAsync(targetUsername);

            if (sender == null || target == null || sender.IdUsuario == target.IdUsuario) return;

            var exito = await _usuarioRepo.EnviarSolicitudAmistadAsync(sender.IdUsuario, target.IdUsuario);
            
            if (exito)
            {
                await GetFriendList();
                
                var targetConnectionId = OnlineUsers.FirstOrDefault(x => x.Value == targetUsername).Key;
                if (targetConnectionId != null)
                {
                    var relaciones = await _usuarioRepo.GetAmigosYPendientesAsync(target.IdUsuario);
                    var pendientes = relaciones.Where(r => r.Estado == "Pendiente" && !r.EsSolicitante).Select(r => r.NombreUsuario).ToList();
                    await Clients.Client(targetConnectionId).SendAsync("PendingRequests", pendientes);
                    await Clients.Client(targetConnectionId).SendAsync("ReceiveFriendRequest", sender.NombreUsuario);
                }
            }
        }

        public async Task AcceptFriendRequest(string senderUsername)
        {
            await ResponderSolicitud(senderUsername, "Aceptado");
        }

        public async Task RejectFriendRequest(string senderUsername)
        {
            await ResponderSolicitud(senderUsername, "Rechazado");
        }

        private async Task ResponderSolicitud(string senderUsername, string respuesta)
        {
            var email = Context.User?.GetEmail();
            if (email == null) return;
            
            var receiver = await _usuarioRepo.GetUsuarioPorEmailAsync(email);
            var sender = await _usuarioRepo.GetUsuarioPorNombreAsync(senderUsername);

            if (receiver == null || sender == null) return;

            var exito = await _usuarioRepo.ResponderSolicitudAmistadAsync(sender.IdUsuario, receiver.IdUsuario, respuesta);

            if (exito)
            {
                await GetFriendList();
                
                var senderConnectionId = OnlineUsers.FirstOrDefault(x => x.Value == senderUsername).Key;
                if (senderConnectionId != null)
                {
                    var relaciones = await _usuarioRepo.GetAmigosYPendientesAsync(sender.IdUsuario);
                    var amigos = relaciones.Where(r => r.Estado == "Aceptado").Select(r => r.NombreUsuario).ToList();
                    await Clients.Client(senderConnectionId).SendAsync("FriendList", amigos);
                }
            }
        }

        public async Task InviteFriend(string friendUsername, string roomId)
        {
            var targetConnectionId = OnlineUsers.FirstOrDefault(x => x.Value == friendUsername).Key;
            if (targetConnectionId != null && UserName != null)
            {
                await Clients.Client(targetConnectionId).SendAsync("ReceiveInvitation", UserName, roomId);
            }
        }

        public async Task CreateRoom(string nombre, string juego, bool esPrivada, string contrasena, int maxJugadores)
        {
            var roomId = Guid.NewGuid().ToString()[..8];
            var room = new Room
            {
                id = roomId,
                nombre = nombre,
                juego = juego,
                esPrivada = esPrivada,
                contrasena = contrasena,
                creador = UserName ?? "Desconocido",
                creadorId = Context.User?.GetEmail() ?? "",
                maxJugadores = maxJugadores
            };

            Rooms.TryAdd(roomId, room);
            await Clients.All.SendAsync("UpdateRooms", Rooms.Values.ToList());
        }

        public async Task JoinRoom(string roomId, string contrasena)
        {
            if (Rooms.TryGetValue(roomId, out var room))
            {
                if (room.baneados.Contains(UserName ?? "")) return;
                if (room.esPrivada && room.contrasena != contrasena) return;
                if (room.jugadores.Count >= room.maxJugadores) return;

                room.jugadores.Add(UserName ?? "Desconocido");
                UserRooms.AddOrUpdate(Context.ConnectionId, roomId, (k, v) => roomId);

                await Clients.All.SendAsync("UpdateRooms", Rooms.Values.ToList());
                await Clients.Caller.SendAsync("JoinSuccess", roomId);
            }
        }

        public async Task LeaveRoom(string roomId)
        {
            if (Rooms.TryGetValue(roomId, out var room))
            {
                room.jugadores.Remove(UserName ?? "");
                UserRooms.TryRemove(Context.ConnectionId, out _);

                if (room.jugadores.Count == 0)
                {
                    Rooms.TryRemove(roomId, out _);
                }

                await Clients.All.SendAsync("UpdateRooms", Rooms.Values.ToList());
            }
        }

        public override async Task OnConnectedAsync()
        {
            var email = Context.User?.GetEmail();
            if (email != null)
            {
                var user = await _usuarioRepo.GetUsuarioPorEmailAsync(email);
                if (user != null)
                {
                    OnlineUsers.AddOrUpdate(Context.ConnectionId, user.NombreUsuario, (k, v) => user.NombreUsuario);
                    var usersList = OnlineUsers.Values.Distinct().ToList();
                    await Clients.All.SendAsync("OnlineUsers", usersList);
                }
            }

            await Clients.Caller.SendAsync("UpdateRooms", Rooms.Values.ToList());
            await GetFriendList();

            await base.OnConnectedAsync();
        }

        public override async Task OnDisconnectedAsync(Exception? exception)
        {
            OnlineUsers.TryRemove(Context.ConnectionId, out _);
            var usersList = OnlineUsers.Values.Distinct().ToList();
            await Clients.All.SendAsync("OnlineUsers", usersList);

            if (UserRooms.TryGetValue(Context.ConnectionId, out var roomId))
                await LeaveRoom(roomId);

            await base.OnDisconnectedAsync(exception);
        }
    }

    public class Room
    {
        [JsonPropertyName("id")] public string id { get; set; } = "";
        [JsonIgnore] public string Id => id;

        [JsonPropertyName("nombre")] public string nombre { get; set; } = "";
        [JsonPropertyName("juego")] public string juego { get; set; } = "";
        [JsonPropertyName("esPrivada")] public bool esPrivada { get; set; }
        [JsonPropertyName("contrasena")] public string contrasena { get; set; } = "";
        [JsonPropertyName("creador")] public string creador { get; set; } = "";
        [JsonPropertyName("creadorId")] public string creadorId { get; set; } = "";
        [JsonPropertyName("jugadores")] public List<string> jugadores { get; set; } = new();
        [JsonPropertyName("baneados")] public HashSet<string> baneados { get; set; } = new();
        [JsonPropertyName("maxJugadores")] public int maxJugadores { get; set; } = 8;
    }
}