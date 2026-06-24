using Elpis_CRM.Data;
using Elpis_CRM.Services;
using Microsoft.EntityFrameworkCore;
using Microsoft.Graph;
using Microsoft.Identity.Web;
using Microsoft.Identity.Web.UI;
using Microsoft.AspNetCore.Authentication.OpenIdConnect;
using Microsoft.OpenApi.Models;
using Elpis_CRM.Service;
using Microsoft.AspNetCore.Http;
using System.Collections.Generic;
using System.Linq;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.IdentityModel.Tokens;
using System.Text;
using System.Security.Claims;
using global::Azure;
using global::Azure.AI.FormRecognizer.DocumentAnalysis;



var builder = WebApplication.CreateBuilder(args);

// Configure Kestrel for longer-running operations like large data imports
builder.WebHost.ConfigureKestrel(serverOptions =>
{
    serverOptions.Limits.RequestHeadersTimeout = TimeSpan.FromSeconds(1800);  // 30 minutes
    serverOptions.Limits.KeepAliveTimeout = TimeSpan.FromSeconds(1800);  // 30 minutes
});

builder.Services.AddCors(options =>
{
    options.AddPolicy("ReactPolicy", policy =>
    {
        var allowedOrigins = new List<string>
        {
            "https://elpiscrm.vercel.app",
            "https://crm.elpisitsolutions.com",
            "https://elpisitsolutions.com",
            "https://www.elpisitsolutions.com"
        };
            
        // Allow local frontend during development
        if (builder.Environment.IsDevelopment())
        {
            allowedOrigins.Add("http://localhost:3000");
            allowedOrigins.Add("http://127.0.0.1:3000");
            allowedOrigins.Add("https://www.elpisitsolutions.com");
            allowedOrigins.Add("https://elpisitsolutions.com");

        }

        // Allow additional origins provided via configuration (comma-separated flat key)
        var configured = builder.Configuration["AllowedOrigins"];
        if (!string.IsNullOrWhiteSpace(configured))
        {
            var extra = configured.Split(',').Select(s => s.Trim()).Where(s => !string.IsNullOrEmpty(s));
            foreach (var o in extra)
            {
                if (!allowedOrigins.Contains(o)) allowedOrigins.Add(o);
            }
        }

        // Allow additional origins provided via the "Cors:AllowedOrigins" array in appsettings.json
        var configuredArray = builder.Configuration.GetSection("Cors:AllowedOrigins").Get<string[]>();
        if (configuredArray != null)
        {
            foreach (var o in configuredArray.Select(s => s?.Trim()).Where(s => !string.IsNullOrEmpty(s)))
            {
                if (!allowedOrigins.Contains(o)) allowedOrigins.Add(o);
            }
        }

        policy.WithOrigins(allowedOrigins.ToArray())
              .AllowAnyHeader()
              .AllowAnyMethod()
              .AllowCredentials();
    });
});

// Interactive Microsoft Login

var authBuilder = builder.Services.AddAuthentication(OpenIdConnectDefaults.AuthenticationScheme)
    .AddMicrosoftIdentityWebApp(builder.Configuration.GetSection("AzureAd"))
    .EnableTokenAcquisitionToCallDownstreamApi(new[]
    {
        "User.Read",
        "Mail.Read",
        "Mail.Send"
    })
    .AddMicrosoftGraph(builder.Configuration.GetSection("Graph"))
    .AddInMemoryTokenCaches();

// Now add JWT Bearer to the original authentication builder
builder.Services.AddAuthentication()
    .AddJwtBearer(JwtBearerDefaults.AuthenticationScheme, options =>
    {
        options.RequireHttpsMetadata = false;
        options.SaveToken = true;
        options.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuer = false,
            ValidateAudience = false,
            ValidateIssuerSigningKey = true,
            IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(builder.Configuration["Jwt:Key"])),
            RoleClaimType = ClaimTypes.Role
        };
    });

builder.Services.AddRazorPages();
builder.Services.AddAuthorization();

// Controllers + Views + MS Identity UI (for sign-in/out pages)
builder.Services.AddControllers();
builder.Services.AddControllersWithViews()
       .AddSessionStateTempDataProvider()
       .AddMicrosoftIdentityUI();

builder.Services.AddDistributedMemoryCache();
builder.Services.AddSession(options =>
{
    options.IdleTimeout = TimeSpan.FromMinutes(100);
    options.Cookie.HttpOnly = true;
    options.Cookie.IsEssential = true;
});

