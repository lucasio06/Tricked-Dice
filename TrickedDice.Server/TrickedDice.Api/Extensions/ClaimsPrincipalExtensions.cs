using System.Security.Claims;

namespace TrickedDice.Api.Extensions
{
    public static class ClaimsPrincipalExtensions
    {
        public static string? GetEmail(this ClaimsPrincipal user)
        {
            return user?.FindFirst(ClaimTypes.Email)?.Value
                   ?? user?.FindFirst("email")?.Value
                   ?? user?.FindFirst(ClaimTypes.Name)?.Value
                   ?? user?.FindFirst("unique_name")?.Value;
        }

        public static string? GetUserName(this ClaimsPrincipal user)
        {
            return user?.FindFirst("name")?.Value
                   ?? user?.FindFirst(ClaimTypes.Name)?.Value
                   ?? user?.GetEmail();
        }
    }
}