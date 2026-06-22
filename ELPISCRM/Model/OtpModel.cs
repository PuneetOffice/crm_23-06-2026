namespace Elpis_CRM.Model
{
    public class EmailRequest
    {
        public string? Email { get; set; } = string.Empty;
    }

    public class ResetPasswordRequest
    {
        public string? Email { get; set; } = string.Empty;    
        public string? NewPassword { get; set; } = string.Empty;
    }

    public class OtpRequest
    {
        public string Email { get; set; } = string.Empty;  
        public int Otp { get; set; }
    }

    public class OtpModel
    {
        public string? Email { get; set; } = string.Empty;
        public int? Otp { get; set; }
        public DateTime? ExpiryTime { get; set; }
    }
}
