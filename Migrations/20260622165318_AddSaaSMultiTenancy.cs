using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace NhaTro.Migrations
{
    /// <inheritdoc />
    public partial class AddSaaSMultiTenancy : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // 1. Create organizations table first
            migrationBuilder.CreateTable(
                name: "organizations",
                columns: table => new
                {
                    id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    name = table.Column<string>(type: "nvarchar(255)", maxLength: 255, nullable: false),
                    code = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: false),
                    owner_name = table.Column<string>(type: "nvarchar(255)", maxLength: 255, nullable: true),
                    phone = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: true),
                    email = table.Column<string>(type: "nvarchar(255)", maxLength: 255, nullable: true),
                    address = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: true),
                    is_active = table.Column<bool>(type: "bit", nullable: false, defaultValue: true),
                    created_at = table.Column<DateTime>(type: "datetime2", nullable: false),
                    updated_at = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_organizations", x => x.id);
                });

            // Seed default organization (id = 1)
            migrationBuilder.Sql("SET IDENTITY_INSERT [organizations] ON;");
            migrationBuilder.Sql("INSERT INTO [organizations] ([id], [name], [code], [owner_name], [phone], [email], [address], [is_active], [created_at], [updated_at]) VALUES (1, N'Hệ thống mặc định', 'DEFAULT', NULL, NULL, NULL, NULL, 1, GETUTCDATE(), GETUTCDATE());");
            migrationBuilder.Sql("SET IDENTITY_INSERT [organizations] OFF;");

            // 2. Drop primary key and index
            migrationBuilder.DropPrimaryKey(
                name: "PK_system_settings",
                table: "system_settings");

            migrationBuilder.DropIndex(
                name: "IX_rooms_room_code",
                table: "rooms");

            // 3. Rename columns in users
            migrationBuilder.RenameColumn(
                name: "email",
                table: "users",
                newName: "Email");

            migrationBuilder.RenameColumn(
                name: "id",
                table: "users",
                newName: "Id");

            migrationBuilder.RenameColumn(
                name: "password_hash",
                table: "users",
                newName: "PasswordHash");

            migrationBuilder.RenameColumn(
                name: "otp_expiry_time",
                table: "users",
                newName: "OtpExpiryTime");

            migrationBuilder.RenameColumn(
                name: "otp_code",
                table: "users",
                newName: "OtpCode");

            migrationBuilder.RenameColumn(
                name: "is_active",
                table: "users",
                newName: "IsActive");

            migrationBuilder.RenameColumn(
                name: "created_at",
                table: "users",
                newName: "CreatedAt");

            migrationBuilder.RenameIndex(
                name: "IX_users_email",
                table: "users",
                newName: "IX_users_Email");

            // 4. Add new columns in users
            migrationBuilder.AddColumn<string>(
                name: "DisplayName",
                table: "users",
                type: "nvarchar(255)",
                maxLength: 255,
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<DateTime>(
                name: "LastLoginAt",
                table: "users",
                type: "datetime2",
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "MustChangePassword",
                table: "users",
                type: "bit",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<int>(
                name: "OrganizationId",
                table: "users",
                type: "int",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "Role",
                table: "users",
                type: "nvarchar(50)",
                maxLength: 50,
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<int>(
                name: "TenantId",
                table: "users",
                type: "int",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "Username",
                table: "users",
                type: "nvarchar(255)",
                maxLength: 255,
                nullable: false,
                defaultValue: "");

            // 5. Add columns to business tables with defaultValue = 1 (matching the default org ID)
            migrationBuilder.AddColumn<int>(
                name: "OrganizationId",
                table: "transactions",
                type: "int",
                nullable: false,
                defaultValue: 1);

            migrationBuilder.AddColumn<int>(
                name: "OrganizationId",
                table: "tenants",
                type: "int",
                nullable: false,
                defaultValue: 1);

            migrationBuilder.AddColumn<int>(
                name: "OrganizationId",
                table: "system_settings",
                type: "int",
                nullable: false,
                defaultValue: 1);

            migrationBuilder.AddColumn<int>(
                name: "OrganizationId",
                table: "rooms",
                type: "int",
                nullable: false,
                defaultValue: 1);

            migrationBuilder.AddColumn<int>(
                name: "OrganizationId",
                table: "payment_transactions",
                type: "int",
                nullable: false,
                defaultValue: 1);

            migrationBuilder.AddColumn<int>(
                name: "OrganizationId",
                table: "meter_readings",
                type: "int",
                nullable: false,
                defaultValue: 1);

            migrationBuilder.AddColumn<int>(
                name: "OrganizationId",
                table: "invoices",
                type: "int",
                nullable: false,
                defaultValue: 1);

            migrationBuilder.AddColumn<int>(
                name: "OrganizationId",
                table: "email_notifications",
                type: "int",
                nullable: false,
                defaultValue: 1);

            migrationBuilder.AddColumn<int>(
                name: "OrganizationId",
                table: "deposit_settlements",
                type: "int",
                nullable: false,
                defaultValue: 1);

            migrationBuilder.AddColumn<int>(
                name: "OrganizationId",
                table: "contracts",
                type: "int",
                nullable: false,
                defaultValue: 1);

            migrationBuilder.AddPrimaryKey(
                name: "PK_system_settings",
                table: "system_settings",
                columns: new[] { "OrganizationId", "setting_key" });

            // 6. Backfill existing user data before index creation
            // Backfill existing admin user hungnamhcm@gmail.com
            migrationBuilder.Sql(@"
UPDATE [users]
SET [Username] = 'hungnamhcm',
    [DisplayName] = N'Hung Nam Admin',
    [Role] = 'Admin',
    [OrganizationId] = 1,
    [IsActive] = 1,
    [MustChangePassword] = 0
WHERE [Email] = 'hungnamhcm@gmail.com';
");

            // Seed SuperAdmin hungltp206@gmail.com
            migrationBuilder.Sql(@"
IF EXISTS (SELECT 1 FROM [users] WHERE [Email] = 'hungltp206@gmail.com')
BEGIN
    UPDATE [users] 
    SET [Role] = 'SuperAdmin', 
        [Username] = 'hungltp206', 
        [DisplayName] = N'Super Admin', 
        [OrganizationId] = NULL, 
        [TenantId] = NULL, 
        [IsActive] = 1,
        [MustChangePassword] = 0
    WHERE [Email] = 'hungltp206@gmail.com';
END
ELSE
BEGIN
    INSERT INTO [users] ([Username], [Email], [PasswordHash], [DisplayName], [Role], [OrganizationId], [TenantId], [IsActive], [MustChangePassword], [CreatedAt])
    VALUES ('hungltp206', 'hungltp206@gmail.com', '$2a$11$u8t1XpG/vBf3YyO24kC/t.rBszQj09NskKjTfN.p1bNeq2lB.0G2G', N'Super Admin', 'SuperAdmin', NULL, NULL, 1, 0, GETUTCDATE());
END
");

            // Ensure all other users (if any) have unique usernames and display names, or assign defaults
            migrationBuilder.Sql(@"
UPDATE [users]
SET [Username] = COALESCE(NULLIF([Username], ''), SUBSTRING([Email], 1, CHARINDEX('@', [Email]) - 1)),
    [DisplayName] = COALESCE(NULLIF([DisplayName], ''), [Email]),
    [Role] = COALESCE(NULLIF([Role], ''), 'Tenant'),
    [OrganizationId] = COALESCE([OrganizationId], 1),
    [IsActive] = COALESCE([IsActive], 1)
WHERE [Username] = '' OR [DisplayName] = '' OR [Role] = '';
");

            // 7. Create indexes & constraints
            migrationBuilder.CreateIndex(
                name: "IX_users_OrganizationId",
                table: "users",
                column: "OrganizationId");

            migrationBuilder.CreateIndex(
                name: "IX_users_TenantId",
                table: "users",
                column: "TenantId",
                unique: true,
                filter: "[TenantId] IS NOT NULL");

            migrationBuilder.CreateIndex(
                name: "IX_users_Username",
                table: "users",
                column: "Username",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_transactions_OrganizationId",
                table: "transactions",
                column: "OrganizationId");

            migrationBuilder.CreateIndex(
                name: "IX_tenants_OrganizationId",
                table: "tenants",
                column: "OrganizationId");

            migrationBuilder.CreateIndex(
                name: "IX_rooms_OrganizationId_room_code",
                table: "rooms",
                columns: new[] { "OrganizationId", "room_code" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_payment_transactions_OrganizationId",
                table: "payment_transactions",
                column: "OrganizationId");

            migrationBuilder.CreateIndex(
                name: "IX_meter_readings_OrganizationId",
                table: "meter_readings",
                column: "OrganizationId");

            migrationBuilder.CreateIndex(
                name: "IX_invoices_OrganizationId",
                table: "invoices",
                column: "OrganizationId");

            migrationBuilder.CreateIndex(
                name: "IX_email_notifications_OrganizationId",
                table: "email_notifications",
                column: "OrganizationId");

            migrationBuilder.CreateIndex(
                name: "IX_deposit_settlements_OrganizationId",
                table: "deposit_settlements",
                column: "OrganizationId");

            migrationBuilder.CreateIndex(
                name: "IX_contracts_OrganizationId",
                table: "contracts",
                column: "OrganizationId");

            migrationBuilder.AddForeignKey(
                name: "FK_contracts_organizations_OrganizationId",
                table: "contracts",
                column: "OrganizationId",
                principalTable: "organizations",
                principalColumn: "id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_deposit_settlements_organizations_OrganizationId",
                table: "deposit_settlements",
                column: "OrganizationId",
                principalTable: "organizations",
                principalColumn: "id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_email_notifications_organizations_OrganizationId",
                table: "email_notifications",
                column: "OrganizationId",
                principalTable: "organizations",
                principalColumn: "id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_invoices_organizations_OrganizationId",
                table: "invoices",
                column: "OrganizationId",
                principalTable: "organizations",
                principalColumn: "id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_meter_readings_organizations_OrganizationId",
                table: "meter_readings",
                column: "OrganizationId",
                principalTable: "organizations",
                principalColumn: "id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_payment_transactions_organizations_OrganizationId",
                table: "payment_transactions",
                column: "OrganizationId",
                principalTable: "organizations",
                principalColumn: "id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_rooms_organizations_OrganizationId",
                table: "rooms",
                column: "OrganizationId",
                principalTable: "organizations",
                principalColumn: "id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_system_settings_organizations_OrganizationId",
                table: "system_settings",
                column: "OrganizationId",
                principalTable: "organizations",
                principalColumn: "id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_tenants_organizations_OrganizationId",
                table: "tenants",
                column: "OrganizationId",
                principalTable: "organizations",
                principalColumn: "id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_transactions_organizations_OrganizationId",
                table: "transactions",
                column: "OrganizationId",
                principalTable: "organizations",
                principalColumn: "id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_users_organizations_OrganizationId",
                table: "users",
                column: "OrganizationId",
                principalTable: "organizations",
                principalColumn: "id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_users_tenants_TenantId",
                table: "users",
                column: "TenantId",
                principalTable: "tenants",
                principalColumn: "tenant_id",
                onDelete: ReferentialAction.Restrict);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_contracts_organizations_OrganizationId",
                table: "contracts");

            migrationBuilder.DropForeignKey(
                name: "FK_deposit_settlements_organizations_OrganizationId",
                table: "deposit_settlements");

            migrationBuilder.DropForeignKey(
                name: "FK_email_notifications_organizations_OrganizationId",
                table: "email_notifications");

            migrationBuilder.DropForeignKey(
                name: "FK_invoices_organizations_OrganizationId",
                table: "invoices");

            migrationBuilder.DropForeignKey(
                name: "FK_meter_readings_organizations_OrganizationId",
                table: "meter_readings");

            migrationBuilder.DropForeignKey(
                name: "FK_payment_transactions_organizations_OrganizationId",
                table: "payment_transactions");

            migrationBuilder.DropForeignKey(
                name: "FK_rooms_organizations_OrganizationId",
                table: "rooms");

            migrationBuilder.DropForeignKey(
                name: "FK_system_settings_organizations_OrganizationId",
                table: "system_settings");

            migrationBuilder.DropForeignKey(
                name: "FK_tenants_organizations_OrganizationId",
                table: "tenants");

            migrationBuilder.DropForeignKey(
                name: "FK_transactions_organizations_OrganizationId",
                table: "transactions");

            migrationBuilder.DropForeignKey(
                name: "FK_users_organizations_OrganizationId",
                table: "users");

            migrationBuilder.DropForeignKey(
                name: "FK_users_tenants_TenantId",
                table: "users");

            migrationBuilder.DropTable(
                name: "organizations");

            migrationBuilder.DropIndex(
                name: "IX_users_OrganizationId",
                table: "users");

            migrationBuilder.DropIndex(
                name: "IX_users_TenantId",
                table: "users");

            migrationBuilder.DropIndex(
                name: "IX_users_Username",
                table: "users");

            migrationBuilder.DropIndex(
                name: "IX_transactions_OrganizationId",
                table: "transactions");

            migrationBuilder.DropIndex(
                name: "IX_tenants_OrganizationId",
                table: "tenants");

            migrationBuilder.DropPrimaryKey(
                name: "PK_system_settings",
                table: "system_settings");

            migrationBuilder.DropIndex(
                name: "IX_rooms_OrganizationId_room_code",
                table: "rooms");

            migrationBuilder.DropIndex(
                name: "IX_payment_transactions_OrganizationId",
                table: "payment_transactions");

            migrationBuilder.DropIndex(
                name: "IX_meter_readings_OrganizationId",
                table: "meter_readings");

            migrationBuilder.DropIndex(
                name: "IX_invoices_OrganizationId",
                table: "invoices");

            migrationBuilder.DropIndex(
                name: "IX_email_notifications_OrganizationId",
                table: "email_notifications");

            migrationBuilder.DropIndex(
                name: "IX_deposit_settlements_OrganizationId",
                table: "deposit_settlements");

            migrationBuilder.DropIndex(
                name: "IX_contracts_OrganizationId",
                table: "contracts");

            migrationBuilder.DropColumn(
                name: "DisplayName",
                table: "users");

            migrationBuilder.DropColumn(
                name: "LastLoginAt",
                table: "users");

            migrationBuilder.DropColumn(
                name: "MustChangePassword",
                table: "users");

            migrationBuilder.DropColumn(
                name: "OrganizationId",
                table: "users");

            migrationBuilder.DropColumn(
                name: "Role",
                table: "users");

            migrationBuilder.DropColumn(
                name: "TenantId",
                table: "users");

            migrationBuilder.DropColumn(
                name: "Username",
                table: "users");

            migrationBuilder.DropColumn(
                name: "OrganizationId",
                table: "transactions");

            migrationBuilder.DropColumn(
                name: "OrganizationId",
                table: "tenants");

            migrationBuilder.DropColumn(
                name: "OrganizationId",
                table: "system_settings");

            migrationBuilder.DropColumn(
                name: "OrganizationId",
                table: "rooms");

            migrationBuilder.DropColumn(
                name: "OrganizationId",
                table: "payment_transactions");

            migrationBuilder.DropColumn(
                name: "OrganizationId",
                table: "meter_readings");

            migrationBuilder.DropColumn(
                name: "OrganizationId",
                table: "invoices");

            migrationBuilder.DropColumn(
                name: "OrganizationId",
                table: "email_notifications");

            migrationBuilder.DropColumn(
                name: "OrganizationId",
                table: "deposit_settlements");

            migrationBuilder.DropColumn(
                name: "OrganizationId",
                table: "contracts");

            migrationBuilder.RenameColumn(
                name: "Email",
                table: "users",
                newName: "email");

            migrationBuilder.RenameColumn(
                name: "Id",
                table: "users",
                newName: "id");

            migrationBuilder.RenameColumn(
                name: "PasswordHash",
                table: "users",
                newName: "password_hash");

            migrationBuilder.RenameColumn(
                name: "OtpExpiryTime",
                table: "users",
                newName: "otp_expiry_time");

            migrationBuilder.RenameColumn(
                name: "OtpCode",
                table: "users",
                newName: "otp_code");

            migrationBuilder.RenameColumn(
                name: "IsActive",
                table: "users",
                newName: "is_active");

            migrationBuilder.RenameColumn(
                name: "CreatedAt",
                table: "users",
                newName: "created_at");

            migrationBuilder.RenameIndex(
                name: "IX_users_Email",
                table: "users",
                newName: "IX_users_email");

            migrationBuilder.AddPrimaryKey(
                name: "PK_system_settings",
                table: "system_settings",
                column: "setting_key");

            migrationBuilder.CreateIndex(
                name: "IX_rooms_room_code",
                table: "rooms",
                column: "room_code",
                unique: true);
        }
    }
}
