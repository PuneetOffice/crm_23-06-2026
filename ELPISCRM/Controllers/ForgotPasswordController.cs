using Elpis_CRM.Model;
using Elpis_CRM.Services;
using Microsoft.AspNetCore.Mvc;
using System.Threading.Tasks;

namespace Elpis_CRM.Controllers
{
    /// <summary>
    /// Handles forgot password operations such as OTP generation,
    /// OTP validation, and password reset.
    /// </summary>
    [ApiController]
    [Route("api/[controller]")]
    public class ForgotPasswordController : ControllerBase
    {
        private readonly ForgotPasswordService _forgotPasswordService;

        public ForgotPasswordController(ForgotPasswordService forgotPasswordService)
        {
            _forgotPasswordService = forgotPasswordService;
        }

        /// <summary>
        /// Generates a one-time password (OTP) and sends it to the user's email.
        /// </summary>
        [HttpPost("generate-otp")]
        public async Task<IActionResult> GenerateOtp([FromBody] EmailRequest request)
        {
            if (string.IsNullOrWhiteSpace(request.Email))
            {
                return BadRequest(new { Message = "Email is required" });
            }
            var result = await _forgotPasswordService.GenerateOtpAsync(request.Email);
            return Ok(new { Message = result });
        }

        /// <summary>
        /// Validates the provided OTP.
        /// </summary>
        [HttpPost("validate-otp")]
        public IActionResult ValidateOtp([FromBody] OtpRequest request)
        {
            if (string.IsNullOrWhiteSpace(request.Email))
            {
                return BadRequest(new { Message = "Email is required" });
            }
            var result = _forgotPasswordService.ValidateOtp(request.Email, request.Otp);

            if (result == "OTP validated successfully")
            {
                return Ok(new { Message = result });
            }
            return BadRequest(new { Message = result });
        }

        /// <summary>
        /// Updates the user's password after successful OTP validation.
        /// </summary>
        [HttpPost("update-password")]
        public async Task<IActionResult> UpdatePassword([FromBody] ResetPasswordRequest request)
        {
            if (string.IsNullOrWhiteSpace(request.Email))
            {
                return BadRequest(new { Message = "Email is required" });
            }
            var result = await _forgotPasswordService.UpdatePasswordAsync(request.Email, request.NewPassword);

            if (result == "Password updated successfully")
            {
                return Ok(new { Message = result });
            }
            return BadRequest(new { Message = result });
        }
    }
}
