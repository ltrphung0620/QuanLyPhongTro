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
var builder = WebApplication.CreateBuilder(args);

builder.Services.AddControllers();
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();

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
                if (!string.IsNullOrEmpty(accessToken) && path.StartsWithSegments("/api/Realtime/stream"))
                {
                    context.Token = accessToken;
                }
                return Task.CompletedTask;
            }
        };
    });


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
builder.Services.AddScoped<IMeterReadingService, MeterReadingService>();
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
builder.Services.AddHttpContextAccessor();
builder.Services.AddScoped<ICurrentUserService, CurrentUserService>();
builder.Services.AddSingleton<AssistantCommandStore>();
builder.Services.AddSingleton<AssistantConversationStore>();
builder.Services.AddSingleton<AssistantActionRegistry>();
builder.Services.AddSingleton<AssistantLearningStore>();
builder.Services.AddHttpClient<IAssistantCommandParser, AssistantCommandParser>();
builder.Services.AddScoped<IAssistantService, AssistantService>();


QuestPDF.Settings.License = LicenseType.Community;

var app = builder.Build();

app.UseSwagger();
app.UseSwaggerUI();

app.UseStaticFiles();
app.UseAuthentication();
app.UseAuthorization();
app.MapControllers();

app.Run();
