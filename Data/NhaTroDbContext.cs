using Microsoft.EntityFrameworkCore;
using NhaTro.Models;
using NhaTro.Interfaces.Services;

namespace NhaTro.Data
{
    public class NhaTroDbContext : DbContext
    {
        private readonly ICurrentUserService _currentUserService;

        public NhaTroDbContext(DbContextOptions<NhaTroDbContext> options, ICurrentUserService currentUserService) : base(options)
        {
            _currentUserService = currentUserService;
        }

        public DbSet<AppUser> Users { get; set; }
        public DbSet<Organization> Organizations { get; set; }
        public DbSet<Room> Rooms { get; set; }
        public DbSet<Tenant> Tenants { get; set; }
        public DbSet<Contract> Contracts { get; set; }
        public DbSet<MeterReading> MeterReadings { get; set; }
        public DbSet<Invoice> Invoices { get; set; }
        public DbSet<DepositSettlement> DepositSettlements { get; set; }
        public DbSet<Transaction> Transactions { get; set; }
        public DbSet<PaymentTransaction> PaymentTransactions { get; set; }
        public DbSet<EmailNotification> EmailNotifications { get; set; }
        public DbSet<SystemSetting> SystemSettings { get; set; }
        public DbSet<TenantDeviceToken> TenantDeviceTokens { get; set; }
        public DbSet<AdminOrganizationMembership> AdminOrganizationMemberships { get; set; }
        public DbSet<AdminOrganizationPagePermission> AdminOrganizationPagePermissions { get; set; }
        public DbSet<SupportConversation> SupportConversations { get; set; }
        public DbSet<SupportMessage> SupportMessages { get; set; }

        protected override void OnModelCreating(ModelBuilder modelBuilder)
        {
            // Organization configuration
            modelBuilder.Entity<Organization>(entity =>
            {
                entity.ToTable("organizations");
            });

            // AppUser configuration
            modelBuilder.Entity<AppUser>(entity =>
            {
                entity.ToTable("users");
                entity.HasIndex(u => u.Username).IsUnique();
                entity.HasIndex(u => u.Email).IsUnique();

                entity.Property(u => u.PagePermissions)
                    .HasColumnName("page_permissions")
                    .HasMaxLength(1000)
                    .HasDefaultValue("*");
                
                // Tenant user login account relationship (1-to-1)
                entity.HasOne(u => u.Tenant)
                    .WithOne()
                    .HasForeignKey<AppUser>(u => u.TenantId)
                    .OnDelete(DeleteBehavior.Restrict);

                entity.HasIndex(u => u.TenantId).IsUnique().HasFilter("[TenantId] IS NOT NULL");

                // Organization relationship
                entity.HasOne(u => u.Organization)
                    .WithMany()
                    .HasForeignKey(u => u.OrganizationId)
                    .OnDelete(DeleteBehavior.Restrict);
                
                // Query filter for AppUser: SuperAdmin sees all, others see their organization's users
                entity.HasQueryFilter(u => _currentUserService.Role == "SuperAdmin" || u.OrganizationId == _currentUserService.OrganizationId);
            });

            // Room configuration
            modelBuilder.Entity<Room>(entity =>
            {
                entity.ToTable("rooms");

                entity.HasKey(e => e.RoomId);

                entity.Property(e => e.RoomId)
                    .HasColumnName("room_id");

                entity.Property(e => e.RoomCode)
                    .HasColumnName("room_code")
                    .HasMaxLength(50)
                    .IsRequired();

                entity.Property(e => e.ListedPrice)
                    .HasColumnName("listed_price")
                    .HasPrecision(18, 2);

                entity.Property(e => e.Status)
                    .HasColumnName("status")
                    .HasMaxLength(20)
                    .IsRequired();

                entity.Property(e => e.CreatedAt)
                    .HasColumnName("created_at");

                entity.Property(e => e.UpdatedAt)
                    .HasColumnName("updated_at");

                entity.HasIndex(e => new { e.OrganizationId, e.RoomCode })
                    .IsUnique();

                // Relationships
                entity.HasOne(e => e.AppUser)
                    .WithMany(u => u.Rooms)
                    .HasForeignKey(e => e.AppUserId)
                    .OnDelete(DeleteBehavior.Restrict);

                entity.HasOne(e => e.Organization)
                    .WithMany()
                    .HasForeignKey(e => e.OrganizationId)
                    .OnDelete(DeleteBehavior.Restrict);

                entity.ToTable(t =>
                {
                    t.HasCheckConstraint("CK_rooms_status", "status IN ('vacant', 'occupied')");
                });

                entity.HasQueryFilter(e => _currentUserService.Role == "SuperAdmin" || e.OrganizationId == _currentUserService.OrganizationId);
            });

            ConfigureTenant(modelBuilder);
            ConfigureContract(modelBuilder);
            ConfigureMeterReading(modelBuilder);
            ConfigureInvoice(modelBuilder);
            ConfigureDepositSettlement(modelBuilder);
            ConfigureTransaction(modelBuilder);
            ConfigurePaymentTransaction(modelBuilder);
            ConfigureEmailNotification(modelBuilder);
            ConfigureSystemSetting(modelBuilder);
            ConfigureTenantDeviceToken(modelBuilder);
            ConfigureSupportChat(modelBuilder);
        }

