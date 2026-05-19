using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Data.SqlClient;
using System.Security.Claims;

namespace TrickedDice.Api
{
    [ApiController]
    [Route("api/[controller]")]
    [Authorize]
    public class RuletaController : ControllerBase
    {
        private readonly string? _connectionString;
        private readonly ILogger<RuletaController> _logger;

        public RuletaController(IConfiguration configuration, ILogger<RuletaController> logger)
        {
            _connectionString = configuration.GetConnectionString("DefaultConnection");
            _logger = logger;
        }

        public class ApuestaModel
        {
            public decimal Monto { get; set; }
            public string TipoApuesta { get; set; } = string.Empty;
            public string? ValorApuesta { get; set; }
        }

        [HttpPost("girar")]
        public IActionResult Girar([FromBody] ApuestaModel apuesta)
        {
            _logger.LogInformation("Recibida apuesta: Tipo={Tipo}, Valor={Valor}, Monto={Monto}",
                apuesta.TipoApuesta, apuesta.ValorApuesta, apuesta.Monto);

            if (apuesta.Monto <= 0)
                return BadRequest(new { mensaje = "El monto de la apuesta debe ser mayor a 0." });

            var email = User.FindFirst(ClaimTypes.Email)?.Value
                        ?? User.FindFirst("email")?.Value
                        ?? User.FindFirst(ClaimTypes.Name)?.Value
                        ?? User.FindFirst("unique_name")?.Value;

            if (string.IsNullOrEmpty(email))
                return Unauthorized(new { mensaje = "No se pudo determinar el email del usuario." });

            using (var connection = new SqlConnection(_connectionString))
            {
                connection.Open();
                SqlTransaction transaction = connection.BeginTransaction();

                try
                {
                    int idUsuario;
                    decimal saldoActual;
                    string sqlSaldo = "SELECT ID_USUARIO, SALDO FROM USUARIO WHERE EMAIL = @Email";
                    using (var cmd = new SqlCommand(sqlSaldo, connection, transaction))
                    {
                        cmd.Parameters.AddWithValue("@Email", email);
                        using (var reader = cmd.ExecuteReader())
                        {
                            if (!reader.Read())
                                return NotFound(new { mensaje = "Usuario no encontrado." });
                            idUsuario = reader.GetInt32(0);
                            saldoActual = reader.GetDecimal(1);
                        }
                    }

                    if (saldoActual < apuesta.Monto)
                        return BadRequest(new { mensaje = "Saldo insuficiente." });

                    Random rnd = new Random();
                    int numeroGanador = rnd.Next(0, 37);
                    decimal premio = 0;
                    bool gano = false;

                    string tipo = apuesta.TipoApuesta?.ToLower() ?? "";
                    string valor = apuesta.ValorApuesta ?? "";

                    switch (tipo)
                    {
                        case "color":
                            if (!string.IsNullOrEmpty(valor))
                            {
                                string colorApostado = valor.ToLower();
                                string colorGanador = ObtenerColor(numeroGanador);
                                if (colorApostado == colorGanador && numeroGanador != 0)
                                {
                                    premio = apuesta.Monto * 2;
                                    gano = true;
                                }
                            }
                            break;
                        case "paridad":
                            if (!string.IsNullOrEmpty(valor))
                            {
                                string paridadApostada = valor.ToLower();
                                if (numeroGanador != 0)
                                {
                                    bool esPar = (numeroGanador % 2 == 0);
                                    if ((paridadApostada == "par" && esPar) || (paridadApostada == "impar" && !esPar))
                                    {
                                        premio = apuesta.Monto * 2;
                                        gano = true;
                                    }
                                }
                            }
                            break;
                        case "mitad":
                            if (!string.IsNullOrEmpty(valor))
                            {
                                if (numeroGanador != 0)
                                {
                                    string mitad = valor.ToLower();
                                    bool esMitadBaja = numeroGanador >= 1 && numeroGanador <= 18;
                                    if ((mitad == "1-18" && esMitadBaja) || (mitad == "19-36" && !esMitadBaja))
                                    {
                                        premio = apuesta.Monto * 2;
                                        gano = true;
                                    }
                                }
                            }
                            break;
                        case "docena":
                            if (int.TryParse(valor, out int docena) && numeroGanador != 0)
                            {
                                int docenaGanadora = (numeroGanador - 1) / 12 + 1;
                                if (docena == docenaGanadora)
                                {
                                    premio = apuesta.Monto * 3;
                                    gano = true;
                                }
                            }
                            break;
                        case "columna":
                            if (int.TryParse(valor, out int columna) && numeroGanador != 0)
                            {
                                if (numeroGanador % 3 == columna % 3)
                                {
                                    premio = apuesta.Monto * 3;
                                    gano = true;
                                }
                            }
                            break;
                        case "seisena":
                            string[] partesSeis = valor.Split('-');
                            if (partesSeis.Length == 2 && int.TryParse(partesSeis[0], out int inicio) && int.TryParse(partesSeis[1], out int fin))
                            {
                                if (numeroGanador >= inicio && numeroGanador <= fin)
                                {
                                    premio = apuesta.Monto * 6;
                                    gano = true;
                                }
                            }
                            break;
                        case "cuadro":
                            string[] numsCuadro = valor.Split(',');
                            if (numsCuadro.Contains(numeroGanador.ToString()))
                            {
                                premio = apuesta.Monto * 9;
                                gano = true;
                            }
                            break;
                        case "calle":
                            string[] numsCalle = valor.Split(',');
                            if (numsCalle.Contains(numeroGanador.ToString()))
                            {
                                premio = apuesta.Monto * 12;
                                gano = true;
                            }
                            break;
                        case "caballo":
                            string[] numsCaballo = valor.Split(',');
                            if (numsCaballo.Contains(numeroGanador.ToString()))
                            {
                                premio = apuesta.Monto * 18;
                                gano = true;
                            }
                            break;
                        case "pleno":
                        case "numero":
                            if (valor == numeroGanador.ToString())
                            {
                                premio = apuesta.Monto * 36;
                                gano = true;
                            }
                            break;
                        case "vecinos0":
                            if (EsVecinoDeCero(numeroGanador))
                            {
                                premio = apuesta.Monto * 2;
                                gano = true;
                            }
                            break;
                        case "tercio":
                            if (EsTercioDelCilindro(numeroGanador))
                            {
                                premio = apuesta.Monto * 2;
                                gano = true;
                            }
                            break;
                        case "huerfanos":
                            if (EsHuerfano(numeroGanador))
                            {
                                premio = apuesta.Monto * 3;
                                gano = true;
                            }
                            break;
                        case "juego0":
                            if (EsJuegoAlCero(numeroGanador))
                            {
                                premio = apuesta.Monto * 3;
                                gano = true;
                            }
                            break;
                        case "finales":
                            if (int.TryParse(valor, out int final) && numeroGanador % 10 == final)
                            {
                                premio = apuesta.Monto * 2;
                                gano = true;
                            }
                            break;
                        default:
                            return BadRequest(new { mensaje = "Tipo de apuesta no válido." });
                    }

                    decimal nuevoSaldo = gano ? saldoActual - apuesta.Monto + premio : saldoActual - apuesta.Monto;

                    string sqlUpdate = "UPDATE USUARIO SET SALDO = @Saldo WHERE ID_USUARIO = @IdUsuario";
                    using (var cmd = new SqlCommand(sqlUpdate, connection, transaction))
                    {
                        cmd.Parameters.AddWithValue("@Saldo", nuevoSaldo);
                        cmd.Parameters.AddWithValue("@IdUsuario", idUsuario);
                        cmd.ExecuteNonQuery();
                    }

                    string sqlTransApuesta = @"INSERT INTO TRANSACCION (ID_USUARIO, CANTIDAD, TIPO_TRANSACCION) 
                                              VALUES (@idUsuario, @cantidad, 'APUESTA')";
                    using (var cmd = new SqlCommand(sqlTransApuesta, connection, transaction))
                    {
                        cmd.Parameters.AddWithValue("@idUsuario", idUsuario);
                        cmd.Parameters.AddWithValue("@cantidad", -apuesta.Monto);
                        cmd.ExecuteNonQuery();
                    }

                    if (gano)
                    {
                        string sqlTransPremio = @"INSERT INTO TRANSACCION (ID_USUARIO, CANTIDAD, TIPO_TRANSACCION) 
                                                 VALUES (@idUsuario, @cantidad, 'PREMIO')";
                        using (var cmd = new SqlCommand(sqlTransPremio, connection, transaction))
                        {
                            cmd.Parameters.AddWithValue("@idUsuario", idUsuario);
                            cmd.Parameters.AddWithValue("@cantidad", premio);
                            cmd.ExecuteNonQuery();
                        }
                    }

                    transaction.Commit();

                    _logger.LogInformation("Resultado: Num={Num}, Gano={Gano}, Premio={Premio}", numeroGanador, gano, premio);
                    return Ok(new
                    {
                        numeroGanador,
                        gano,
                        premio,
                        saldoActualizado = nuevoSaldo
                    });
                }
                catch (Exception ex)
                {
                    transaction.Rollback();
                    _logger.LogError(ex, "Error al procesar apuesta.");
                    return StatusCode(500, new { mensaje = "Error interno del servidor." });
                }
            }
        }