// Swagger / OpenAPI OAuth2
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen(c =>
{
    c.AddSecurityDefinition("oauth2", new OpenApiSecurityScheme
    {
        Type = SecuritySchemeType.OAuth2,
        Flows = new OpenApiOAuthFlows
        {
            AuthorizationCode = new OpenApiOAuthFlow
            {
                AuthorizationUrl = new Uri($"{builder.Configuration["AzureAd:Instance"]}{builder.Configuration["AzureAd:TenantId"]}/oauth2/v2.0/authorize"),
                TokenUrl = new Uri($"{builder.Configuration["AzureAd:Instance"]}{builder.Configuration["AzureAd:TenantId"]}/oauth2/v2.0/token"),
                Scopes = new Dictionary<string, string>
                {
                    {"https://graph.microsoft.com/User.Read", "Read your profile"},
                    {"https://graph.microsoft.com/Mail.Read", "Read your mail"},
                    {"https://graph.microsoft.com/Mail.Send", "Send your mail"}
                }
            }
        }
    });
});

// Database
builder.Services.AddDbContext<AppDbContext>(options =>
    options.UseSqlServer(builder.Configuration.GetConnectionString("DefaultConnection")));

builder.Services.AddHttpContextAccessor();

// Services
builder.Services.AddScoped<ExportService>();
builder.Services.AddScoped<ForgotPasswordService>();
builder.Services.AddScoped<AccountService>();
builder.Services.AddScoped<ContactService>();
builder.Services.AddScoped<ProductService>();
builder.Services.AddScoped<DealsService>();
builder.Services.AddScoped<TemplateService>();
builder.Services.AddScoped<ImportService>();
builder.Services.AddScoped<CallLogService>();
builder.Services.AddScoped<TaskService>();
builder.Services.AddScoped<ForecastService>();
builder.Services.AddScoped<MeetingService>();
builder.Services.AddScoped<AppointmentsService>();
builder.Services.AddScoped<NotesService>();
builder.Services.AddScoped<ContactUsService>();

// Azure Document Intelligence
var azureSettings = builder.Configuration
    .GetSection("AzureDocumentIntelligence")
    .Get<AzureDocumentIntelligenceSettings>();

if (azureSettings is not null && !string.IsNullOrWhiteSpace(azureSettings.Endpoint) && !string.IsNullOrWhiteSpace(azureSettings.Key))
{
    builder.Services.AddSingleton(_ =>
        new DocumentAnalysisClient(
            new Uri(azureSettings.Endpoint),
            new AzureKeyCredential(azureSettings.Key)));
    builder.Services.AddScoped<AzureBusinessCardService>();
}

builder.Services.Configure<FileUploadSettings>(
    builder.Configuration.GetSection(FileUploadSettings.SectionName));
// Add these lines in your Program.cs

// Register services

System.Text.Encoding.RegisterProvider(System.Text.CodePagesEncodingProvider.Instance);



builder.Services.Configure<Microsoft.AspNetCore.Http.Features.FormOptions>(options =>
{
    options.MultipartBodyLengthLimit = 100 * 1024 * 1024;
});


var app = builder.Build();

app.UseSwagger();
app.UseSwaggerUI(c =>
{
    c.SwaggerEndpoint("/swagger/v1/swagger.json", "Elpis CRM API v1");
    c.OAuthClientId(builder.Configuration["AzureAd:ClientId"]);
    c.OAuthUsePkce();
    c.ConfigObject.AdditionalItems["withCredentials"] = true;
});

// Log the effective connection string (masked) and environment to help debug which DB is used
try
{
    var logger = app.Services.GetRequiredService<ILogger<Program>>();
    var conn = builder.Configuration.GetConnectionString("DefaultConnection") ?? "<missing>";
    string MaskConn(string s)
    {
        if (string.IsNullOrEmpty(s)) return s;
        try
        {
            var parts = s.Split(';').Select(p =>
            {
                if (p.TrimStart().StartsWith("Password=", StringComparison.OrdinalIgnoreCase) || p.TrimStart().StartsWith("Pwd=", StringComparison.OrdinalIgnoreCase))
                    return p.Split('=')[0] + "=****";
                return p;
            });
            return string.Join(";", parts);
        }
        catch
        {
            return "<masked>";
        }
    }

    logger.LogInformation("Startup environment: {env}; Using DB connection: {conn}", app.Environment.EnvironmentName, MaskConn(conn));
}
catch { }

app.UseRouting();

// CORS must be before authentication to handle preflight requests
app.UseCors("ReactPolicy");

app.UseAuthentication();
app.UseSession();
app.UseAuthorization();

// Health check endpoint — use to verify backend is alive
app.MapGet("/health", () => Results.Ok(new { status = "healthy", time = DateTime.UtcNow }));
app.MapGet("/api/health", () => Results.Ok(new { status = "healthy", time = DateTime.UtcNow }));

app.MapControllers();
app.MapRazorPages();

app.Run();
