using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.SignalR;
using System.Collections.Concurrent;
using System.Security.Claims;

namespace TrickedDice.Api.Hubs
{
    [Authorize]
    public class LobbyHub : Hub
    {
        private static readonly ConcurrentDictionary<string, string> OnlineUsers = new();
        private static readonly ConcurrentDictionary<string, List<string>> Friends = new();
        private static readonly ConcurrentDictionary<string, List<string>> FriendRequests = new();
        private static readonly ConcurrentDictionary<string, RoomInfo> Rooms = new();

        private string GetUsername()
        {
            var claims = Context.User?.Claims;
            if (claims != null)
            {
                var usernameClaim = claims.FirstOrDefault(c => 
                    c.Type == "nombreUsuario" || c.Type == "username" || c.Type == ClaimTypes.Name || c.Type.Contains("name"));
                
                if (usernameClaim != null && !string.IsNullOrEmpty(usernameClaim.Value))
                    return usernameClaim.Value;
            }
            return Context.UserIdentifier ?? $"Guest_{Context.ConnectionId.Substring(0, 6)}";
        }

        public override async Task OnConnectedAsync()
        {
            var username = GetUsername();
            OnlineUsers[username] = Context.ConnectionId;
            await UpdateOnlineUsers();
            await Clients.Caller.SendAsync("RoomsList", Rooms.Values.ToList());
            await base.OnConnectedAsync();
        }

        public override async Task OnDisconnectedAsync(Exception? exception)
        {
            var username = GetUsername();
            OnlineUsers.TryRemove(username, out _);
            await UpdateOnlineUsers();
            
            foreach (var room in Rooms.Values.Where(r => r.Players.Contains(username)).ToList())
            {
                room.Players.Remove(username);
                if (room.Players.Count == 0)
                {
                    Rooms.TryRemove(room.Id, out _);
                }
                else
                {
                    if (room.Creator == username)
                    {
                        room.Creator = room.Players.First();
                    }
                    await Clients.Group($"room_{room.Id}").SendAsync("RoomUpdated", room);
                }
            }
            await Clients.All.SendAsync("RoomsList", Rooms.Values.ToList());
            await base.OnDisconnectedAsync(exception);
        }

        public async Task GetOnlineUsers() => await Clients.Caller.SendAsync("OnlineUsers", OnlineUsers.Keys.ToList());
        
        public async Task GetRooms() => await Clients.Caller.SendAsync("RoomsList", Rooms.Values.ToList());

        public async Task SendFriendRequest(string targetUsername)
        {
            var sender = GetUsername();
            if (sender == targetUsername) return;
            if (OnlineUsers.TryGetValue(targetUsername, out var connectionId))
            {
                FriendRequests.AddOrUpdate(targetUsername, new List<string> { sender }, (_, list) => { if (!list.Contains(sender)) list.Add(sender); return list; });
                await Clients.Client(connectionId).SendAsync("FriendRequestReceived", sender);
            }
        }

        public async Task AcceptFriendRequest(string senderUsername)
        {
            var receiver = GetUsername();
            FriendRequests.AddOrUpdate(receiver, new List<string>(), (_, list) => { list.Remove(senderUsername); return list; });
            Friends.AddOrUpdate(receiver, new List<string> { senderUsername }, (_, list) => { if (!list.Contains(senderUsername)) list.Add(senderUsername); return list; });
            Friends.AddOrUpdate(senderUsername, new List<string> { receiver }, (_, list) => { if (!list.Contains(receiver)) list.Add(receiver); return list; });
                
            if (OnlineUsers.TryGetValue(senderUsername, out var connId))
                await Clients.Client(connId).SendAsync("FriendAdded", receiver);
            await Clients.Caller.SendAsync("FriendAdded", senderUsername);
        }

        public async Task RejectFriendRequest(string senderUsername)
        {
            var receiver = GetUsername();
            FriendRequests.AddOrUpdate(receiver, new List<string>(), (_, list) => { list.Remove(senderUsername); return list; });
        }

        public async Task GetFriendList()
        {
            var username = GetUsername();
            if (Friends.TryGetValue(username, out var list))
                await Clients.Caller.SendAsync("FriendList", list);
        }

        public async Task GetPendingRequests()
        {
            var username = GetUsername();
            if (FriendRequests.TryGetValue(username, out var list))
                await Clients.Caller.SendAsync("PendingRequests", list);
        }

