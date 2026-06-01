using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Stripe;
using System.Security.Claims;
using Microsoft.Data.SqlClient;
using TrickedDice.Api.Models;

namespace TrickedDice.Api.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    [Authorize]
    public class PaymentController : ControllerBase
    {
        private readonly IConfiguration _configuration;
        private readonly string? _connectionString;
        private readonly ILogger<PaymentController> _logger;

        public PaymentController(IConfiguration configuration, ILogger<PaymentController> logger)
        {
            _configuration = configuration;
            _connectionString = configuration.GetConnectionString("DefaultConnection");
            _logger = logger;
            
            var secretKey = configuration["Stripe:SecretKey"];
            if (!string.IsNullOrEmpty(secretKey))
                _logger.LogInformation($"Stripe Secret Key (primeros 8 chars): {secretKey.Substring(0, Math.Min(8, secretKey.Length))}...");
            else
                _logger.LogError("STRIPE SECRET KEY NO CONFIGURADA en appsettings.Development.json");
            
            StripeConfiguration.ApiKey = secretKey;
        }

        [HttpPost("create-checkout-session")]
        public async Task<IActionResult> CreateCheckoutSession([FromBody] CreateCheckoutRequest request)
        {
            var email = User.FindFirst(ClaimTypes.Email)?.Value;
            if (string.IsNullOrEmpty(email))
                return Unauthorized(new { message = "Usuario no autenticado" });

            var options = new Stripe.Checkout.SessionCreateOptions
            {
                PaymentMethodTypes = new List<string> { "card" },
                LineItems = new List<Stripe.Checkout.SessionLineItemOptions>
                {
                    new Stripe.Checkout.SessionLineItemOptions
                    {
                        PriceData = new Stripe.Checkout.SessionLineItemPriceDataOptions
                        {
                            Currency = "eur",
                            UnitAmount = (long)(request.Amount * 100),
                            ProductData = new Stripe.Checkout.SessionLineItemPriceDataProductDataOptions
                            {
                                Name = "Recarga de saldo"
                            }
                        },
                        Quantity = 1,
                    }
                },
                Mode = "payment",
                SuccessUrl = request.SuccessUrl,
                CancelUrl = request.CancelUrl,
                CustomerEmail = email
            };

            try
            {
                var service = new Stripe.Checkout.SessionService();
                var session = await service.CreateAsync(options);
                return Ok(new CreateCheckoutResponse { SessionId = session.Id, Url = session.Url });
            }
            catch (StripeException stripeEx)
            {
                _logger.LogError(stripeEx, "STRIPE ERROR: {Message}", stripeEx.Message);
                return StatusCode(500, new { message = $"Stripe: {stripeEx.Message}", type = stripeEx.StripeError?.Type });
            }
        }

        [HttpPost("create-payment-intent")]
        public async Task<IActionResult> CreatePaymentIntent([FromBody] CreatePaymentIntentRequest request)
        {
            var email = User.FindFirst(ClaimTypes.Email)?.Value;
            if (string.IsNullOrEmpty(email))
                return Unauthorized(new { message = "Usuario no autenticado" });

            var options = new PaymentIntentCreateOptions
            {
                Amount = (long)(request.Amount * 100),
                Currency = "eur",
                Metadata = new Dictionary<string, string> { { "Email", email } }
            };

            var service = new PaymentIntentService();
            var paymentIntent = await service.CreateAsync(options);

            return Ok(new CreatePaymentIntentResponse
            {
                ClientSecret = paymentIntent.ClientSecret,
                PaymentIntentId = paymentIntent.Id
            });
        }

        [HttpPost("confirm-payment")]
        public async Task<IActionResult> ConfirmPayment([FromBody] ConfirmPaymentRequest request)
        {
            var email = User.FindFirst(ClaimTypes.Email)?.Value;
            if (string.IsNullOrEmpty(email))
                return Unauthorized(new { message = "Usuario no autenticado" });

            var service = new PaymentIntentService();
            var paymentIntent = await service.GetAsync(request.PaymentIntentId);

            if (paymentIntent.Status != "succeeded")
                return BadRequest(new { message = "El pago no fue exitoso" });

            decimal amount = (decimal)paymentIntent.Amount / 100;

            using var connection = new SqlConnection(_connectionString);
            await connection.OpenAsync();
            
            using var transaction = (SqlTransaction)await connection.BeginTransactionAsync();

            try
            {
                int idUsuario;
                decimal saldoActual;
                string sqlSaldo = "SELECT ID_USUARIO, SALDO FROM USUARIO WHERE EMAIL = @Email";
                using (var cmd = new SqlCommand(sqlSaldo, connection, transaction))
                {
                    cmd.Parameters.AddWithValue("@Email", email);
                    using var reader = await cmd.ExecuteReaderAsync();
                    if (!await reader.ReadAsync())
                        return NotFound(new { message = "Usuario no encontrado" });
                    idUsuario = reader.GetInt32(0);
                    saldoActual = reader.GetDecimal(1);
                }

                var nuevoSaldo = saldoActual + amount;

                string sqlUpdate = "UPDATE USUARIO SET SALDO = @Saldo WHERE ID_USUARIO = @IdUsuario";
                using (var cmd = new SqlCommand(sqlUpdate, connection, transaction))
                {
                    cmd.Parameters.AddWithValue("@Saldo", nuevoSaldo);
                    cmd.Parameters.AddWithValue("@IdUsuario", idUsuario);
                    await cmd.ExecuteNonQueryAsync();
                }

                string sqlTrans = @"INSERT INTO TRANSACCION (ID_USUARIO, CANTIDAD, TIPO_TRANSACCION) 
                                    VALUES (@IdUsuario, @Cantidad, 'RECARGA')";
                using (var cmd = new SqlCommand(sqlTrans, connection, transaction))
                {
                    cmd.Parameters.AddWithValue("@IdUsuario", idUsuario);
                    cmd.Parameters.AddWithValue("@Cantidad", amount);
                    await cmd.ExecuteNonQueryAsync();
                }

                await transaction.CommitAsync();

                return Ok(new ConfirmPaymentResponse
                {
                    Success = true,
                    SaldoActualizado = nuevoSaldo,
                    Message = "Pago confirmado y saldo actualizado"
                });
            }
            catch
            {
                await transaction.RollbackAsync();
                throw;
            }
        }

        [HttpPost("confirmar-pago-session")]
        public async Task<IActionResult> ConfirmarPagoPorSession([FromBody] ConfirmarPagoSessionRequest request)
        {
            var email = User.FindFirst(ClaimTypes.Email)?.Value;
            if (string.IsNullOrEmpty(email))
                return Unauthorized(new { message = "Usuario no autenticado" });

            using var connection = new SqlConnection(_connectionString);
            await connection.OpenAsync();

            string sqlCheck = "SELECT COUNT(1) FROM RecargasProcesadas WHERE SessionId = @SessionId";
            using (var checkCmd = new SqlCommand(sqlCheck, connection))
            {
                checkCmd.Parameters.AddWithValue("@SessionId", request.SessionId);
                int exists = Convert.ToInt32(await checkCmd.ExecuteScalarAsync());
                if (exists > 0)
                {
                    _logger.LogWarning($"Intento de recarga duplicada para session {request.SessionId} por {email}");
                    return Conflict(new { 
                        success = false,
                        message = "Esta recarga ya ha sido procesada anteriormente",
                        saldoActualizado = 0 
                    });
                }
            }

            string sqlInsert = "INSERT INTO RecargasProcesadas (SessionId, Email, Amount) VALUES (@SessionId, @Email, 0)";
            using (var insertCmd = new SqlCommand(sqlInsert, connection))
            {
                insertCmd.Parameters.AddWithValue("@SessionId", request.SessionId);
                insertCmd.Parameters.AddWithValue("@Email", email);
                await insertCmd.ExecuteNonQueryAsync();
            }

            var sessionService = new Stripe.Checkout.SessionService();
            var session = await sessionService.GetAsync(request.SessionId);

            if (session.PaymentStatus != "paid")
            {
                string sqlDelete = "DELETE FROM RecargasProcesadas WHERE SessionId = @SessionId";
                using (var deleteCmd = new SqlCommand(sqlDelete, connection))
                {
                    deleteCmd.Parameters.AddWithValue("@SessionId", request.SessionId);
                    await deleteCmd.ExecuteNonQueryAsync();
                }
                return BadRequest(new { message = "El pago no fue exitoso" });
            }

            var paymentIntentService = new PaymentIntentService();
            var paymentIntent = await paymentIntentService.GetAsync(session.PaymentIntentId);
            decimal amount = (decimal)paymentIntent.Amount / 100;

            string sqlUpdateAmount = "UPDATE RecargasProcesadas SET Amount = @Amount WHERE SessionId = @SessionId";
            using (var updateCmd = new SqlCommand(sqlUpdateAmount, connection))
            {
                updateCmd.Parameters.AddWithValue("@Amount", amount);
                updateCmd.Parameters.AddWithValue("@SessionId", request.SessionId);
                await updateCmd.ExecuteNonQueryAsync();
            }

            using var transaction = (SqlTransaction)await connection.BeginTransactionAsync();

            try
            {
                int idUsuario;
                decimal saldoActual;
                string sqlSaldo = "SELECT ID_USUARIO, SALDO FROM USUARIO WHERE EMAIL = @Email";
                using (var cmd = new SqlCommand(sqlSaldo, connection, transaction))
                {
                    cmd.Parameters.AddWithValue("@Email", email);
                    using var reader = await cmd.ExecuteReaderAsync();
                    if (!await reader.ReadAsync())
                    {
                        await transaction.RollbackAsync();
                        return NotFound(new { message = "Usuario no encontrado" });
                    }
                    idUsuario = reader.GetInt32(0);
                    saldoActual = reader.GetDecimal(1);
                }

                decimal nuevoSaldo = saldoActual + amount;

                string sqlUpdate = "UPDATE USUARIO SET SALDO = @Saldo WHERE ID_USUARIO = @IdUsuario";
                using (var cmd = new SqlCommand(sqlUpdate, connection, transaction))
                {
                    cmd.Parameters.AddWithValue("@Saldo", nuevoSaldo);
                    cmd.Parameters.AddWithValue("@IdUsuario", idUsuario);
                    await cmd.ExecuteNonQueryAsync();
                }

                string sqlTrans = @"INSERT INTO TRANSACCION (ID_USUARIO, CANTIDAD, TIPO_TRANSACCION) 
                                    VALUES (@IdUsuario, @Cantidad, 'RECARGA')";
                using (var cmd = new SqlCommand(sqlTrans, connection, transaction))
                {
                    cmd.Parameters.AddWithValue("@IdUsuario", idUsuario);
                    cmd.Parameters.AddWithValue("@Cantidad", amount);
                    await cmd.ExecuteNonQueryAsync();
                }

                await transaction.CommitAsync();

                return Ok(new ConfirmarPagoSessionResponse
                {
                    Success = true,
                    SaldoActualizado = nuevoSaldo,
                    Message = "Pago confirmado y saldo actualizado"
                });
            }
            catch
            {
                await transaction.RollbackAsync();
                throw;
            }
        }
    }
}