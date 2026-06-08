using Dapper;
using Microsoft.Data.SqlClient;
using TrickedDice.Api.Models;
using TrickedDice.Api.Repositories.Interfaces;

namespace TrickedDice.Api.Repositories
{
    public class UsuarioRepository : IUsuarioRepository
    {
        private readonly string _connectionString;

        public UsuarioRepository(IConfiguration configuration)
        {
            _connectionString = configuration.GetConnectionString("DefaultConnection")!;
        }

        public async Task<bool> RegistrarUsuarioAsync(RegistroModel model, string hashContrasena)
        {
            using var connection = new SqlConnection(_connectionString);
            string sql = @"INSERT INTO USUARIO 
                (EMAIL, CONTRASENA, NOMBRE, PRIMER_APELLIDO, SEGUNDO_APELLIDO, NOMBRE_USUARIO, NICKNAME, FECHA_NACIMIENTO, DNI, SALDO) 
                VALUES (@Email, @Password, @Nombre, @PrimerApellido, @SegundoApellido, @NombreUsuario, @Nickname, @FechaNacimiento, @Dni, 0)";
            
            try
            {
                var filas = await connection.ExecuteAsync(sql, new {
                    model.Email, Password = hashContrasena, model.Nombre, model.PrimerApellido,
                    SegundoApellido = (object?)model.SegundoApellido ?? DBNull.Value, model.NombreUsuario,
                    Nickname = string.IsNullOrWhiteSpace(model.Nickname) ? model.NombreUsuario : model.Nickname,
                    model.FechaNacimiento, model.Dni
                });
                return filas > 0;
            }
            catch (SqlException ex) when (ex.Number == 2627 || ex.Number == 2601) { return false; }
        }

        public async Task<UsuarioPerfilDto?> GetUsuarioPorEmailAsync(string email)
        {
            using var connection = new SqlConnection(_connectionString);
            var sql = "SELECT ID_USUARIO as IdUsuario, NOMBRE_USUARIO as NombreUsuario, NOMBRE as Nombre, EMAIL as Email, CONTRASENA as Contrasena, SALDO as Saldo, BANEADO as Baneado, ROL as Rol, DNI as Dni FROM USUARIO WHERE EMAIL = @Email";
            return await connection.QuerySingleOrDefaultAsync<UsuarioPerfilDto>(sql, new { Email = email });
        }

        public async Task<UsuarioPerfilDto?> GetUsuarioPorNombreAsync(string nombreUsuario)
        {
            using var connection = new SqlConnection(_connectionString);
            var sql = "SELECT ID_USUARIO as IdUsuario, NOMBRE_USUARIO as NombreUsuario, NOMBRE as Nombre, EMAIL as Email, CONTRASENA as Contrasena, SALDO as Saldo, BANEADO as Baneado, ROL as Rol, DNI as Dni FROM USUARIO WHERE NOMBRE_USUARIO = @NombreUsuario";
            return await connection.QuerySingleOrDefaultAsync<UsuarioPerfilDto>(sql, new { NombreUsuario = nombreUsuario });
        }

        public async Task<bool> RegistrarGoogleUsuarioAsync(string email, string nombre, string apellido, string nombreUsuario, string dniTemporal)
        {
            using var connection = new SqlConnection(_connectionString);
            string sql = @"INSERT INTO USUARIO 
                (EMAIL, CONTRASENA, NOMBRE, PRIMER_APELLIDO, NOMBRE_USUARIO, FECHA_NACIMIENTO, DNI, SALDO, BANEADO) 
                VALUES (@Email, @Contrasena, @Nombre, @PrimerApellido, @NombreUsuario, @FechaNacimiento, @Dni, 0, 0)";

            await connection.ExecuteAsync(sql, new {
                Email = email, Contrasena = Guid.NewGuid().ToString(), Nombre = nombre,
                PrimerApellido = apellido, NombreUsuario = nombreUsuario, FechaNacimiento = new DateTime(2000, 1, 1), Dni = dniTemporal
            });
            return true;
        }

        public async Task<bool> CompletarPerfilAsync(string email, string dni, DateTime fechaNacimiento)
        {
            try
            {
                using var connection = new SqlConnection(_connectionString);
                string sql = "UPDATE USUARIO SET DNI = @Dni, FECHA_NACIMIENTO = @FechaNacimiento WHERE EMAIL = @Email";
                await connection.ExecuteAsync(sql, new { Dni = dni, FechaNacimiento = fechaNacimiento, Email = email });
                return true;
            }
            catch (SqlException ex) when (ex.Number == 2627 || ex.Number == 2601) { return false; }
        }