        public class ApuestaMultipleModel
        {
            public string Tipo { get; set; } = string.Empty;
            public string Valor { get; set; } = string.Empty;
            public decimal Monto { get; set; }
        }

        [HttpPost("girar-multiple")]
        public IActionResult GirarMultiple([FromBody] List<ApuestaMultipleModel> apuestas)
        {
            if (apuestas == null || apuestas.Count == 0)
                return BadRequest(new { mensaje = "Debe proporcionar al menos una apuesta." });

            var email = User.FindFirst(ClaimTypes.Email)?.Value
                        ?? User.FindFirst("email")?.Value
                        ?? User.FindFirst(ClaimTypes.Name)?.Value
                        ?? User.FindFirst("unique_name")?.Value;

            if (string.IsNullOrEmpty(email))
                return Unauthorized(new { mensaje = "No se pudo determinar el email del usuario." });

            using (var connection = new SqlConnection(_connectionString))
            {
                connection.Open();
                SqlTransaction transaction = connection.BeginTransaction();

                try
                {
                    int idUsuario;
                    decimal saldoActual;
                    string sqlSaldo = "SELECT ID_USUARIO, SALDO FROM USUARIO WHERE EMAIL = @Email";
                    using (var cmd = new SqlCommand(sqlSaldo, connection, transaction))
                    {
                        cmd.Parameters.AddWithValue("@Email", email);
                        using (var reader = cmd.ExecuteReader())
                        {
                            if (!reader.Read())
                                return NotFound(new { mensaje = "Usuario no encontrado." });
                            idUsuario = reader.GetInt32(0);
                            saldoActual = reader.GetDecimal(1);
                        }
                    }

                    decimal montoTotal = apuestas.Sum(a => a.Monto);
                    if (saldoActual < montoTotal)
                        return BadRequest(new { mensaje = "Saldo insuficiente." });

                    Random rnd = new Random();
                    int numeroGanador = rnd.Next(0, 37);
                    decimal premioTotal = 0;
                    bool algunaGanadora = false;

                    foreach (var ap in apuestas)
                    {
                        var (gano, premio) = CalcularPremioInterno(ap.Monto, ap.Tipo, ap.Valor, numeroGanador);
                        if (gano)
                        {
                            algunaGanadora = true;
                            premioTotal += premio;
                        }
                    }

                    decimal nuevoSaldo = saldoActual - montoTotal + premioTotal;

                    string sqlUpdate = "UPDATE USUARIO SET SALDO = @Saldo WHERE ID_USUARIO = @IdUsuario";
                    using (var cmd = new SqlCommand(sqlUpdate, connection, transaction))
                    {
                        cmd.Parameters.AddWithValue("@Saldo", nuevoSaldo);
                        cmd.Parameters.AddWithValue("@IdUsuario", idUsuario);
                        cmd.ExecuteNonQuery();
                    }

                    string sqlTransApuesta = @"INSERT INTO TRANSACCION (ID_USUARIO, CANTIDAD, TIPO_TRANSACCION) 
                                               VALUES (@idUsuario, @cantidad, 'APUESTA')";
                    using (var cmd = new SqlCommand(sqlTransApuesta, connection, transaction))
                    {
                        cmd.Parameters.AddWithValue("@idUsuario", idUsuario);
                        cmd.Parameters.AddWithValue("@cantidad", -montoTotal);
                        cmd.ExecuteNonQuery();
                    }

                    if (premioTotal > 0)
                    {
                        string sqlTransPremio = @"INSERT INTO TRANSACCION (ID_USUARIO, CANTIDAD, TIPO_TRANSACCION) 
                                                  VALUES (@idUsuario, @cantidad, 'PREMIO')";
                        using (var cmd = new SqlCommand(sqlTransPremio, connection, transaction))
                        {
                            cmd.Parameters.AddWithValue("@idUsuario", idUsuario);
                            cmd.Parameters.AddWithValue("@cantidad", premioTotal);
                            cmd.ExecuteNonQuery();
                        }
                    }

                    transaction.Commit();

                    return Ok(new
                    {
                        numeroGanador,
                        gano = algunaGanadora,
                        premio = premioTotal,
                        saldoActualizado = nuevoSaldo
                    });
                }
                catch (Exception ex)
                {
                    transaction.Rollback();
                    _logger.LogError(ex, "Error al procesar apuestas múltiples.");
                    return StatusCode(500, new { mensaje = "Error interno del servidor." });
                }
            }
        }

