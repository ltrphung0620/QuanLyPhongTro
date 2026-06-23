using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace NhaTro.Migrations
{
    /// <inheritdoc />
    public partial class AddTenantDeviceTokens : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "tenant_device_tokens",
                columns: table => new
                {
                    tenant_device_token_id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    tenant_id = table.Column<int>(type: "int", nullable: false),
                    organization_id = table.Column<int>(type: "int", nullable: false),
                    app_user_id = table.Column<int>(type: "int", nullable: false),
                    expo_push_token = table.Column<string>(type: "nvarchar(255)", maxLength: 255, nullable: false),
                    platform = table.Column<string>(type: "nvarchar(30)", maxLength: 30, nullable: true),
                    device_name = table.Column<string>(type: "nvarchar(120)", maxLength: 120, nullable: true),
                    is_active = table.Column<bool>(type: "bit", nullable: false),
                    created_at = table.Column<DateTime>(type: "datetime2", nullable: false),
                    updated_at = table.Column<DateTime>(type: "datetime2", nullable: false),
                    last_seen_at = table.Column<DateTime>(type: "datetime2", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_tenant_device_tokens", x => x.tenant_device_token_id);
                    table.ForeignKey(
                        name: "FK_tenant_device_tokens_organizations_organization_id",
                        column: x => x.organization_id,
                        principalTable: "organizations",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_tenant_device_tokens_tenants_tenant_id",
                        column: x => x.tenant_id,
                        principalTable: "tenants",
                        principalColumn: "tenant_id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_tenant_device_tokens_users_app_user_id",
                        column: x => x.app_user_id,
                        principalTable: "users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "IX_tenant_device_tokens_app_user_id",
                table: "tenant_device_tokens",
                column: "app_user_id");

            migrationBuilder.CreateIndex(
                name: "IX_tenant_device_tokens_organization_id_expo_push_token",
                table: "tenant_device_tokens",
                columns: new[] { "organization_id", "expo_push_token" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_tenant_device_tokens_tenant_id_is_active",
                table: "tenant_device_tokens",
                columns: new[] { "tenant_id", "is_active" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "tenant_device_tokens");
        }
    }
}
