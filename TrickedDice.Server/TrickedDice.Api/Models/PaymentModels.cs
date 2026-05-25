namespace TrickedDice.Api.Models
{
    public class CreatePaymentIntentRequest
    {
        public decimal Amount { get; set; }
    }

    public class CreatePaymentIntentResponse
    {
        public string ClientSecret { get; set; } = string.Empty;
        public string PaymentIntentId { get; set; } = string.Empty;
    }

    public class ConfirmPaymentRequest
    {
        public string PaymentIntentId { get; set; } = string.Empty;
    }

    public class ConfirmPaymentResponse
    {
        public bool Success { get; set; }
        public decimal SaldoActualizado { get; set; }
        public string Message { get; set; } = string.Empty;
    }

    public class CreateCheckoutRequest
    {
        public decimal Amount { get; set; }
        public string SuccessUrl { get; set; } = string.Empty;
        public string CancelUrl { get; set; } = string.Empty;
    }

    public class CreateCheckoutResponse
    {
        public string SessionId { get; set; } = string.Empty;
        public string Url { get; set; } = string.Empty;
    }
    public class ConfirmarPagoSessionRequest
    {
        public string SessionId { get; set; } = string.Empty;
    }

    public class ConfirmarPagoSessionResponse
    {
        public bool Success { get; set; }
        public decimal SaldoActualizado { get; set; }
        public string Message { get; set; } = string.Empty;
    }
}