using Dapper;
using Microsoft.Data.SqlClient;
using TrickedDice.Api.Models;
using TrickedDice.Api.Repositories.Interfaces;

namespace TrickedDice.Api.Repositories
{
    public class AdminRepository : IAdminRepository
    {
        private readonly string _connectionString;

        public AdminRepository(IConfiguration configuration)
        {
            _connectionString = configuration.GetConnectionString("DefaultConnection")!;
        }

        public async Task<IEnumerable<UsuarioAdminDto>> GetUsuariosAsync()
        {
            using var connection = new SqlConnection(_connectionString);
            var sql = @"
                SELECT ID_USUARIO as IdUsuario, 
                       EMAIL as Email, 
                       NOMBRE as Nombre, 
                       PRIMER_APELLIDO as PrimerApellido, 
                       NOMBRE_USUARIO as NombreUsuario, 
                       SALDO as Saldo, 
                       FECHA_NACIMIENTO as FechaNacimiento, 
                       DNI as Dni, 
                       BANEADO as Baneado,
                       ROL as Rol
                FROM USUARIO 
                ORDER BY ID_USUARIO DESC";
            
            return await connection.QueryAsync<UsuarioAdminDto>(sql);
        }

        public async Task<EstadisticasAdminDto> GetEstadisticasAsync()
        {
            using var connection = new SqlConnection(_connectionString);
            var sql = @"
                SELECT 
                    (SELECT COUNT(1) FROM USUARIO) as TotalUsuarios,
                    (SELECT ISNULL(SUM(CANTIDAD), 0) FROM TRANSACCION WHERE TIPO_TRANSACCION = 'RECARGA') as TotalRecargas,
                    (SELECT ISNULL(SUM(CANTIDAD), 0) FROM TRANSACCION WHERE TIPO_TRANSACCION = 'APUESTA') as TotalApostado,
                    (SELECT ISNULL(SUM(CANTIDAD), 0) FROM TRANSACCION WHERE TIPO_TRANSACCION = 'PREMIO') as TotalPremios,
                    (SELECT ISNULL(SUM(SALDO), 0) FROM USUARIO) as SaldoTotal";

            var stats = await connection.QuerySingleAsync<EstadisticasAdminDto>(sql);
            stats.Beneficio = stats.TotalRecargas - stats.TotalPremios;
            
            return stats;
        }

        public async Task<IEnumerable<TransaccionAdminDto>> GetTransaccionesAsync()
        {
            using var connection = new SqlConnection(_connectionString);
            var sql = @"
                SELECT t.ID_TRANSACCION as IdTransaccion,
                       u.NOMBRE as Nombre,
                       u.EMAIL as Email,
                       t.CANTIDAD as Cantidad,
                       t.TIPO_TRANSACCION as Tipo,
                       t.FECHA_TRANSACCION as Fecha
                FROM TRANSACCION t
                JOIN USUARIO u ON t.ID_USUARIO = u.ID_USUARIO
                ORDER BY t.FECHA_TRANSACCION DESC";
            
            return await connection.QueryAsync<TransaccionAdminDto>(sql);
        }

        public async Task<bool> CambiarEstadoBaneoAsync(int idUsuario, bool baneado)
        {
            using var connection = new SqlConnection(_connectionString);
            var sql = "UPDATE USUARIO SET BANEADO = @Baneado WHERE ID_USUARIO = @IdUsuario";
            var filas = await connection.ExecuteAsync(sql, new { Baneado = baneado, IdUsuario = idUsuario });
            return filas > 0;
        }

        public async Task<bool> CambiarRolUsuarioAsync(int idUsuario, string rol)
        {
            using var connection = new SqlConnection(_connectionString);
            var sql = "UPDATE USUARIO SET ROL = @Rol WHERE ID_USUARIO = @IdUsuario";
            var filas = await connection.ExecuteAsync(sql, new { Rol = rol, IdUsuario = idUsuario });
            return filas > 0;
        }
    }
}