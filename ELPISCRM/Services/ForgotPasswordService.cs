using Elpis_CRM.Data;
using Elpis_CRM.Model;
using Microsoft.EntityFrameworkCore;
using System.Net.Mail;
using System.Net;
using System.Security.Cryptography;
using System.Text;
using System.Collections.Concurrent;

public class ForgotPasswordService
{
    private readonly AppDbContext _loginDb;
    private static readonly ConcurrentDictionary<string, OtpModel> otpStore = new();

    public ForgotPasswordService(AppDbContext loginDb)
    {
        _loginDb = loginDb;
    }

    /// <summary>
    /// Generates a secure OTP, stores it temporarily, and emails it to the user.
    /// </summary>
    public async Task<string> GenerateOtpAsync(string email)
    {
        if (string.IsNullOrWhiteSpace(email))
        {
            return "Email cannot be empty";
        }

        int otp = RandomNumberGenerator.GetInt32(1000, 10000);

        otpStore[email] = new OtpModel
        {
            Email = email,
            Otp = otp,
            ExpiryTime = DateTime.UtcNow.AddMinutes(5)
        };

        await SendEmailAsync(email, otp);
        return "OTP sent successfully";
    }

    /// <summary>
    /// Validates the OTP and marks it as verified.
    /// </summary>
    public string ValidateOtp(string email, int otp)
    {
        if (!otpStore.TryGetValue(email, out var data))
        {
            return "OTP not found";
        }
        if (data.Otp == otp && data.ExpiryTime > DateTime.UtcNow)
        {
            // Mark as validated
            otpStore[email].Otp = -1;
            return "OTP validated successfully";
        }

        return "Invalid or expired OTP";
    }

    /// <summary>
    /// Updates the password for a user whose OTP has been validated.
    /// </summary>
    public async Task<string> UpdatePasswordAsync(string email, string newPassword)
    {
        if (!otpStore.TryGetValue(email, out var otpEntry) || otpEntry.Otp != -1)
        {
            return "OTP not validated";
        }
        var user = await _loginDb.Login.FirstOrDefaultAsync(u => u.Email == email);
        if (user == null)
        {
            return "User not found";
        }
        user.Password = newPassword;
        await _loginDb.SaveChangesAsync();

        otpStore.TryRemove(email, out _); 
        return "Password updated successfully";
    }

    #region Helpers

    private async Task SendEmailAsync(string userEmail, int otp)
    {
        var fromAddress = new MailAddress("Rajendra.m@elpisitsolutions.com", "Elpis CRM OTP Service");
        var toAddress = new MailAddress(userEmail.Trim());
        string fromPassword = "Rajendra123@@";

        using var smtp = new SmtpClient("smtp.office365.com", 587)
        {
            EnableSsl = true,
            Credentials = new NetworkCredential(fromAddress.Address, fromPassword)
        };

        using var message = new MailMessage(fromAddress, toAddress)
        {
            Subject = "Your OTP Code",
            Body = $"Your OTP code is {otp}. It will expire in 5 minutes."
        };

        await smtp.SendMailAsync(message);
    }
    #endregion
}
