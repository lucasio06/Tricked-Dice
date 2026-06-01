namespace TrickedDice.Api.Models
{
    public class UsuarioAdminDto
    {
        public int IdUsuario { get; set; }
        public string Email { get; set; } = string.Empty;
        public string Nombre { get; set; } = string.Empty;
        public string PrimerApellido { get; set; } = string.Empty;
        public string NombreUsuario { get; set; } = string.Empty;
        public decimal Saldo { get; set; }
        public DateTime FechaNacimiento { get; set; }
        public string Dni { get; set; } = string.Empty;
        public bool Baneado { get; set; }
        public string Rol { get; set; } = string.Empty;
    }

    public class TransaccionAdminDto
    {
        public int IdTransaccion { get; set; }
        public string Nombre { get; set; } = string.Empty;
        public string Email { get; set; } = string.Empty;
        public decimal Cantidad { get; set; }
        public string Tipo { get; set; } = string.Empty;
        public DateTime Fecha { get; set; }
    }

    public class EstadisticasAdminDto
    {
        public int TotalUsuarios { get; set; }
        public decimal TotalRecargas { get; set; }
        public decimal TotalApostado { get; set; }
        public decimal TotalPremios { get; set; }
        public decimal Beneficio { get; set; }
        public decimal SaldoTotal { get; set; }
    }
}