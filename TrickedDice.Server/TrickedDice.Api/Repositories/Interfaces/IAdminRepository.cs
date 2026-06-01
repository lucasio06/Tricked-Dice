using TrickedDice.Api.Models;

namespace TrickedDice.Api.Repositories.Interfaces
{
    public interface IAdminRepository
    {
        Task<IEnumerable<UsuarioAdminDto>> GetUsuariosAsync();
        Task<EstadisticasAdminDto> GetEstadisticasAsync();
        Task<IEnumerable<TransaccionAdminDto>> GetTransaccionesAsync();
        Task<bool> CambiarEstadoBaneoAsync(int idUsuario, bool baneado);
        Task<bool> CambiarRolUsuarioAsync(int idUsuario, string rol);
    }
}