        private static void ConfigureSupportChat(ModelBuilder modelBuilder)
        {
            modelBuilder.Entity<SupportConversation>(entity =>
            {
                entity.ToTable("support_conversations");
                entity.HasKey(x => x.SupportConversationId);
                entity.Property(x => x.SupportConversationId).HasColumnName("support_conversation_id");
                entity.Property(x => x.AdminUserId).HasColumnName("admin_user_id");
                entity.Property(x => x.CreatedAt).HasColumnName("created_at");
                entity.Property(x => x.UpdatedAt).HasColumnName("updated_at");
                entity.Property(x => x.LastMessageAt).HasColumnName("last_message_at");

                entity.HasOne(x => x.AdminUser)
                    .WithMany()
                    .HasForeignKey(x => x.AdminUserId)
                    .OnDelete(DeleteBehavior.Restrict);

                entity.HasIndex(x => x.AdminUserId).IsUnique();
                entity.HasIndex(x => x.LastMessageAt);
            });

            modelBuilder.Entity<SupportMessage>(entity =>
            {
                entity.ToTable("support_messages");
                entity.HasKey(x => x.SupportMessageId);
                entity.Property(x => x.SupportMessageId).HasColumnName("support_message_id");
                entity.Property(x => x.SupportConversationId).HasColumnName("support_conversation_id");
                entity.Property(x => x.SenderUserId).HasColumnName("sender_user_id");
                entity.Property(x => x.Content).HasColumnName("content").HasMaxLength(2000).IsRequired();
                entity.Property(x => x.ImagePath).HasColumnName("image_path").HasMaxLength(500);
                entity.Property(x => x.ImageData).HasColumnName("image_data").HasColumnType("nvarchar(max)");
                entity.Property(x => x.SentAt).HasColumnName("sent_at");
                entity.Property(x => x.ReadAt).HasColumnName("read_at");

                entity.HasOne(x => x.Conversation)
                    .WithMany(x => x.Messages)
                    .HasForeignKey(x => x.SupportConversationId)
                    .OnDelete(DeleteBehavior.Cascade);

                entity.HasOne(x => x.SenderUser)
                    .WithMany()
                    .HasForeignKey(x => x.SenderUserId)
                    .OnDelete(DeleteBehavior.Restrict);

                entity.HasIndex(x => new { x.SupportConversationId, x.SupportMessageId });
                entity.HasIndex(x => new { x.SupportConversationId, x.ReadAt });
            });
        }

        private void ConfigureTenant(ModelBuilder modelBuilder)
        {
            modelBuilder.Entity<Tenant>(entity =>
            {
                entity.ToTable("tenants");

                entity.HasKey(e => e.TenantId);

                entity.Property(e => e.TenantId)
                    .HasColumnName("tenant_id");

                entity.Property(e => e.FullName)
                    .HasColumnName("full_name")
                    .HasMaxLength(255)
                    .IsRequired();

                entity.Property(e => e.Phone)
                    .HasColumnName("phone")
                    .HasMaxLength(20);

                entity.Property(e => e.CCCD)
                    .HasColumnName("cccd")
                    .HasMaxLength(50);

                entity.Property(e => e.CreatedAt)
                    .HasColumnName("created_at");

                entity.Property(e => e.UpdatedAt)
                    .HasColumnName("updated_at");

                // Relationships
                entity.HasOne(e => e.AppUser)
                    .WithMany(u => u.Tenants)
                    .HasForeignKey(e => e.AppUserId)
                    .OnDelete(DeleteBehavior.Restrict);

                entity.HasOne(e => e.Organization)
                    .WithMany()
                    .HasForeignKey(e => e.OrganizationId)
                    .OnDelete(DeleteBehavior.Restrict);

                entity.HasQueryFilter(e => _currentUserService.Role == "SuperAdmin" || e.OrganizationId == _currentUserService.OrganizationId);
            });
        }

