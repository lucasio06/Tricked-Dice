using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.SignalR;
using System.Collections.Concurrent;
using System.Security.Claims;

namespace TrickedDice.Api.Hubs
{
    [Authorize]
    public class LobbyHub : Hub
    {
        private static readonly ConcurrentDictionary<string, Room> Rooms = new();
        private static readonly ConcurrentDictionary<string, string> UserRooms = new();
        private static readonly ConcurrentDictionary<string, string> OnlineUsers = new();
        private static readonly ConcurrentDictionary<string, HashSet<string>> UserFriends = new(StringComparer.OrdinalIgnoreCase);
        private static readonly ConcurrentDictionary<string, HashSet<string>> PendingRequests = new(StringComparer.OrdinalIgnoreCase);

        private readonly ILogger<LobbyHub> _logger;

        public LobbyHub(ILogger<LobbyHub> logger)
        {
            _logger = logger;
        }

        private string? UserName
        {
            get
            {
                if (Context.User == null) return null;
                var name = Context.User.FindFirst(ClaimTypes.Name)?.Value;
                if (!string.IsNullOrEmpty(name)) return name;
                name = Context.User.FindFirst("unique_name")?.Value;
                if (!string.IsNullOrEmpty(name)) return name;
                name = Context.User.FindFirst(ClaimTypes.Email)?.Value;
                if (!string.IsNullOrEmpty(name)) return name;
                name = Context.User.FindFirst("email")?.Value;
                return name ?? Context.ConnectionId;
            }
        }

        public async Task GetOnlineUsers()
        {
            var users = OnlineUsers.Values.Distinct().ToList();
            await Clients.Caller.SendAsync("OnlineUsers", users);
        }

        public async Task GetFriendList()
        {
            var myName = UserName;
            if (myName == null) return;
            UserFriends.TryGetValue(myName, out var friends);
            await Clients.Caller.SendAsync("FriendList", friends?.ToList() ?? new List<string>());
        }

        public async Task GetPendingRequests()
        {
            var myName = UserName;
            if (myName == null) return;
            PendingRequests.TryGetValue(myName, out var requests);
            await Clients.Caller.SendAsync("PendingRequests", requests?.ToList() ?? new List<string>());
        }

        public async Task SendFriendRequest(string userName)
        {
            var myName = UserName;
            if (myName == null || string.IsNullOrEmpty(userName)) return;
            if (myName.Equals(userName, StringComparison.OrdinalIgnoreCase)) return;

            PendingRequests.AddOrUpdate(userName, new HashSet<string> { myName }, (k, v) => { v.Add(myName); return v; });

            var targetConnections = OnlineUsers.Where(x => string.Equals(x.Value, userName, StringComparison.OrdinalIgnoreCase)).Select(x => x.Key).ToList();
            foreach (var conn in targetConnections)
            {
                await Clients.Client(conn).SendAsync("FriendRequestReceived", myName);
            }
        }

        public async Task AcceptFriendRequest(string userName)
        {
            var myName = UserName;
            if (myName == null) return;

            PendingRequests.AddOrUpdate(myName, new HashSet<string>(), (k, v) => { v.Remove(userName); return v; });
            UserFriends.AddOrUpdate(myName, new HashSet<string> { userName }, (k, v) => { v.Add(userName); return v; });
            UserFriends.AddOrUpdate(userName, new HashSet<string> { myName }, (k, v) => { v.Add(myName); return v; });

            var targetConnections = OnlineUsers.Where(x => string.Equals(x.Value, userName, StringComparison.OrdinalIgnoreCase)).Select(x => x.Key).ToList();
            foreach (var conn in targetConnections)
            {
                await Clients.Client(conn).SendAsync("FriendAdded", myName);
            }

            await Clients.Caller.SendAsync("FriendAdded", userName);
            await GetFriendList();
            await GetPendingRequests();
        }

        public async Task RejectFriendRequest(string userName)
        {
            var myName = UserName;
            if (myName == null) return;
            PendingRequests.AddOrUpdate(myName, new HashSet<string>(), (k, v) => { v.Remove(userName); return v; });
            await GetPendingRequests();
        }

        public async Task InviteFriend(string friendName, string roomId)
        {
            if (!Rooms.TryGetValue(roomId, out var room)) return;
            var targetConnections = OnlineUsers.Where(x => string.Equals(x.Value, friendName, StringComparison.OrdinalIgnoreCase)).Select(x => x.Key).ToList();
            foreach (var conn in targetConnections)
            {
                await Clients.Client(conn).SendAsync("FriendInvitation", UserName, room);
            }
        }

