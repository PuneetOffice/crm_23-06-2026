using Elpis_CRM.Data;
using Elpis_CRM.Model;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using Microsoft.AspNetCore.Authentication.JwtBearer;

namespace Elpis_CRM.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class LoginController : ControllerBase
    {
        private readonly AppDbContext _loginDb;
        private readonly IConfiguration _configuration;
        private readonly ILogger<LoginController> _logger;
        private readonly IWebHostEnvironment _environment;

        public LoginController(
            AppDbContext loginDb,
            IConfiguration configuration,
            ILogger<LoginController> logger,
            IWebHostEnvironment environment)
        {
            _loginDb = loginDb;
            _configuration = configuration;
            _logger = logger;
            _environment = environment;
        }

        /// <summary>
        /// Login endpoint - Validates user credentials and returns JWT token
        /// </summary>
        [HttpPost("check")]
        public async Task<IActionResult> LoginCheck([FromBody] LoginCheckModel login)
        {
            if (login == null)
            {
                return BadRequest(new { message = "Login data is required." });
            }

            if (string.IsNullOrWhiteSpace(login.EmailOrPhone) || string.IsNullOrWhiteSpace(login.Password))
            {
                return BadRequest(new { message = "Email/Phone and password are required." });
            }

            try
            {
                var emailOrPhone = login.EmailOrPhone.Trim();
                var password = login.Password.Trim();

                var user = await _loginDb.Login
                    .FirstOrDefaultAsync(u =>
                        (u.Email == emailOrPhone || u.Phone == emailOrPhone) &&
                        u.IsActive);

                if (user == null)
                {
                    return NotFound(new { message = "User not found." });
                }

                if (!string.Equals(user.Password, password, StringComparison.Ordinal))
                {
                    return BadRequest(new { message = "Incorrect password." });
                }

                var jwtKey = _configuration["Jwt:Key"];
                if (string.IsNullOrWhiteSpace(jwtKey))
                {
                    _logger.LogError("JWT key is missing from configuration.");
                    return StatusCode(500, new { message = "JWT configuration is missing." });
                }

                var roleValue = (user.Role ?? "").Trim();

                var claims = new List<Claim>
                {
                    new Claim(ClaimTypes.Email, user.Email ?? ""),
                    new Claim(ClaimTypes.Name, user.Name ?? ""),
                    new Claim(ClaimTypes.NameIdentifier, user.LoginId.ToString()),
                    new Claim(ClaimTypes.Role, roleValue),
                    new Claim("role", roleValue.ToLowerInvariant())
                };

                var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtKey));

                var token = new JwtSecurityToken(
                    expires: DateTime.UtcNow.AddHours(2),
                    claims: claims,
                    signingCredentials: new SigningCredentials(key, SecurityAlgorithms.HmacSha256)
                );

                return Ok(new
                {
                    token = new JwtSecurityTokenHandler().WriteToken(token),
                    role = roleValue,
                    name = user.Name,
                    email = user.Email,
                    loginId = user.LoginId
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Login check failed for {EmailOrPhone}", login.EmailOrPhone);
                return StatusCode(500, new
                {
                    message = "Server error during login check.",
                    detail = _environment.IsDevelopment()
                        ? ex.InnerException?.Message ?? ex.Message
                        : null
                });
            }
        }

        /// <summary>
        /// Get all users (names and emails) for dropdown/autocomplete
        /// </summary>
        [Authorize(AuthenticationSchemes = JwtBearerDefaults.AuthenticationScheme)]
        [HttpGet("all-users")]
        public async Task<IActionResult> GetAllUsers()
        {
            var users = await _loginDb.Login
                .Where(u => u.IsActive && !string.IsNullOrEmpty(u.Name))
                .Select(u => new { name = u.Name, email = u.Email, loginId = u.LoginId })
                .Distinct()
                .ToListAsync();

            return Ok(users);
        }

        /// <summary>
        /// Create new user account (Admin only)
        /// </summary>
        [Authorize(AuthenticationSchemes = JwtBearerDefaults.AuthenticationScheme, Roles = "Admin")]
        [HttpPost("create")]
        public async Task<IActionResult> Create([FromBody] LoginModel login)
        {
            bool exists = await _loginDb.Login.AnyAsync(u => u.Email == login.Email);
            if (exists)
            {
                return Conflict("Email is already registered.");
            }

            login.CreatedAt = DateTime.UtcNow;
            login.UpdatedAt = DateTime.UtcNow;
            login.IsActive = true;

            _loginDb.Login.Add(login);
            await _loginDb.SaveChangesAsync();

            return Ok(new
            {
                message = "Account created successfully.",
                loginId = login.LoginId
            });
        }

        /// <summary>
        /// Get current logged-in user details from database
        /// </summary>
        [Authorize(AuthenticationSchemes = JwtBearerDefaults.AuthenticationScheme)]
        [HttpGet("me")]
        public async Task<IActionResult> GetLoggedInUser()
        {
            var loginIdStr = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if (!int.TryParse(loginIdStr, out var loginId))
                return Unauthorized(new { message = "User ID not found in token." });

            var user = await _loginDb.Login
                .Where(u => u.LoginId == loginId)
                .Select(u => new
                {
                    u.LoginId,
                    u.Name,
                    u.Email,
                    u.Phone,
                    u.Role,
                    u.IsActive,
                    u.CreatedAt,
                    u.UpdatedAt
                })
                .FirstOrDefaultAsync();

            if (user == null)
                return NotFound(new { message = "User not found." });

            return Ok(user);
        }

        /// <summary>
        /// Update current logged-in user's own profile (name, email, phone)
        /// </summary>
        [Authorize(AuthenticationSchemes = JwtBearerDefaults.AuthenticationScheme)]
        [HttpPut("me")]
        public async Task<IActionResult> UpdateProfile([FromBody] UpdateProfileModel model)
        {
            var loginIdStr = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if (!int.TryParse(loginIdStr, out var loginId))
            {
                return Unauthorized(new { message = "User ID not found in token." });
            }
            var user = await _loginDb.Login.FindAsync(loginId);
            if (user == null)
            {
                return NotFound(new { message = "User not found." });
            }
            if (!string.IsNullOrWhiteSpace(model.Email) && model.Email != user.Email)
            {
                var emailTaken = await _loginDb.Login.AnyAsync(u => u.Email == model.Email && u.LoginId != loginId);
                if (emailTaken)
                {
                    return Conflict(new { message = "Email is already in use by another account." });
                }
            }

            if (!string.IsNullOrWhiteSpace(model.Name)) user.Name = model.Name.Trim();
            if (!string.IsNullOrWhiteSpace(model.Email)) user.Email = model.Email.Trim();
            if (model.Phone != null) user.Phone = model.Phone.Trim();
            user.UpdatedAt = DateTime.UtcNow;

            await _loginDb.SaveChangesAsync();

            return Ok(new
            {
                message = "Profile updated successfully.",
                user = new
                {
                    user.LoginId,
                    user.Name,
                    user.Email,
                    user.Phone,
                    user.Role,
                    user.IsActive,
                    user.CreatedAt,
                    user.UpdatedAt
                }
            });
        }

        /// <summary>
        /// Get all user accounts 
        /// </summary>
        [Authorize(AuthenticationSchemes = JwtBearerDefaults.AuthenticationScheme, Roles = "Admin")]
        [HttpGet("all")]
        public async Task<IActionResult> GetAllAccounts()
        {
            var users = await _loginDb.Login
                .Select(u => new
                {
                    u.LoginId,
                    u.Name,
                    u.Email,
                    u.Phone,
                    u.Role,
                    u.IsActive,
                    u.CreatedAt,
                    u.UpdatedAt
                })
                .ToListAsync();

            return Ok(users);
        }

        /// <summary>
        /// Get user by Id
        /// </summary>
        [Authorize(AuthenticationSchemes = JwtBearerDefaults.AuthenticationScheme, Roles = "Admin")]
        [HttpGet("{id:int}")]
        public async Task<IActionResult> GetById(int id)
        {
            var user = await _loginDb.Login
                .Where(u => u.LoginId == id)
                .Select(u => new
                {
                    u.LoginId,
                    u.Name,
                    u.Email,
                    u.Phone,
                    u.Role,
                    u.IsActive,
                    u.CreatedAt,
                    u.UpdatedAt
                })
                .FirstOrDefaultAsync();

            if (user == null)
            {
                return NotFound($"User with ID {id} not found.");
            }

            return Ok(user);
        }

        /// <summary>
        /// Update user account
        /// </summary>
        [Authorize(AuthenticationSchemes = JwtBearerDefaults.AuthenticationScheme, Roles = "Admin")]
        [HttpPut("{id:int}")]
        public async Task<IActionResult> Update(int id, [FromBody] LoginModel loginModel)
        {
            var existing = await _loginDb.Login.FindAsync(id);

            if (existing == null)
            {
                return NotFound($"User with ID {id} not found.");
            }

            existing.Name = loginModel.Name;
            existing.Email = loginModel.Email;
            existing.Phone = loginModel.Phone;
            existing.Role = loginModel.Role;
            existing.IsActive = loginModel.IsActive;
            existing.UpdatedAt = DateTime.UtcNow;

            // Only update password if provided
            //if (!string.IsNullOrEmpty(loginModel.Password))
            //{
            //    existing.Password = loginModel.Password;
            //}

            await _loginDb.SaveChangesAsync();

            return Ok(new
            {
                message = "User updated successfully.",
                user = new
                {
                    existing.LoginId,
                    existing.Name,
                    existing.Email,
                    existing.Phone,
                    existing.Role,
                    existing.IsActive
                }
            });
        }

        /// <summary>
        /// Delete user account 
        /// </summary>
        [Authorize(AuthenticationSchemes = JwtBearerDefaults.AuthenticationScheme, Roles = "Admin")]
        [HttpDelete("{id:int}")]
        public async Task<IActionResult> Delete(int id)
        {
            var user = await _loginDb.Login.FindAsync(id);

            if (user == null)
            {
                return NotFound($"User with ID {id} not found.");
            }

            _loginDb.Login.Remove(user);
            await _loginDb.SaveChangesAsync();

            return Ok(new { message = "User deleted successfully." });
        }

        /// <summary>
        /// Deactivate user account -Soft delete
        /// </summary>
        [Authorize(AuthenticationSchemes = JwtBearerDefaults.AuthenticationScheme, Roles = "Admin")]
        [HttpPut("{id:int}/deactivate")]
        public async Task<IActionResult> Deactivate(int id)
        {
            var user = await _loginDb.Login.FindAsync(id);

            if (user == null)
            {
                return NotFound($"User with ID {id} not found.");
            }

            user.IsActive = false;
            user.UpdatedAt = DateTime.UtcNow;
            await _loginDb.SaveChangesAsync();

            return Ok(new { message = "User deactivated successfully." });
        }

        /// <summary>
        /// Activate user account 
        /// </summary>
        [Authorize(AuthenticationSchemes = JwtBearerDefaults.AuthenticationScheme, Roles = "Admin")]
        [HttpPut("{id:int}/activate")]
        public async Task<IActionResult> Activate(int id)
        {
            var user = await _loginDb.Login.FindAsync(id);

            if (user == null)
            {
                return NotFound($"User with ID {id} not found.");
            }

            user.IsActive = true;
            user.UpdatedAt = DateTime.UtcNow;
            await _loginDb.SaveChangesAsync();

            return Ok(new { message = "User activated successfully." });
        }

        /// <summary>
        /// Change password for current user
        /// </summary>
        [Authorize(AuthenticationSchemes = JwtBearerDefaults.AuthenticationScheme)]
        [HttpPut("change-password")]
        public async Task<IActionResult> ChangePassword([FromBody] ChangePasswordModel model)
        {
            var email = User.FindFirst(ClaimTypes.Email)?.Value;

            if (string.IsNullOrEmpty(email))
            {
                return Unauthorized("User email not found in token.");
            }

            var user = await _loginDb.Login.FirstOrDefaultAsync(u => u.Email == email);

            if (user == null)
            {
                return NotFound("User not found.");
            }

            user.Password = model.NewPassword;
            user.UpdatedAt = DateTime.UtcNow;
            await _loginDb.SaveChangesAsync();

            return Ok(new { message = "Password changed successfully." });
        }
    }
}