        private void ConfigureContract(ModelBuilder modelBuilder)
        {
            modelBuilder.Entity<Contract>(entity =>
            {
                entity.ToTable("contracts");

                entity.HasKey(e => e.ContractId);

                entity.Property(e => e.ContractId)
                    .HasColumnName("contract_id");

                entity.Property(e => e.RoomId)
                    .HasColumnName("room_id")
                    .IsRequired();

                entity.Property(e => e.TenantId)
                    .HasColumnName("tenant_id")
                    .IsRequired();

                entity.Property(e => e.StartDate)
                    .HasColumnName("start_date");

                entity.Property(e => e.ExpectedEndDate)
                    .HasColumnName("expected_end_date");

                entity.Property(e => e.ActualEndDate)
                    .HasColumnName("actual_end_date");

                entity.Property(e => e.DepositAmount)
                    .HasColumnName("deposit_amount")
                    .HasPrecision(18, 2);

                entity.Property(e => e.DepositPaidAmount)
                    .HasColumnName("deposit_paid_amount")
                    .HasPrecision(18, 2);

                entity.Property(e => e.OccupantCount)
                    .HasColumnName("occupant_count");

                entity.Property(e => e.CustomWaterFee)
                    .HasColumnName("custom_water_fee")
                    .HasPrecision(18, 2);

                entity.Property(e => e.ActualRoomPrice)
                    .HasColumnName("actual_room_price")
                    .HasPrecision(18, 2);

                entity.Property(e => e.TrashFee)
                    .HasColumnName("trash_fee")
                    .HasPrecision(18, 2);

                entity.Property(e => e.Status)
                    .HasColumnName("status")
                    .HasMaxLength(20)
                    .IsRequired();

                entity.Property(e => e.IsArchived)
                    .HasColumnName("is_archived");

                entity.Property(e => e.ArchivedAt)
                    .HasColumnName("archived_at");

                entity.Property(e => e.ArchiveReason)
                    .HasColumnName("archive_reason")
                    .HasMaxLength(500);

                entity.Property(e => e.CreatedAt)
                    .HasColumnName("created_at");

                entity.Property(e => e.UpdatedAt)
                    .HasColumnName("updated_at");

                // Relationships
                entity.HasOne(e => e.Room)
                    .WithMany(r => r.Contracts)
                    .HasForeignKey(e => e.RoomId)
                    .OnDelete(DeleteBehavior.Restrict);

                entity.HasOne(e => e.Tenant)
                    .WithMany(t => t.Contracts)
                    .HasForeignKey(e => e.TenantId)
                    .OnDelete(DeleteBehavior.Restrict);

                entity.HasOne(e => e.AppUser)
                    .WithMany(u => u.Contracts)
                    .HasForeignKey(e => e.AppUserId)
                    .OnDelete(DeleteBehavior.Restrict);

                entity.HasOne(e => e.Organization)
                    .WithMany()
                    .HasForeignKey(e => e.OrganizationId)
                    .OnDelete(DeleteBehavior.Restrict);

                entity.HasIndex(e => new { e.RoomId, e.Status })
                    .HasDatabaseName("IX_contracts_room_id_status")
                    .IsUnique()
                    .HasFilter("[status] = 'active' AND [is_archived] = 0");

                entity.ToTable(t =>
                {
                    t.HasCheckConstraint("CK_contracts_status", "status IN ('active', 'ended', 'cancelled')");
                    t.HasCheckConstraint("CK_contracts_deposit_amount", "deposit_amount >= 0");
                    t.HasCheckConstraint("CK_contracts_deposit_paid_amount", "deposit_paid_amount >= 0 AND deposit_paid_amount <= deposit_amount");
                    t.HasCheckConstraint("CK_contracts_expected_end_date", "expected_end_date IS NULL OR expected_end_date >= start_date");
                    t.HasCheckConstraint("CK_contracts_occupant_count", "occupant_count > 0");
                    t.HasCheckConstraint("CK_contracts_custom_water_fee", "custom_water_fee IS NULL OR custom_water_fee >= 0");
                    t.HasCheckConstraint("CK_contracts_actual_room_price", "actual_room_price > 0");
                    t.HasCheckConstraint("CK_contracts_trash_fee", "trash_fee >= 0");
                });

                entity.HasQueryFilter(e => _currentUserService.Role == "SuperAdmin" || e.OrganizationId == _currentUserService.OrganizationId);
            });
        }

        private void ConfigureMeterReading(ModelBuilder modelBuilder)
        {
            modelBuilder.Entity<MeterReading>(entity =>
            {
                entity.ToTable("meter_readings");

                entity.HasKey(e => e.MeterReadingId);

                entity.Property(e => e.MeterReadingId)
                    .HasColumnName("meter_reading_id");

                entity.Property(e => e.RoomId)
                    .HasColumnName("room_id")
                    .IsRequired();

                entity.Property(e => e.ContractId)
                    .HasColumnName("contract_id");

                entity.Property(e => e.ContractSnapshotJson)
                    .HasColumnName("contract_snapshot_json");

                entity.Property(e => e.BillingMonth)
                    .HasColumnName("billing_month");

                entity.Property(e => e.PreviousReading)
                    .HasColumnName("previous_reading");

                entity.Property(e => e.CurrentReading)
                    .HasColumnName("current_reading");

                entity.Property(e => e.ConsumedUnits)
                    .HasColumnName("consumed_units");

                entity.Property(e => e.UnitPrice)
                    .HasColumnName("unit_price")
                    .HasPrecision(18, 2);

                entity.Property(e => e.Amount)
                    .HasColumnName("amount")
                    .HasPrecision(18, 2);

                entity.Property(e => e.CreatedAt)
                    .HasColumnName("created_at");

                entity.Property(e => e.MeterImagePath)
                    .HasColumnName("meter_image_path")
                    .HasMaxLength(500);

                // Relationships
                entity.HasOne(e => e.Room)
                    .WithMany(r => r.MeterReadings)
                    .HasForeignKey(e => e.RoomId)
                    .OnDelete(DeleteBehavior.Restrict);

                entity.HasOne(e => e.Contract)
                    .WithMany(c => c.MeterReadings)
                    .HasForeignKey(e => e.ContractId)
                    .OnDelete(DeleteBehavior.SetNull);

                entity.HasOne(e => e.AppUser)
                    .WithMany(u => u.MeterReadings)
                    .HasForeignKey(e => e.AppUserId)
                    .OnDelete(DeleteBehavior.Restrict);

                entity.HasOne(e => e.Organization)
                    .WithMany()
                    .HasForeignKey(e => e.OrganizationId)
                    .OnDelete(DeleteBehavior.Restrict);

                entity.HasIndex(e => new { e.RoomId, e.BillingMonth })
                    .IsUnique();

                entity.ToTable(t =>
                {
                    t.HasCheckConstraint("CK_meter_readings_current_vs_previous", "current_reading >= previous_reading");
                    t.HasCheckConstraint("CK_meter_readings_consumed_units", "consumed_units >= 0");
                });

                entity.HasQueryFilter(e => _currentUserService.Role == "SuperAdmin" || e.OrganizationId == _currentUserService.OrganizationId);
            });
        }