        public async Task CreateRoom(string nombreMesa, string juegoSeleccionado, bool esPrivada, string password)
        {
            var room = new Room
            {
                Id = Guid.NewGuid().ToString(),
                nombre = nombreMesa,
                juego = juegoSeleccionado,
                esPrivada = esPrivada,
                contrasena = password,
                creador = UserName ?? "Anónimo",
                creadorId = Context.ConnectionId,
                jugadores = new List<string> { UserName ?? "Anónimo" },
                maxJugadores = 8
            };

            Rooms[room.Id] = room;
            UserRooms[Context.ConnectionId] = room.Id;
            await Groups.AddToGroupAsync(Context.ConnectionId, $"room_{room.Id}");
            
            await Clients.Caller.SendAsync("RoomCreated", room);
            await BroadcastRooms();
        }

        public async Task JoinRoom(string roomId, string password)
        {
            if (!Rooms.TryGetValue(roomId, out var room))
            {
                await Clients.Caller.SendAsync("Error", "La sala no existe.");
                return;
            }

            if (room.esPrivada && room.contrasena != password)
            {
                await Clients.Caller.SendAsync("Error", "Contraseña incorrecta.");
                return;
            }

            if (room.jugadores.Count >= room.maxJugadores)
            {
                await Clients.Caller.SendAsync("Error", "La sala está llena.");
                return;
            }

            var userName = UserName ?? "Anónimo";
            if (!room.jugadores.Contains(userName))
            {
                room.jugadores.Add(userName);
            }
            
            UserRooms[Context.ConnectionId] = roomId;
            await Groups.AddToGroupAsync(Context.ConnectionId, $"room_{roomId}");
            await Clients.Caller.SendAsync("RoomJoined", room);
            await Clients.Group($"room_{roomId}").SendAsync("PlayerJoined", userName);
            await BroadcastRooms();
        }

        public async Task LeaveRoom(string roomId)
        {
            if (!Rooms.TryGetValue(roomId, out var room)) return;

            var userName = UserName ?? "Anónimo";
            if (room.jugadores.Contains(userName))
            {
                room.jugadores.Remove(userName);
                await Clients.Group($"room_{roomId}").SendAsync("PlayerLeft", userName);
            }

            UserRooms.TryRemove(Context.ConnectionId, out _);
            await Groups.RemoveFromGroupAsync(Context.ConnectionId, $"room_{roomId}");

            if (room.jugadores.Count == 0)
            {
                Rooms.TryRemove(roomId, out _);
            }
            else if (room.creador == userName && room.jugadores.Any())
            {
                room.creador = room.jugadores.First();
                await Clients.Group($"room_{roomId}").SendAsync("RoomUpdated", room);
            }

            await BroadcastRooms();
        }

        public async Task ToggleRoomPrivacy(string roomId)
        {
            if (!Rooms.TryGetValue(roomId, out var room)) return;
            if (room.creadorId != Context.ConnectionId) return;

            room.esPrivada = !room.esPrivada;
            await Clients.Group($"room_{roomId}").SendAsync("RoomPrivacyToggled", room.esPrivada);
            await BroadcastRooms();
        }

        public async Task StartGame(string roomId)
        {
            if (!Rooms.TryGetValue(roomId, out var room)) return;
            if (room.creadorId != Context.ConnectionId) return;

            await Clients.Group($"room_{roomId}").SendAsync("GameStarted", room.juego, roomId);
        }

        public async Task SendMessage(string roomId, string message)
        {
            var userName = UserName ?? "Anónimo";
            await Clients.Group($"room_{roomId}").SendAsync("ReceiveMessage", userName, message);
        }

        private async Task BroadcastRooms()
        {
            var roomsList = Rooms.Values.Select(r => new
            {
                r.Id,
                r.nombre,
                r.juego,
                r.esPrivada,
                r.creador,
                r.maxJugadores,
                jugadores = r.jugadores
            });
            await Clients.All.SendAsync("RoomsList", roomsList);
        }

        public override async Task OnConnectedAsync()
        {
            var userName = UserName ?? Context.ConnectionId;
            OnlineUsers[Context.ConnectionId] = userName;

            var usersList = OnlineUsers.Values.Distinct().ToList();
            await Clients.All.SendAsync("OnlineUsers", usersList);
            await base.OnConnectedAsync();
        }

        public override async Task OnDisconnectedAsync(Exception? exception)
        {
            OnlineUsers.TryRemove(Context.ConnectionId, out _);
            var usersList = OnlineUsers.Values.Distinct().ToList();
            await Clients.All.SendAsync("OnlineUsers", usersList);

            if (UserRooms.TryGetValue(Context.ConnectionId, out var roomId))
            {
                await LeaveRoom(roomId);
            }

            await base.OnDisconnectedAsync(exception);
        }
    }

    public class Room
    {
        public string Id { get; set; } = "";
        public string nombre { get; set; } = "";
        public string juego { get; set; } = "";
        public bool esPrivada { get; set; }
        public string contrasena { get; set; } = "";
        public string creador { get; set; } = "";
        public string creadorId { get; set; } = "";
        public List<string> jugadores { get; set; } = new();
        public int maxJugadores { get; set; }
    }
}