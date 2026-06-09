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

        // --- MÉTODOS DE SOCIAL / AMIGOS ---
        public async Task GetOnlineUsers() => await Clients.Caller.SendAsync("OnlineUsers", OnlineUsers.Values.Distinct().ToList());

        public async Task GetRooms()
        {
            await Clients.Caller.SendAsync("UpdateRooms", Rooms.Values.ToList());
        }

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

        public async Task GetPendingRequests()
        {
            var email = Context.User?.GetEmail();
            if (email == null) return;
            var user = await _usuarioRepo.GetUsuarioPorEmailAsync(email);
            if (user == null) return;

            var relaciones = await _usuarioRepo.GetAmigosYPendientesAsync(user.IdUsuario);
            var pendientes = relaciones.Where(r => r.Estado == "Pendiente" && !r.EsSolicitante).Select(r => r.NombreUsuario).ToList();

            await Clients.Caller.SendAsync("PendingRequests", pendientes);
        }

        public async Task SendFriendRequest(string targetUsername)
        {
            var email = Context.User?.GetEmail();
            if (email == null) return;
            var sender = await _usuarioRepo.GetUsuarioPorEmailAsync(email);
            var target = await _usuarioRepo.GetUsuarioPorNombreAsync(targetUsername);

            if (sender == null || target == null || sender.IdUsuario == target.IdUsuario) return;

            if (await _usuarioRepo.EnviarSolicitudAmistadAsync(sender.IdUsuario, target.IdUsuario))
            {
                await GetFriendList();
                var targetConn = OnlineUsers.FirstOrDefault(x => x.Value == targetUsername).Key;
                if (targetConn != null)
                {
                    var relaciones = await _usuarioRepo.GetAmigosYPendientesAsync(target.IdUsuario);
                    var pendientes = relaciones.Where(r => r.Estado == "Pendiente" && !r.EsSolicitante).Select(r => r.NombreUsuario).ToList();
                    await Clients.Client(targetConn).SendAsync("PendingRequests", pendientes);
                    await Clients.Client(targetConn).SendAsync("ReceiveFriendRequest", sender.NombreUsuario);
                }
            }
        }

        public async Task AcceptFriendRequest(string senderUsername) => await ResponderSolicitud(senderUsername, "Aceptado");
        public async Task RejectFriendRequest(string senderUsername) => await ResponderSolicitud(senderUsername, "Rechazado");

        private async Task ResponderSolicitud(string senderUsername, string respuesta)
        {
            var email = Context.User?.GetEmail();
            if (email == null) return;
            var receiver = await _usuarioRepo.GetUsuarioPorEmailAsync(email);
            var sender = await _usuarioRepo.GetUsuarioPorNombreAsync(senderUsername);

            if (receiver == null || sender == null) return;

            if (await _usuarioRepo.ResponderSolicitudAmistadAsync(sender.IdUsuario, receiver.IdUsuario, respuesta))
            {
                await GetFriendList();
                var senderConn = OnlineUsers.FirstOrDefault(x => x.Value == senderUsername).Key;
                if (senderConn != null)
                {
                    var relaciones = await _usuarioRepo.GetAmigosYPendientesAsync(sender.IdUsuario);
                    var amigos = relaciones.Where(r => r.Estado == "Aceptado").Select(r => r.NombreUsuario).ToList();
                    await Clients.Client(senderConn).SendAsync("FriendList", amigos);
                }
            }
        }

        public async Task InviteFriend(string friendUsername, string roomId)
        {
            var targetConn = OnlineUsers.FirstOrDefault(x => x.Value == friendUsername).Key;
            if (targetConn != null && UserName != null)
                await Clients.Client(targetConn).SendAsync("ReceiveInvitation", UserName, roomId);
        }

        // --- MÉTODOS DE GESTIÓN DE SALAS ---

        public async Task<Room> CreateRoom(string nombre, string juego, bool esPrivada, string contrasena, int maxJugadores)
        {
            var roomId = Guid.NewGuid().ToString()[..8];
            var creatorName = UserName ?? "Desconocido";
            var room = new Room
            {
                id = roomId,
                nombre = nombre,
                juego = juego,
                esPrivada = esPrivada,
                contrasena = contrasena,
                creador = creatorName,
                creadorId = Context.User?.GetEmail() ?? "",
                maxJugadores = maxJugadores
            };

            room.jugadores.Add(creatorName);
            Rooms.TryAdd(roomId, room);
            UserRooms.AddOrUpdate(Context.ConnectionId, roomId, (k, v) => roomId);
            await Groups.AddToGroupAsync(Context.ConnectionId, roomId);
            await Clients.All.SendAsync("UpdateRooms", Rooms.Values.ToList());
            
            return room;
        }

        public async Task<Room> JoinRoom(string roomId, string contrasena)
        {
            if (Rooms.TryGetValue(roomId, out var room))
            {
                var playerName = UserName ?? "Desconocido";

                if (room.baneados.Contains(playerName)) throw new HubException("Estás baneado de esta mesa.");
                if (room.esPrivada && room.contrasena != contrasena) throw new HubException("Contraseña incorrecta.");
                if (room.jugadores.Count >= room.maxJugadores) throw new HubException("La mesa está llena.");

                if (!room.jugadores.Contains(playerName))
                {
                    room.jugadores.Add(playerName);
                }
                
                UserRooms.AddOrUpdate(Context.ConnectionId, roomId, (k, v) => roomId);
                await Groups.AddToGroupAsync(Context.ConnectionId, roomId);
                await Clients.Group(roomId).SendAsync("PlayerJoined", playerName);
                await Clients.All.SendAsync("UpdateRooms", Rooms.Values.ToList());
                await Clients.Caller.SendAsync("JoinSuccess", roomId);
                
                return room;
            }
            throw new HubException("La mesa no existe.");
        }

        public async Task LeaveRoom(string roomId)
        {
            if (Rooms.TryGetValue(roomId, out var room))
            {
                var playerName = UserName ?? "";
                
                room.jugadores.RemoveAll(j => string.Equals(j, playerName, StringComparison.OrdinalIgnoreCase));
                
                UserRooms.TryRemove(Context.ConnectionId, out _);
                await Groups.RemoveFromGroupAsync(Context.ConnectionId, roomId);

                await Clients.Group(roomId).SendAsync("PlayerLeft", playerName);

                if (room.jugadores.Count == 0)
                {
                    Rooms.TryRemove(roomId, out _);
                }

                await Clients.All.SendAsync("UpdateRooms", Rooms.Values.ToList());
            }
        }

        public async Task SendMessage(string roomId, string mensaje)
        {
            if (Rooms.ContainsKey(roomId))
            {
                await Clients.Group(roomId).SendAsync("ReceiveMessage", UserName, mensaje);
            }
        }

        public async Task ToggleRoomPrivacy(string roomId, string password)
        {
            if (Rooms.TryGetValue(roomId, out var room) && room.creador == UserName)
            {
                room.esPrivada = !room.esPrivada;
                room.contrasena = room.esPrivada ? password : "";
                
                await Clients.Group(roomId).SendAsync("RoomPrivacyToggled", room.esPrivada);
                await Clients.All.SendAsync("UpdateRooms", Rooms.Values.ToList());
            }
            else 
            {
                throw new HubException("No tienes permiso o la mesa no existe.");
            }
        }

        public async Task StartGame(string roomId)
        {
            if (Rooms.TryGetValue(roomId, out var room) && room.creador == UserName)
            {
                await Clients.Group(roomId).SendAsync("GameStarted", room.juego, roomId);
            }
        }

        public async Task KickPlayer(string roomId, string playerName, bool ban)
        {
            if (Rooms.TryGetValue(roomId, out var room) && room.creador == UserName)
            {
                if (room.jugadores.Contains(playerName))
                {
                    room.jugadores.Remove(playerName);
                    if (ban) room.baneados.Add(playerName);

                    var targetConn = OnlineUsers.FirstOrDefault(x => x.Value == playerName).Key;
                    if (targetConn != null)
                    {
                        UserRooms.TryRemove(targetConn, out _);
                        await Groups.RemoveFromGroupAsync(targetConn, roomId);
                        await Clients.Client(targetConn).SendAsync("PlayerKicked", playerName, ban);
                    }

                    await Clients.Group(roomId).SendAsync("PlayerKicked", playerName, ban);
                    await Clients.All.SendAsync("UpdateRooms", Rooms.Values.ToList());
                }
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