        private void ConfigureInvoice(ModelBuilder modelBuilder)
        {
            modelBuilder.Entity<Invoice>(entity =>
            {
                entity.ToTable("invoices");

                entity.HasKey(e => e.InvoiceId);

                entity.Property(e => e.InvoiceId)
                    .HasColumnName("invoice_id");

                entity.Property(e => e.RoomId)
                    .HasColumnName("room_id")
                    .IsRequired();

                entity.Property(e => e.ContractId)
                    .HasColumnName("contract_id");

                entity.Property(e => e.InvoiceType)
                    .HasColumnName("invoice_type")
                    .HasMaxLength(20)
                    .IsRequired();

                entity.Property(e => e.BillingMonth)
                    .HasColumnName("billing_month");

                entity.Property(e => e.FromDate)
                    .HasColumnName("from_date");

                entity.Property(e => e.ToDate)
                    .HasColumnName("to_date");

                entity.Property(e => e.RoomFee)
                    .HasColumnName("room_fee")
                    .HasPrecision(18, 2);

                entity.Property(e => e.ElectricityFee)
                    .HasColumnName("electricity_fee")
                    .HasPrecision(18, 2);

                entity.Property(e => e.WaterFee)
                    .HasColumnName("water_fee")
                    .HasPrecision(18, 2);

                entity.Property(e => e.TrashFee)
                    .HasColumnName("trash_fee")
                    .HasPrecision(18, 2);

                entity.Property(e => e.ExtraFee)
                    .HasColumnName("extra_fee")
                    .HasPrecision(18, 2);

                entity.Property(e => e.DiscountAmount)
                    .HasColumnName("discount_amount")
                    .HasPrecision(18, 2);

                entity.Property(e => e.DebtAmount)
                    .HasColumnName("debt_amount")
                    .HasPrecision(18, 2);

                entity.Property(e => e.DepositDebtAmount)
                    .HasColumnName("deposit_debt_amount")
                    .HasPrecision(18, 2);

                entity.Property(e => e.TotalAmount)
                    .HasColumnName("total_amount")
                    .HasPrecision(18, 2);

                entity.Property(e => e.Status)
                    .HasColumnName("status")
                    .HasMaxLength(20)
                    .IsRequired();

                entity.Property(e => e.PaymentCode)
                    .HasColumnName("payment_code")
                    .HasMaxLength(100);

                entity.Property(e => e.PaidAt)
                    .HasColumnName("paid_at");

                entity.Property(e => e.PaidAmount)
                    .HasColumnName("paid_amount")
                    .HasPrecision(18, 2);

                entity.Property(e => e.PaymentMethod)
                    .HasColumnName("payment_method")
                    .HasMaxLength(50);

                entity.Property(e => e.PaymentReference)
                    .HasColumnName("payment_reference")
                    .HasMaxLength(100);

                entity.Property(e => e.ReplacedByInvoiceId)
                    .HasColumnName("replaced_by_invoice_id");

                entity.Property(e => e.ExtraFeeNote)
                    .HasColumnName("extra_fee_note");

                entity.Property(e => e.Note)
                    .HasColumnName("note");

                entity.Property(e => e.ContractSnapshotJson)
                    .HasColumnName("contract_snapshot_json");

                entity.Property(e => e.CreatedAt)
                    .HasColumnName("created_at");

                entity.Property(e => e.UpdatedAt)
                    .HasColumnName("updated_at");

                // Relationships
                entity.HasOne(e => e.Room)
                    .WithMany(r => r.Invoices)
                    .HasForeignKey(e => e.RoomId)
                    .OnDelete(DeleteBehavior.Restrict);

                entity.HasOne(e => e.Contract)
                    .WithMany(c => c.Invoices)
                    .HasForeignKey(e => e.ContractId)
                    .OnDelete(DeleteBehavior.SetNull);

                entity.HasOne(e => e.ReplacedByInvoice)
                    .WithMany(i => i.ReplacingInvoices)
                    .HasForeignKey(e => e.ReplacedByInvoiceId)
                    .OnDelete(DeleteBehavior.Restrict);

                entity.HasOne(e => e.AppUser)
                    .WithMany(u => u.Invoices)
                    .HasForeignKey(e => e.AppUserId)
                    .OnDelete(DeleteBehavior.Restrict);

                entity.HasOne(e => e.Organization)
                    .WithMany()
                    .HasForeignKey(e => e.OrganizationId)
                    .OnDelete(DeleteBehavior.Restrict);

                entity.HasIndex(e => e.PaymentCode)
                    .IsUnique();

                entity.HasIndex(e => new { e.RoomId, e.BillingMonth, e.InvoiceType })
                    .HasDatabaseName("IX_invoices_room_month_type")
                    .IsUnique()
                    .HasFilter("[replaced_by_invoice_id] IS NULL");

                entity.ToTable(t =>
                {
                    t.HasCheckConstraint("CK_invoices_invoice_type", "invoice_type IN ('monthly', 'final')");
                    t.HasCheckConstraint("CK_invoices_status", "status IN ('unpaid', 'paid')");
                });

                entity.HasQueryFilter(e => _currentUserService.Role == "SuperAdmin" || e.OrganizationId == _currentUserService.OrganizationId);
            });
        }