        private (bool gano, decimal premio) CalcularPremioInterno(decimal monto, string tipo, string valor, int numeroGanador)
        {
            tipo = tipo.ToLower();
            switch (tipo)
            {
                case "color":
                    string colorApostado = valor.ToLower();
                    string colorGanador = ObtenerColor(numeroGanador);
                    if (colorApostado == colorGanador && numeroGanador != 0)
                        return (true, monto * 2);
                    break;
                case "paridad":
                    if (numeroGanador != 0 && valor.ToLower() == (numeroGanador % 2 == 0 ? "par" : "impar"))
                        return (true, monto * 2);
                    break;
                case "mitad":
                    if (numeroGanador != 0 && ((valor == "1-18" && numeroGanador <= 18) || (valor == "19-36" && numeroGanador > 18)))
                        return (true, monto * 2);
                    break;
                case "docena":
                    if (int.TryParse(valor, out int docena) && numeroGanador != 0)
                    {
                        int docenaGanadora = (numeroGanador - 1) / 12 + 1;
                        if (docena == docenaGanadora)
                            return (true, monto * 3);
                    }
                    break;
                case "columna":
                    if (int.TryParse(valor, out int columna) && numeroGanador != 0)
                    {
                        if (numeroGanador % 3 == columna % 3)
                            return (true, monto * 3);
                    }
                    break;
                case "pleno":
                    if (int.TryParse(valor, out int numPleno) && numPleno == numeroGanador)
                        return (true, monto * 36);
                    break;
                case "caballo":
                    var numsCaballo = valor.Split(',').Select(int.Parse).ToArray();
                    if (numsCaballo.Contains(numeroGanador))
                        return (true, monto * 18);
                    break;
                case "calle":
                    var numsCalle = valor.Split(',').Select(int.Parse).ToArray();
                    if (numsCalle.Contains(numeroGanador))
                        return (true, monto * 12);
                    break;
                case "cuadro":
                    var numsCuadro = valor.Split(',').Select(int.Parse).ToArray();
                    if (numsCuadro.Contains(numeroGanador))
                        return (true, monto * 9);
                    break;
                case "seisena":
                    var numsSeisena = valor.Split(',').Select(int.Parse).ToArray();
                    if (numsSeisena.Contains(numeroGanador))
                        return (true, monto * 6);
                    break;
                case "vecinos0":
                    if (EsVecinoDeCero(numeroGanador))
                        return (true, monto * 2);
                    break;
                case "tercio":
                    if (EsTercioDelCilindro(numeroGanador))
                        return (true, monto * 2);
                    break;
                case "huerfanos":
                    if (EsHuerfano(numeroGanador))
                        return (true, monto * 3);
                    break;
                case "juego0":
                    if (EsJuegoAlCero(numeroGanador))
                        return (true, monto * 3);
                    break;
                case "finales":
                    if (int.TryParse(valor, out int final) && numeroGanador % 10 == final)
                        return (true, monto * 2);
                    break;
            }
            return (false, 0);
        }

