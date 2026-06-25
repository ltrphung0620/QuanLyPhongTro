using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.IdentityModel.Tokens;
using System.Text;
using Microsoft.EntityFrameworkCore;
using QuestPDF.Infrastructure;
using NhaTro.Data;
using NhaTro.Interfaces.Repositories;
using NhaTro.Interfaces.Services;
using NhaTro.Repositories;
using NhaTro.Services;
using NhaTro.Hubs;
var builder = WebApplication.CreateBuilder(args);
builder.Configuration.AddJsonFile("secrets.json", optional: true, reloadOnChange: true);

builder.Services.AddControllers();
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();
var allowedCorsOrigins = builder.Configuration
    .GetSection("Cors:AllowedOrigins")
    .Get<string[]>()
    ?? new[]
    {
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:5174",
        "http://127.0.0.1:5174",
        "http://171.244.37.116:18088"
    };

builder.Services.AddCors(options =>
{
    options.AddPolicy("FrontendCors", policy =>
    {
        policy
            .WithOrigins(allowedCorsOrigins)
            .AllowAnyHeader()
            .AllowAnyMethod()
            .AllowCredentials();
    });
});

var keyStr = builder.Configuration["Jwt:Key"] ?? "fallback_secret_key_for_dev_only_123!@#";
builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options =>
    {
        options.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuer = true,
            ValidateAudience = true,
            ValidateLifetime = true,
            ValidateIssuerSigningKey = true,
            ValidIssuer = builder.Configuration["Jwt:Issuer"],
            ValidAudience = builder.Configuration["Jwt:Audience"],
            IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(keyStr)),
            ClockSkew = TimeSpan.Zero
        };
        options.Events = new JwtBearerEvents
        {
            OnMessageReceived = context =>
            {
                var accessToken = context.Request.Query["access_token"];
                var path = context.Request.Path;
                if (!string.IsNullOrEmpty(accessToken) &&
                    (path.StartsWithSegments("/api/Realtime/stream") || path.StartsWithSegments("/hubs/realtime")))
                {
                    context.Token = accessToken;
                }
                return Task.CompletedTask;
            }
        };
    });

builder.Services.AddAuthorization(options =>
{
    options.AddPolicy("SuperAdminOnly", policy => policy.RequireRole("SuperAdmin"));
    options.AddPolicy("AdminOnly", policy => policy.RequireRole("Admin"));
    options.AddPolicy("TenantOnly", policy => policy.RequireRole("Tenant"));
    options.AddPolicy("AdminOrTenant", policy => policy.RequireRole("Admin", "Tenant"));
});


builder.Services.AddSignalR();
builder.Services.AddDbContext<NhaTroDbContext>(options =>
    options.UseSqlServer(builder.Configuration.GetConnectionString("DefaultConnection")));
builder.Services.AddScoped<IRoomRepository, RoomRepository>();
builder.Services.AddScoped<IRoomService, RoomService>();
builder.Services.AddScoped<ITenantRepository, TenantRepository>();
builder.Services.AddScoped<ITenantService, TenantService>();
builder.Services.AddScoped<IContractRepository, ContractRepository>();
builder.Services.AddScoped<ContractService>();
builder.Services.AddScoped<IContractService, SafeDeleteContractService>();
builder.Services.AddScoped<IMeterReadingRepository, MeterReadingRepository>();
builder.Services.AddHttpClient<IMeterReadingService, MeterReadingService>();
builder.Services.AddHttpClient<IGeminiMeterReadingOcrService, GeminiMeterReadingOcrService>();
builder.Services.AddScoped<IInvoiceRepository, InvoiceRepository>();
builder.Services.AddScoped<IInvoiceService, InvoiceService>();
builder.Services.AddHttpClient<IInvoicePdfService, InvoicePdfService>();
builder.Services.AddScoped<IPaymentTransactionRepository, PaymentTransactionRepository>();
builder.Services.AddScoped<IPaymentService, PaymentService>();
builder.Services.AddScoped<IDepositSettlementRepository, DepositSettlementRepository>();
builder.Services.AddScoped<ITransactionRepository, TransactionRepository>();
builder.Services.AddScoped<ITransactionService, TransactionService>();
builder.Services.AddScoped<IReportService, ReportService>();
builder.Services.AddSingleton<IRealtimeService, RealtimeService>();
builder.Services.AddScoped<IAuthService, AuthService>();
builder.Services.AddScoped<IEmailService, EmailService>();
builder.Services.AddScoped<ITenantRoomAccountService, TenantRoomAccountService>();
builder.Services.AddScoped<IPricingSettingsService, PricingSettingsService>();
builder.Services.AddScoped<ITenantDeviceTokenService, TenantDeviceTokenService>();
builder.Services.AddHttpClient<IExpoPushNotificationService, ExpoPushNotificationService>();
builder.Services.AddScoped<ITenantInvoiceNotificationService, TenantInvoiceNotificationService>();
builder.Services.AddHttpContextAccessor();
builder.Services.AddScoped<ICurrentUserService, CurrentUserService>();
builder.Services.AddSingleton<AssistantCommandStore>();
builder.Services.AddSingleton<AssistantConversationStore>();
builder.Services.AddSingleton<AssistantAgentStateStore>();
builder.Services.AddSingleton<AssistantActionRegistry>();
builder.Services.AddSingleton<AssistantToolRegistry>();
builder.Services.AddSingleton<AssistantLearningStore>();
builder.Services.AddSingleton<AssistantSemanticMemoryStore>();
builder.Services.AddSingleton<AssistantTrainingPhraseCatalog>();
builder.Services.AddSingleton<AssistantLocalIntentMatcher>();
builder.Services.AddSingleton<AssistantAuditStore>();
builder.Services.AddHttpClient<IAssistantCommandParser, AssistantCommandParser>();
builder.Services.AddHttpClient<AssistantAgentPlanner>();
builder.Services.AddScoped<IAssistantService, AssistantService>();


QuestPDF.Settings.License = LicenseType.Community;

var app = builder.Build();

app.UseSwagger();
app.UseSwaggerUI();

app.UseStaticFiles();
app.UseCors("FrontendCors");
app.UseAuthentication();
app.UseMiddleware<NhaTro.Middlewares.OrganizationContextMiddleware>();
app.UseMiddleware<NhaTro.Middlewares.TenantStatusMiddleware>();
app.UseAuthorization();
app.MapControllers();
app.MapHub<RealtimeHub>("/hubs/realtime");

app.Run();