        private void ConfigureDepositSettlement(ModelBuilder modelBuilder)
        {
            modelBuilder.Entity<DepositSettlement>(entity =>
            {
                entity.ToTable("deposit_settlements");

                entity.HasKey(e => e.DepositSettlementId);

                entity.Property(e => e.DepositSettlementId)
                    .HasColumnName("deposit_settlement_id");

                entity.Property(e => e.ContractId)
                    .HasColumnName("contract_id");

                entity.Property(e => e.DepositAmount)
                    .HasColumnName("deposit_amount")
                    .HasPrecision(18, 2);

                entity.Property(e => e.FinalInvoiceAmount)
                    .HasColumnName("final_invoice_amount")
                    .HasPrecision(18, 2);

                entity.Property(e => e.DeductedAmount)
                    .HasColumnName("deducted_amount")
                    .HasPrecision(18, 2);

                entity.Property(e => e.RefundedAmount)
                    .HasColumnName("refunded_amount")
                    .HasPrecision(18, 2);

                entity.Property(e => e.SettledAt)
                    .HasColumnName("settled_at");

                entity.Property(e => e.Note)
                    .HasColumnName("note");

                entity.Property(e => e.ContractSnapshotJson)
                    .HasColumnName("contract_snapshot_json");

                // Relationships
                entity.HasOne(e => e.Contract)
                    .WithOne(c => c.DepositSettlement)
                    .HasForeignKey<DepositSettlement>(e => e.ContractId)
                    .OnDelete(DeleteBehavior.SetNull);

                entity.HasOne(e => e.AppUser)
                    .WithMany(u => u.DepositSettlements)
                    .HasForeignKey(e => e.AppUserId)
                    .OnDelete(DeleteBehavior.Restrict);

                entity.HasOne(e => e.Organization)
                    .WithMany()
                    .HasForeignKey(e => e.OrganizationId)
                    .OnDelete(DeleteBehavior.Restrict);

                entity.HasIndex(e => e.ContractId)
                    .IsUnique()
                    .HasFilter("[contract_id] IS NOT NULL");

                entity.ToTable(t =>
                {
                    t.HasCheckConstraint("CK_deposit_settlements_deducted_amount", "deducted_amount >= 0");
                    t.HasCheckConstraint("CK_deposit_settlements_refunded_amount", "refunded_amount >= 0");
                });

                entity.HasQueryFilter(e => _currentUserService.Role == "SuperAdmin" || e.OrganizationId == _currentUserService.OrganizationId);
            });
        }

