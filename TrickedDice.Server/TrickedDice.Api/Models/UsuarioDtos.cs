namespace TrickedDice.Api.Models
{
    public record RegistroModel(string Email, string Password, string Nombre, string PrimerApellido, string? SegundoApellido, string NombreUsuario, string? Nickname, DateTime FechaNacimiento, string Dni);
    public record LoginModel(string Email, string Password);
    public record RecargaModel(decimal Cantidad);
    public record CompletarPerfilModel(string Dni, DateTime FechaNacimiento);
    public record GoogleLoginModel(string IdToken);

    public class UsuarioPerfilDto
    {
        public int IdUsuario { get; set; }
        public string Nombre { get; set; } = string.Empty;
        public string Email { get; set; } = string.Empty;
        public string Contrasena { get; set; } = string.Empty;
        public decimal Saldo { get; set; }
        public bool Baneado { get; set; }
        public string Rol { get; set; } = string.Empty;
        public string? Dni { get; set; }
    }

    public class TransaccionUsuarioDto
    {
        public DateTime Fecha { get; set; }
        public decimal Cantidad { get; set; }
        public string Tipo { get; set; } = string.Empty;
    }
}