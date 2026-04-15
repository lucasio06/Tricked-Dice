using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Data.SqlClient;

namespace TrickedDice.Api.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    [Authorize]   // <-- Ahora este endpoint requiere token JWT válido
    public class JuegosController : ControllerBase
    {
        private readonly string? _connectionString;

        public JuegosController(IConfiguration configuration)
        {
            _connectionString = configuration.GetConnectionString("DefaultConnection");
        }

        [HttpGet]
        public IActionResult GetJuegos()
        {
            var listaJuegos = new List<string>();
            try
            {
                using (SqlConnection connection = new SqlConnection(_connectionString))
                {
                    connection.Open();
                    string sql = "SELECT NOMBRE_JUEGO FROM JUEGO";
                    using (SqlCommand command = new SqlCommand(sql, connection))
                    {
                        using (SqlDataReader reader = command.ExecuteReader())
                        {
                            while (reader.Read())
                            {
                                listaJuegos.Add(reader["NOMBRE_JUEGO"].ToString() ?? "");
                            }
                        }
                    }
                }
                return Ok(listaJuegos);
            }
            catch (Exception ex)
            {
                return StatusCode(500, $"Error: {ex.Message}");
            }
        }
    }
}