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

        public override async Task OnConnectedAsync()
        {
            var username = Context.User?.FindFirst(ClaimTypes.Name)?.Value ?? Context.UserIdentifier;
            if (!string.IsNullOrEmpty(username))
            {
                OnlineUsers[username] = Context.ConnectionId;
                await UpdateOnlineUsers();
                await Clients.Caller.SendAsync("RoomsList", Rooms.Values.ToList());
            }
            await base.OnConnectedAsync();
        }

        public override async Task OnDisconnectedAsync(Exception? exception)
        {
            var username = Context.User?.FindFirst(ClaimTypes.Name)?.Value ?? Context.UserIdentifier;
            if (!string.IsNullOrEmpty(username))
            {
                OnlineUsers.TryRemove(username, out _);
                await UpdateOnlineUsers();
                foreach (var room in Rooms.Values.Where(r => r.Players.Contains(username)))
                {
                    room.Players.Remove(username);
                    await Clients.Group($"room_{room.Id}").SendAsync("RoomUpdated", room);
                    if (room.Players.Count == 0)
                    {
                        Rooms.TryRemove(room.Id, out _);
                        await Clients.All.SendAsync("RoomsList", Rooms.Values.ToList());
                    }
                    else
                    {
                        await Clients.All.SendAsync("RoomsList", Rooms.Values.ToList());
                    }
                }
            }
            await base.OnDisconnectedAsync(exception);
        }

        public async Task GetOnlineUsers()
        {
            await Clients.Caller.SendAsync("OnlineUsers", OnlineUsers.Keys.ToList());
        }

        public async Task SendFriendRequest(string targetUsername)
        {
            var sender = Context.User?.FindFirst(ClaimTypes.Name)?.Value;
            if (string.IsNullOrEmpty(sender) || sender == targetUsername) return;
            if (OnlineUsers.TryGetValue(targetUsername, out var connectionId))
            {
                FriendRequests.AddOrUpdate(targetUsername,
                    new List<string> { sender },
                    (_, list) => { if (!list.Contains(sender)) list.Add(sender); return list; });
                await Clients.Client(connectionId).SendAsync("FriendRequestReceived", sender);
            }
        }

        public async Task AcceptFriendRequest(string senderUsername)
        {
            var receiver = Context.User?.FindFirst(ClaimTypes.Name)?.Value;
            if (string.IsNullOrEmpty(receiver) || string.IsNullOrEmpty(senderUsername)) return;
            FriendRequests.AddOrUpdate(receiver, new List<string>(), (_, list) =>
            {
                list.Remove(senderUsername);
                return list;
            });
            Friends.AddOrUpdate(receiver,
                new List<string> { senderUsername },
                (_, list) => { if (!list.Contains(senderUsername)) list.Add(senderUsername); return list; });
            Friends.AddOrUpdate(senderUsername,
                new List<string> { receiver },
                (_, list) => { if (!list.Contains(receiver)) list.Add(receiver); return list; });
            if (OnlineUsers.TryGetValue(senderUsername, out var connId))
                await Clients.Client(connId).SendAsync("FriendAdded", receiver);
            await Clients.Caller.SendAsync("FriendAdded", senderUsername);
        }

        public async Task RejectFriendRequest(string senderUsername)
        {
            var receiver = Context.User?.FindFirst(ClaimTypes.Name)?.Value;
            if (!string.IsNullOrEmpty(receiver))
                FriendRequests.AddOrUpdate(receiver, new List<string>(), (_, list) => { list.Remove(senderUsername); return list; });
        }

        public async Task GetFriendList()
        {
            var username = Context.User?.FindFirst(ClaimTypes.Name)?.Value;
            if (!string.IsNullOrEmpty(username) && Friends.TryGetValue(username, out var list))
                await Clients.Caller.SendAsync("FriendList", list);
        }

        public async Task GetPendingRequests()
        {
            var username = Context.User?.FindFirst(ClaimTypes.Name)?.Value;
            if (!string.IsNullOrEmpty(username) && FriendRequests.TryGetValue(username, out var list))
                await Clients.Caller.SendAsync("PendingRequests", list);
        }

        public async Task CreateRoom(string roomName, string gameType, bool isPrivate, string? password)
        {
            var creator = Context.User?.FindFirst(ClaimTypes.Name)?.Value;
            if (string.IsNullOrEmpty(creator)) return;
            var room = new RoomInfo
            {
                Id = Guid.NewGuid().ToString(),
                Name = roomName,
                GameType = gameType,
                Creator = creator,
                Players = new List<string> { creator },
                MaxPlayers = gameType == "Ruleta" ? 10 : 6,
                IsPrivate = isPrivate,
                Password = isPrivate ? (password ?? Guid.NewGuid().ToString().Substring(0, 6)) : null,
                Status = "waiting"
            };
            Rooms.TryAdd(room.Id, room);
            await Groups.AddToGroupAsync(Context.ConnectionId, $"room_{room.Id}");
            await Clients.All.SendAsync("RoomsList", Rooms.Values.ToList());
            await Clients.Caller.SendAsync("RoomCreated", room);
        }

        public async Task JoinRoom(string roomId, string? password = null)
        {
            var username = Context.User?.FindFirst(ClaimTypes.Name)?.Value;
            if (string.IsNullOrEmpty(username)) return;
            if (!Rooms.TryGetValue(roomId, out var room))
            {
                await Clients.Caller.SendAsync("Error", "Room not found");
                return;
            }
            if (room.IsPrivate && room.Password != password)
            {
                await Clients.Caller.SendAsync("Error", "Invalid password");
                return;
            }
            if (room.Players.Count >= room.MaxPlayers)
            {
                await Clients.Caller.SendAsync("Error", "Room is full");
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
            var username = Context.User?.FindFirst(ClaimTypes.Name)?.Value;
            if (string.IsNullOrEmpty(username)) return;
            if (!Rooms.TryGetValue(roomId, out var room)) return;
            room.Players.Remove(username);
            await Groups.RemoveFromGroupAsync(Context.ConnectionId, $"room_{room.Id}");
            if (room.Players.Count == 0)
            {
                Rooms.TryRemove(roomId, out _);
                await Clients.All.SendAsync("RoomsList", Rooms.Values.ToList());
            }
            else
            {
                if (room.Creator == username && room.Players.Any())
                {
                    room.Creator = room.Players.First();
                }
                await Clients.Group($"room_{room.Id}").SendAsync("RoomUpdated", room);
                await Clients.All.SendAsync("RoomsList", Rooms.Values.ToList());
            }
        }

        public async Task ToggleRoomPrivacy(string roomId)
        {
            var username = Context.User?.FindFirst(ClaimTypes.Name)?.Value;
            if (string.IsNullOrEmpty(username)) return;
            if (!Rooms.TryGetValue(roomId, out var room)) return;
            if (room.Creator != username) return;
            room.IsPrivate = !room.IsPrivate;
            room.Password = room.IsPrivate ? Guid.NewGuid().ToString().Substring(0, 6) : null;
            await Clients.Group($"room_{room.Id}").SendAsync("RoomUpdated", room);
            await Clients.All.SendAsync("RoomsList", Rooms.Values.ToList());
        }

        public async Task StartGame(string roomId)
        {
            var username = Context.User?.FindFirst(ClaimTypes.Name)?.Value;
            if (string.IsNullOrEmpty(username)) return;
            if (!Rooms.TryGetValue(roomId, out var room)) return;
            if (room.Creator != username) return;
            room.Status = "playing";
            await Clients.Group($"room_{room.Id}").SendAsync("GameStarted", room.GameType, roomId);
            Rooms.TryRemove(roomId, out _);
            await Clients.All.SendAsync("RoomsList", Rooms.Values.ToList());
        }

        public async Task InviteToTable(string friendUsername, string roomId, string gameType)
        {
            var inviter = Context.User?.FindFirst(ClaimTypes.Name)?.Value;
            if (string.IsNullOrEmpty(inviter)) return;
            var room = Rooms.Values.FirstOrDefault(r => r.Id == roomId);
            if (room == null) return;
            if (OnlineUsers.TryGetValue(friendUsername, out var connectionId))
            {
                await Clients.Client(connectionId).SendAsync("TableInvitation", inviter, roomId, gameType, room.Name);
            }
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