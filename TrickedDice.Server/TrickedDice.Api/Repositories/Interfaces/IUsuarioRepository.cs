using TrickedDice.Api.Models;

namespace TrickedDice.Api.Repositories.Interfaces
{
    public interface IUsuarioRepository
    {
        Task<bool> RegistrarUsuarioAsync(RegistroModel model, string hashContrasena);
        Task<UsuarioPerfilDto?> GetUsuarioPorEmailAsync(string email);
        Task<UsuarioPerfilDto?> GetUsuarioPorNombreAsync(string nombreUsuario);
        Task<bool> RegistrarGoogleUsuarioAsync(string email, string nombre, string apellido, string nombreUsuario, string dniTemporal);
        Task<bool> CompletarPerfilAsync(string email, string dni, DateTime fechaNacimiento);
        Task<decimal?> RecargarSaldoAsync(string email, decimal cantidad);
        Task<IEnumerable<TransaccionUsuarioDto>> GetTransaccionesUsuarioAsync(string email);
        Task<bool> EnviarSolicitudAmistadAsync(int idSolicitante, int idReceptor);
        Task<bool> ResponderSolicitudAmistadAsync(int idSolicitante, int idReceptor, string respuesta);
        Task<IEnumerable<AmigoDto>> GetAmigosYPendientesAsync(int idUsuario);
    }
}