        private void ConfigureTransaction(ModelBuilder modelBuilder)
        {
            modelBuilder.Entity<Transaction>(entity =>
            {
                entity.ToTable("transactions");

                entity.HasKey(e => e.TransactionId);

                entity.Property(e => e.TransactionId)
                    .HasColumnName("transaction_id");

                entity.Property(e => e.TransactionDirection)
                    .HasColumnName("transaction_direction")
                    .HasMaxLength(20)
                    .IsRequired();

                entity.Property(e => e.Category)
                    .HasColumnName("category")
                    .HasMaxLength(20)
                    .IsRequired();

                entity.Property(e => e.ItemName)
                    .HasColumnName("item_name")
                    .HasMaxLength(255);

                entity.Property(e => e.Amount)
                    .HasColumnName("amount")
                    .HasPrecision(18, 2);

                entity.Property(e => e.TransactionDate)
                    .HasColumnName("transaction_date");

                entity.Property(e => e.Description)
                    .HasColumnName("description");

                entity.Property(e => e.RelatedRoomId)
                    .HasColumnName("related_room_id");

                entity.Property(e => e.RelatedInvoiceId)
                    .HasColumnName("related_invoice_id");

                entity.Property(e => e.CreatedAt)
                    .HasColumnName("created_at");

                // Relationships
                entity.HasOne(e => e.RelatedRoom)
                    .WithMany(r => r.Transactions)
                    .HasForeignKey(e => e.RelatedRoomId)
                    .OnDelete(DeleteBehavior.SetNull);

                entity.HasOne(e => e.RelatedInvoice)
                    .WithMany(i => i.Transactions)
                    .HasForeignKey(e => e.RelatedInvoiceId)
                    .OnDelete(DeleteBehavior.SetNull);

                entity.HasOne(e => e.AppUser)
                    .WithMany(u => u.Transactions)
                    .HasForeignKey(e => e.AppUserId)
                    .OnDelete(DeleteBehavior.Restrict);

                entity.HasOne(e => e.Organization)
                    .WithMany()
                    .HasForeignKey(e => e.OrganizationId)
                    .OnDelete(DeleteBehavior.Restrict);

                entity.ToTable(t =>
                {
                    t.HasCheckConstraint("CK_transactions_direction", "transaction_direction IN ('income', 'expense')");
                    t.HasCheckConstraint("CK_transactions_category", "category IN ('operating', 'other')");
                    t.HasCheckConstraint("CK_transactions_amount", "amount > 0");
                });

                entity.HasQueryFilter(e => _currentUserService.Role == "SuperAdmin" || e.OrganizationId == _currentUserService.OrganizationId);
            });
        }

        private void ConfigurePaymentTransaction(ModelBuilder modelBuilder)
        {
            modelBuilder.Entity<PaymentTransaction>(entity =>
            {
                entity.ToTable("payment_transactions");

                entity.HasKey(e => e.PaymentTransactionId);

                entity.Property(e => e.PaymentTransactionId)
                    .HasColumnName("payment_transaction_id");

                entity.Property(e => e.Provider)
                    .HasColumnName("provider")
                    .HasMaxLength(50)
                    .IsRequired();

                entity.Property(e => e.ProviderTransactionId)
                    .HasColumnName("provider_transaction_id")
                    .HasMaxLength(100)
                    .IsRequired();

                entity.Property(e => e.ReferenceCode)
                    .HasColumnName("reference_code")
                    .HasMaxLength(100);

                entity.Property(e => e.PaymentCode)
                    .HasColumnName("payment_code")
                    .HasMaxLength(100);

                entity.Property(e => e.AccountNumber)
                    .HasColumnName("account_number")
                    .HasMaxLength(50);

                entity.Property(e => e.TransferType)
                    .HasColumnName("transfer_type")
                    .HasMaxLength(20);

                entity.Property(e => e.TransferAmount)
                    .HasColumnName("transfer_amount")
                    .HasPrecision(18, 2);

                entity.Property(e => e.TransactionDate)
                    .HasColumnName("transaction_date");

                entity.Property(e => e.Content)
                    .HasColumnName("content");

                entity.Property(e => e.RawPayloadJson)
                    .HasColumnName("raw_payload_json");

                entity.Property(e => e.MatchedInvoiceId)
                    .HasColumnName("matched_invoice_id");

                entity.Property(e => e.ProcessStatus)
                    .HasColumnName("process_status")
                    .HasMaxLength(20);

                entity.Property(e => e.ProcessedAt)
                    .HasColumnName("processed_at");

                entity.Property(e => e.CreatedAt)
                    .HasColumnName("created_at");

                // Relationships
                entity.HasOne(e => e.MatchedInvoice)
                    .WithMany(i => i.PaymentTransactions)
                    .HasForeignKey(e => e.MatchedInvoiceId)
                    .OnDelete(DeleteBehavior.SetNull);

                entity.HasOne(e => e.AppUser)
                    .WithMany(u => u.PaymentTransactions)
                    .HasForeignKey(e => e.AppUserId)
                    .OnDelete(DeleteBehavior.Restrict);

                entity.HasOne(e => e.Organization)
                    .WithMany()
                    .HasForeignKey(e => e.OrganizationId)
                    .OnDelete(DeleteBehavior.Restrict);

                entity.HasIndex(e => e.ProviderTransactionId)
                    .IsUnique();

                entity.ToTable(t =>
                {
                    t.HasCheckConstraint("CK_payment_transactions_process_status", "process_status IN ('received', 'matched', 'paid', 'ignored', 'failed')");
                });

                entity.HasQueryFilter(e => _currentUserService.Role == "SuperAdmin" || e.OrganizationId == _currentUserService.OrganizationId);
            });
        }