        public async Task CreateRoom(string roomName, string gameType, bool isPrivate, string password)
        {
            var creator = GetUsername();
            
            if (Rooms.Values.Any(r => r.Name.Equals(roomName, StringComparison.OrdinalIgnoreCase)))
            {
                await Clients.Caller.SendAsync("Error", "Ya existe una sala con ese nombre");
                return;
            }
            
            var room = new RoomInfo
            {
                Id = Guid.NewGuid().ToString(),
                Name = roomName,
                GameType = gameType,
                Creator = creator,
                Players = new List<string> { creator },
                MaxPlayers = gameType == "Ruleta" ? 10 : 6,
                IsPrivate = isPrivate,
                Password = isPrivate ? password : null,
                Status = "waiting"
            };
            
            Rooms.TryAdd(room.Id, room);
            await Groups.AddToGroupAsync(Context.ConnectionId, $"room_{room.Id}");
            await Clients.All.SendAsync("RoomsList", Rooms.Values.ToList());
            await Clients.Caller.SendAsync("RoomCreated", room);
        }

        public async Task JoinRoom(string roomId, string password)
        {
            var username = GetUsername();
            
            if (!Rooms.TryGetValue(roomId, out var room))
            {
                await Clients.Caller.SendAsync("Error", "La sala no existe o ha sido cerrada.");
                return;
            }
            
            if (room.IsPrivate && !room.Players.Contains(username) && room.Password != password)
            {
                await Clients.Caller.SendAsync("Error", "Contraseña incorrecta.");
                return;
            }
            
            if (room.Players.Count >= room.MaxPlayers && !room.Players.Contains(username))
            {
                await Clients.Caller.SendAsync("Error", "La sala está llena.");
                return;
            }
            
            if (!room.Players.Contains(username))
            {
                room.Players.Add(username);
            }
            
            await Groups.AddToGroupAsync(Context.ConnectionId, $"room_{room.Id}");
            await Clients.Group($"room_{room.Id}").SendAsync("RoomUpdated", room);
            await Clients.All.SendAsync("RoomsList", Rooms.Values.ToList());
            await Clients.Caller.SendAsync("RoomJoined", room);
        }

        public async Task LeaveRoom(string roomId)
        {
            var username = GetUsername();
            if (!Rooms.TryGetValue(roomId, out var room)) return;

            room.Players.Remove(username);
            await Groups.RemoveFromGroupAsync(Context.ConnectionId, $"room_{room.Id}");

            if (room.Players.Count == 0)
            {
                Rooms.TryRemove(roomId, out _);
            }
            else
            {
                if (room.Creator == username)
                {
                    room.Creator = room.Players.First();
                }
                await Clients.Group($"room_{room.Id}").SendAsync("RoomUpdated", room);
            }
            await Clients.All.SendAsync("RoomsList", Rooms.Values.ToList());
        }

        public async Task ToggleRoomPrivacy(string roomId, string newPassword)
        {
            var username = GetUsername();
            if (!Rooms.TryGetValue(roomId, out var room)) return;
            if (room.Creator != username) return;

            room.IsPrivate = !room.IsPrivate;
            room.Password = room.IsPrivate ? newPassword : null;
            await Clients.Group($"room_{room.Id}").SendAsync("RoomUpdated", room);
            await Clients.All.SendAsync("RoomsList", Rooms.Values.ToList());
        }

        public async Task StartGame(string roomId)
        {
            var username = GetUsername();
            if (!Rooms.TryGetValue(roomId, out var room)) return;
            if (room.Creator != username) return;

            room.Status = "playing";
            await Clients.Group($"room_{room.Id}").SendAsync("GameStarted", room.GameType, room.Id);
            Rooms.TryRemove(roomId, out _);
            await Clients.All.SendAsync("RoomsList", Rooms.Values.ToList());
        }

        public async Task InviteToTable(string friendUsername, string roomId, string gameType)
        {
            var inviter = GetUsername();
            var room = Rooms.Values.FirstOrDefault(r => r.Id == roomId);
            if (room == null) return;
            
            if (OnlineUsers.TryGetValue(friendUsername, out var connectionId))
            {
                await Clients.Client(connectionId).SendAsync("TableInvitation", inviter, roomId, gameType, room.Name);
            }
        }

        public async Task SendRoomMessage(string roomId, string message)
        {
            var username = GetUsername();
            await Clients.Group($"room_{roomId}").SendAsync("ReceiveRoomMessage", username, message);
        }

        private async Task UpdateOnlineUsers()
        {
            await Clients.All.SendAsync("OnlineUsers", OnlineUsers.Keys.ToList());
        }
    }

    public class RoomInfo
    {
        public string Id { get; set; } = string.Empty;
        public string Name { get; set; } = string.Empty;
        public string GameType { get; set; } = string.Empty;
        public string Creator { get; set; } = string.Empty;
        public List<string> Players { get; set; } = new();
        public int MaxPlayers { get; set; }
        public bool IsPrivate { get; set; }
        public string? Password { get; set; }
        public string Status { get; set; } = "waiting";
    }
}