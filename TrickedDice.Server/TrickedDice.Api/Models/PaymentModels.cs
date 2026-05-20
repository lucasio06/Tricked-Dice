namespace TrickedDice.Api.Models
{
    public class PaymentIntentCreateRequest
    {
        public long Amount { get; set; }
        public string Currency { get; set; } = "eur";
    }

    public class PaymentIntentResponse
    {
        public string ClientSecret { get; set; } = string.Empty;
    }
}