        private void ConfigureEmailNotification(ModelBuilder modelBuilder)
        {
            modelBuilder.Entity<EmailNotification>(entity =>
            {
                entity.ToTable("email_notifications");

                entity.HasKey(e => e.EmailNotificationId);

                entity.Property(e => e.EmailNotificationId)
                    .HasColumnName("email_notification_id");

                entity.Property(e => e.NotificationType)
                    .HasColumnName("notification_type")
                    .HasMaxLength(50);

                entity.Property(e => e.TargetEmail)
                    .HasColumnName("target_email")
                    .HasMaxLength(255);

                entity.Property(e => e.Subject)
                    .HasColumnName("subject")
                    .HasMaxLength(255);

                entity.Property(e => e.PayloadJson)
                    .HasColumnName("payload_json");

                entity.Property(e => e.Status)
                    .HasColumnName("status")
                    .HasMaxLength(20);

                entity.Property(e => e.SentAt)
                    .HasColumnName("sent_at");

                entity.Property(e => e.CreatedAt)
                    .HasColumnName("created_at");

                // Relationships
                entity.HasOne(e => e.AppUser)
                    .WithMany(u => u.EmailNotifications)
                    .HasForeignKey(e => e.AppUserId)
                    .OnDelete(DeleteBehavior.Restrict);

                entity.HasOne(e => e.Organization)
                    .WithMany()
                    .HasForeignKey(e => e.OrganizationId)
                    .OnDelete(DeleteBehavior.Restrict);

                entity.HasQueryFilter(e => _currentUserService.Role == "SuperAdmin" || e.OrganizationId == _currentUserService.OrganizationId);
            });
        }

        private void ConfigureSystemSetting(ModelBuilder modelBuilder)
        {
            modelBuilder.Entity<SystemSetting>(entity =>
            {
                entity.ToTable("system_settings");

                entity.HasKey(e => new { e.OrganizationId, e.SettingKey });

                entity.Property(e => e.SettingKey)
                    .HasColumnName("setting_key")
                    .HasMaxLength(100);

                entity.Property(e => e.SettingValue)
                    .HasColumnName("setting_value")
                    .HasMaxLength(255)
                    .IsRequired();

                entity.Property(e => e.Description)
                    .HasColumnName("description")
                    .HasMaxLength(500);

                entity.Property(e => e.UpdatedAt)
                    .HasColumnName("updated_at");

                // Relationships
                entity.HasOne(e => e.AppUser)
                    .WithMany(u => u.SystemSettings)
                    .HasForeignKey(e => e.AppUserId)
                    .OnDelete(DeleteBehavior.Restrict);

                entity.HasOne(e => e.Organization)
                    .WithMany()
                    .HasForeignKey(e => e.OrganizationId)
                    .OnDelete(DeleteBehavior.Restrict);

                entity.HasQueryFilter(e => _currentUserService.Role == "SuperAdmin" || e.OrganizationId == _currentUserService.OrganizationId);
            });
        }

