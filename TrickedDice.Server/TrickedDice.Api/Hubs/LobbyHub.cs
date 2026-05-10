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

        public override async Task OnConnectedAsync()
        {
            var username = Context.User?.FindFirst(ClaimTypes.Name)?.Value ?? Context.UserIdentifier;
            if (!string.IsNullOrEmpty(username))
            {
                OnlineUsers[username] = Context.ConnectionId;
                await UpdateOnlineUsers();
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

        public async Task InviteToTable(string friendUsername, string tableId, string gameType)
        {
            if (OnlineUsers.TryGetValue(friendUsername, out var connId))
                await Clients.Client(connId).SendAsync("TableInvitation", Context.User?.FindFirst(ClaimTypes.Name)?.Value, tableId, gameType);
        }

        public async Task JoinTable(string tableId)
        {
            var playerName = Context.User?.FindFirst(ClaimTypes.Name)?.Value ?? "Anónimo";
            await Groups.AddToGroupAsync(Context.ConnectionId, tableId);
            await Clients.Group(tableId).SendAsync("PlayerJoined", playerName);
        }

        public async Task LeaveTable(string tableId)
        {
            var playerName = Context.User?.FindFirst(ClaimTypes.Name)?.Value ?? "Anónimo";
            await Groups.RemoveFromGroupAsync(Context.ConnectionId, tableId);
            await Clients.Group(tableId).SendAsync("PlayerLeft", playerName);
        }

        private async Task UpdateOnlineUsers()
        {
            await Clients.All.SendAsync("OnlineUsers", OnlineUsers.Keys.ToList());
        }
    }
}