        private bool EsVecinoDeCero(int num) => new[] { 0, 2, 3, 4, 7, 12, 15, 18, 19, 21, 22, 25, 26, 28, 29, 32, 35 }.Contains(num);
        private bool EsTercioDelCilindro(int num) => new[] { 27, 13, 36, 11, 30, 8, 23, 10, 5, 24, 16, 33 }.Contains(num);
        private bool EsHuerfano(int num) => new[] { 1, 6, 9, 14, 17, 20, 31, 34 }.Contains(num);
        private bool EsJuegoAlCero(int num) => new[] { 0, 3, 12, 15, 26, 32, 35 }.Contains(num);

        private string ObtenerColor(int numero)
        {
            if (numero == 0) return "verde";
            int[] rojos = { 1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36 };
            return rojos.Contains(numero) ? "rojo" : "negro";
        }

        [HttpGet("saldo")]
        public IActionResult GetSaldo()
        {
            var email = User.FindFirst(ClaimTypes.Email)?.Value
                        ?? User.FindFirst("email")?.Value
                        ?? User.FindFirst(ClaimTypes.Name)?.Value
                        ?? User.FindFirst("unique_name")?.Value;

            if (string.IsNullOrEmpty(email))
                return Unauthorized(new { mensaje = "No se pudo determinar el email del usuario." });

            using (var connection = new SqlConnection(_connectionString))
            {
                connection.Open();
                string sql = "SELECT SALDO FROM USUARIO WHERE EMAIL = @Email";
                using (var cmd = new SqlCommand(sql, connection))
                {
                    cmd.Parameters.AddWithValue("@Email", email);
                    var result = cmd.ExecuteScalar();
                    if (result == null || result == DBNull.Value)
                        return NotFound(new { mensaje = "Usuario no encontrado." });
                    return Ok(new { saldo = Convert.ToDecimal(result) });
                }
            }
        }
    }
}