        private void ConfigureTenantDeviceToken(ModelBuilder modelBuilder)
        {
            modelBuilder.Entity<TenantDeviceToken>(entity =>
            {
                entity.ToTable("tenant_device_tokens");

                entity.HasKey(e => e.TenantDeviceTokenId);

                entity.Property(e => e.TenantDeviceTokenId)
                    .HasColumnName("tenant_device_token_id");

                entity.Property(e => e.TenantId)
                    .HasColumnName("tenant_id")
                    .IsRequired();

                entity.Property(e => e.OrganizationId)
                    .HasColumnName("organization_id")
                    .IsRequired();

                entity.Property(e => e.AppUserId)
                    .HasColumnName("app_user_id")
                    .IsRequired();

                entity.Property(e => e.ExpoPushToken)
                    .HasColumnName("expo_push_token")
                    .HasMaxLength(255)
                    .IsRequired();

                entity.Property(e => e.Platform)
                    .HasColumnName("platform")
                    .HasMaxLength(30);

                entity.Property(e => e.DeviceName)
                    .HasColumnName("device_name")
                    .HasMaxLength(120);

                entity.Property(e => e.IsActive)
                    .HasColumnName("is_active");

                entity.Property(e => e.CreatedAt)
                    .HasColumnName("created_at");

                entity.Property(e => e.UpdatedAt)
                    .HasColumnName("updated_at");

                entity.Property(e => e.LastSeenAt)
                    .HasColumnName("last_seen_at");

                entity.HasOne(e => e.Tenant)
                    .WithMany()
                    .HasForeignKey(e => e.TenantId)
                    .OnDelete(DeleteBehavior.Cascade);

                entity.HasOne(e => e.AppUser)
                    .WithMany()
                    .HasForeignKey(e => e.AppUserId)
                    .OnDelete(DeleteBehavior.Restrict);

                entity.HasOne(e => e.Organization)
                    .WithMany()
                    .HasForeignKey(e => e.OrganizationId)
                    .OnDelete(DeleteBehavior.Restrict);

                entity.HasIndex(e => new { e.OrganizationId, e.ExpoPushToken })
                    .IsUnique();

                entity.HasIndex(e => new { e.TenantId, e.IsActive });

                entity.HasQueryFilter(e => _currentUserService.Role == "SuperAdmin" || e.OrganizationId == _currentUserService.OrganizationId);
            });

            // AdminOrganizationMembership configuration
            modelBuilder.Entity<AdminOrganizationMembership>(entity =>
            {
                entity.ToTable("admin_organization_memberships");
                entity.HasKey(e => e.Id);
                entity.Property(e => e.Id).HasColumnName("id");
                entity.Property(e => e.UserId).HasColumnName("user_id");
                entity.Property(e => e.OrganizationId).HasColumnName("organization_id");
                entity.Property(e => e.IsActive).HasColumnName("is_active");
                entity.Property(e => e.CanAccessAllPages).HasColumnName("can_access_all_pages");
                entity.Property(e => e.CreatedAt).HasColumnName("created_at");
                entity.Property(e => e.UpdatedAt).HasColumnName("updated_at");

                entity.HasOne(e => e.User)
                    .WithMany()
                    .HasForeignKey(e => e.UserId)
                    .OnDelete(DeleteBehavior.Cascade);

                entity.HasOne(e => e.Organization)
                    .WithMany()
                    .HasForeignKey(e => e.OrganizationId)
                    .OnDelete(DeleteBehavior.Cascade);
            });

            // AdminOrganizationPagePermission configuration
            modelBuilder.Entity<AdminOrganizationPagePermission>(entity =>
            {
                entity.ToTable("admin_organization_page_permissions");
                entity.HasKey(e => e.Id);
                entity.Property(e => e.Id).HasColumnName("id");
                entity.Property(e => e.UserId).HasColumnName("user_id");
                entity.Property(e => e.OrganizationId).HasColumnName("organization_id");
                entity.Property(e => e.PageKey).HasColumnName("page_key").HasMaxLength(100).IsRequired();
                entity.Property(e => e.CanAccess).HasColumnName("can_access");
                entity.Property(e => e.CreatedAt).HasColumnName("created_at");
                entity.Property(e => e.UpdatedAt).HasColumnName("updated_at");

                entity.HasOne(e => e.User)
                    .WithMany()
                    .HasForeignKey(e => e.UserId)
                    .OnDelete(DeleteBehavior.Cascade);

                entity.HasOne(e => e.Organization)
                    .WithMany()
                    .HasForeignKey(e => e.OrganizationId)
                    .OnDelete(DeleteBehavior.Cascade);
            });
        }

        public override int SaveChanges()
        {
            SetMultiTenantProperties();
            return base.SaveChanges();
        }

        public override Task<int> SaveChangesAsync(CancellationToken cancellationToken = default)
        {
            SetMultiTenantProperties();
            return base.SaveChangesAsync(cancellationToken);
        }

        private void SetMultiTenantProperties()
        {
            var entries = ChangeTracker.Entries()
                .Where(e => e.State == EntityState.Added || e.State == EntityState.Modified);

            var currentUserId = _currentUserService.UserId;
            var currentOrgId = _currentUserService.OrganizationId;

            foreach (var entry in entries)
            {
                // Fill CreatedAt/UpdatedAt
                if (entry.State == EntityState.Added)
                {
                    var createdAtProp = entry.Metadata.FindProperty("CreatedAt");
                    if (createdAtProp != null && createdAtProp.ClrType == typeof(DateTime))
                    {
                        entry.Property("CreatedAt").CurrentValue = DateTime.UtcNow;
                    }
                }

                var updatedAtProp = entry.Metadata.FindProperty("UpdatedAt");
                if (updatedAtProp != null && updatedAtProp.ClrType == typeof(DateTime))
                {
                    entry.Property("UpdatedAt").CurrentValue = DateTime.UtcNow;
                }

                // Fill AppUserId
                var appUserIdProp = entry.Metadata.FindProperty("AppUserId");
                if (appUserIdProp != null && appUserIdProp.ClrType == typeof(int) && entry.State == EntityState.Added)
                {
                    var currentValue = (int?)entry.Property("AppUserId").CurrentValue;
                    if (currentValue == null || currentValue == 0)
                    {
                        entry.Property("AppUserId").CurrentValue = currentUserId;
                    }
                }

                // Fill OrganizationId
                var orgIdProp = entry.Metadata.FindProperty("OrganizationId");
                if (orgIdProp != null && entry.State == EntityState.Added)
                {
                    if (orgIdProp.ClrType == typeof(int))
                    {
                        var currentValue = (int)entry.Property("OrganizationId").CurrentValue;
                        if (currentValue == 0 && currentOrgId.HasValue)
                        {
                            entry.Property("OrganizationId").CurrentValue = currentOrgId.Value;
                        }
                    }
                    else if (orgIdProp.ClrType == typeof(int?))
                    {
                        var currentValue = (int?)entry.Property("OrganizationId").CurrentValue;
                        if (currentValue == null && currentOrgId.HasValue)
                        {
                            entry.Property("OrganizationId").CurrentValue = currentOrgId.Value;
                        }
                    }
                }
            }
        }
    }
}
