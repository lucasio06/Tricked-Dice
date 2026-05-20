using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Stripe;
using TrickedDice.Api.Models;

namespace TrickedDice.Api.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    [Authorize]
    public class PaymentController : ControllerBase
    {
        private readonly IConfiguration _config;
        private readonly ILogger<PaymentController> _logger;

        public PaymentController(IConfiguration config, ILogger<PaymentController> logger)
        {
            _config = config;
            _logger = logger;
            StripeConfiguration.ApiKey = _config["Stripe:SecretKey"];
        }

        [HttpPost("create-payment-intent")]
        public async Task<IActionResult> CreatePaymentIntent([FromBody] PaymentIntentCreateRequest request)
        {
            try
            {
                var options = new PaymentIntentCreateOptions
                {
                    Amount = request.Amount,
                    Currency = request.Currency,
                    AutomaticPaymentMethods = new PaymentIntentAutomaticPaymentMethodsOptions
                    {
                        Enabled = true,
                    },
                };

                var service = new PaymentIntentService();
                var paymentIntent = await service.CreateAsync(options);

                return Ok(new PaymentIntentResponse { ClientSecret = paymentIntent.ClientSecret });
            }
            catch (StripeException ex)
            {
                _logger.LogError(ex, "Stripe error");
                return BadRequest(new { error = ex.Message });
            }
        }

        [HttpPost("confirm-payment")]
        public async Task<IActionResult> ConfirmPayment([FromBody] ConfirmPaymentRequest request)
        {
            try
            {
                var service = new PaymentIntentService();
                var paymentIntent = await service.GetAsync(request.PaymentIntentId);

                if (paymentIntent.Status == "succeeded")
                {
                    var email = User.FindFirst(System.Security.Claims.ClaimTypes.Email)?.Value;
                    if (string.IsNullOrEmpty(email))
                        return Unauthorized();

                    var montoRecarga = (decimal)(paymentIntent.Amount / 100m);

                    using var connection = new Microsoft.Data.SqlClient.SqlConnection(_config.GetConnectionString("DefaultConnection"));
                    connection.Open();
                    using var transaction = connection.BeginTransaction();

                    var sqlGet = "SELECT ID_USUARIO, SALDO FROM USUARIO WHERE EMAIL = @Email";
                    int idUsuario;
                    decimal saldoActual;
                    using (var cmd = new Microsoft.Data.SqlClient.SqlCommand(sqlGet, connection, transaction))
                    {
                        cmd.Parameters.AddWithValue("@Email", email);
                        using var reader = cmd.ExecuteReader();
                        if (!reader.Read())
                            return NotFound(new { mensaje = "Usuario no encontrado." });
                        idUsuario = reader.GetInt32(0);
                        saldoActual = reader.GetDecimal(1);
                    }

                    var nuevoSaldo = saldoActual + montoRecarga;
                    var sqlUpdate = "UPDATE USUARIO SET SALDO = @Saldo WHERE ID_USUARIO = @IdUsuario";
                    using (var cmd = new Microsoft.Data.SqlClient.SqlCommand(sqlUpdate, connection, transaction))
                    {
                        cmd.Parameters.AddWithValue("@Saldo", nuevoSaldo);
                        cmd.Parameters.AddWithValue("@IdUsuario", idUsuario);
                        cmd.ExecuteNonQuery();
                    }

                    var sqlTrans = @"INSERT INTO TRANSACCION (ID_USUARIO, CANTIDAD, TIPO_TRANSACCION) VALUES (@idUsuario, @cantidad, 'RECARGA')";
                    using (var cmd = new Microsoft.Data.SqlClient.SqlCommand(sqlTrans, connection, transaction))
                    {
                        cmd.Parameters.AddWithValue("@idUsuario", idUsuario);
                        cmd.Parameters.AddWithValue("@cantidad", montoRecarga);
                        cmd.ExecuteNonQuery();
                    }

                    transaction.Commit();

                    return Ok(new { saldoActualizado = nuevoSaldo });
                }

                return BadRequest(new { error = "Payment not successful" });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error confirming payment");
                return StatusCode(500, new { error = ex.Message });
            }
        }
    }

    public class ConfirmPaymentRequest
    {
        public string PaymentIntentId { get; set; } = string.Empty;
    }
}