        public async Task<decimal?> RecargarSaldoAsync(string email, decimal cantidad)
        {
            using var connection = new SqlConnection(_connectionString);
            await connection.OpenAsync();
            using var transaction = connection.BeginTransaction();
            
            var user = await connection.QuerySingleOrDefaultAsync<dynamic>(
                "SELECT ID_USUARIO as IdUsuario, SALDO as Saldo FROM USUARIO WHERE EMAIL = @Email", 
                new { Email = email }, transaction);
                
            if (user == null) return null;

            decimal nuevoSaldo = user.Saldo + cantidad;
            await connection.ExecuteAsync("UPDATE USUARIO SET SALDO = @Saldo WHERE ID_USUARIO = @IdUsuario", 
                new { Saldo = nuevoSaldo, IdUsuario = user.IdUsuario }, transaction);
            
            await connection.ExecuteAsync("INSERT INTO TRANSACCION (ID_USUARIO, CANTIDAD, TIPO_TRANSACCION) VALUES (@IdUsuario, @Cantidad, 'RECARGA')", 
                new { IdUsuario = user.IdUsuario, Cantidad = cantidad }, transaction);

            transaction.Commit();
            return nuevoSaldo;
        }

        public async Task<IEnumerable<TransaccionUsuarioDto>> GetTransaccionesUsuarioAsync(string email)
        {
            using var connection = new SqlConnection(_connectionString);
            var sql = @"SELECT T.FECHA_TRANSACCION as Fecha, T.CANTIDAD as Cantidad, T.TIPO_TRANSACCION as Tipo 
                        FROM TRANSACCION T INNER JOIN USUARIO U ON T.ID_USUARIO = U.ID_USUARIO 
                        WHERE U.EMAIL = @Email ORDER BY T.FECHA_TRANSACCION DESC";
            return await connection.QueryAsync<TransaccionUsuarioDto>(sql, new { Email = email });
        }

        public async Task<bool> EnviarSolicitudAmistadAsync(int idSolicitante, int idReceptor)
        {
            using var connection = new SqlConnection(_connectionString);
            
            string sqlCheck = @"SELECT COUNT(1) FROM AMIGO 
                                WHERE (ID_SOLICITANTE = @IdSolicitante AND ID_RECEPTOR = @IdReceptor) 
                                   OR (ID_SOLICITANTE = @IdReceptor AND ID_RECEPTOR = @IdSolicitante)";
            
            var existe = await connection.ExecuteScalarAsync<int>(sqlCheck, new { IdSolicitante = idSolicitante, IdReceptor = idReceptor });
            if (existe > 0) return false;

            string sqlInsert = @"INSERT INTO AMIGO (ID_SOLICITANTE, ID_RECEPTOR, ESTADO) 
                                 VALUES (@IdSolicitante, @IdReceptor, 'Pendiente')";
            
            try
            {
                var filas = await connection.ExecuteAsync(sqlInsert, new { IdSolicitante = idSolicitante, IdReceptor = idReceptor });
                return filas > 0;
            }
            catch (SqlException) { return false; }
        }

        public async Task<bool> ResponderSolicitudAmistadAsync(int idSolicitante, int idReceptor, string respuesta)
        {
            using var connection = new SqlConnection(_connectionString);
            
            if (respuesta == "Rechazado")
            {
                string sqlDelete = "DELETE FROM AMIGO WHERE ID_SOLICITANTE = @IdSolicitante AND ID_RECEPTOR = @IdReceptor";
                var filas = await connection.ExecuteAsync(sqlDelete, new { IdSolicitante = idSolicitante, IdReceptor = idReceptor });
                return filas > 0;
            }
            
            if (respuesta == "Aceptado")
            {
                string sqlUpdate = "UPDATE AMIGO SET ESTADO = 'Aceptado' WHERE ID_SOLICITANTE = @IdSolicitante AND ID_RECEPTOR = @IdReceptor";
                var filas = await connection.ExecuteAsync(sqlUpdate, new { IdSolicitante = idSolicitante, IdReceptor = idReceptor });
                return filas > 0;
            }

            return false;
        }

        public async Task<IEnumerable<AmigoDto>> GetAmigosYPendientesAsync(int idUsuario)
        {
            using var connection = new SqlConnection(_connectionString);
            
            var sql = @"
                SELECT 
                    U.ID_USUARIO as IdUsuario,
                    U.NOMBRE_USUARIO as NombreUsuario,
                    U.EMAIL as Email,
                    A.ESTADO as Estado,
                    CAST(CASE WHEN A.ID_SOLICITANTE = @IdUsuario THEN 1 ELSE 0 END AS BIT) as EsSolicitante
                FROM AMIGO A
                INNER JOIN USUARIO U ON (A.ID_SOLICITANTE = U.ID_USUARIO OR A.ID_RECEPTOR = U.ID_USUARIO)
                WHERE (A.ID_SOLICITANTE = @IdUsuario OR A.ID_RECEPTOR = @IdUsuario)
                  AND U.ID_USUARIO != @IdUsuario";

            return await connection.QueryAsync<AmigoDto>(sql, new { IdUsuario = idUsuario });
        }
    }
}