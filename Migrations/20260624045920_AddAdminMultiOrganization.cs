using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace NhaTro.Migrations
{
    /// <inheritdoc />
    public partial class AddAdminMultiOrganization : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "admin_organization_memberships",
                columns: table => new
                {
                    id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    user_id = table.Column<int>(type: "int", nullable: false),
                    organization_id = table.Column<int>(type: "int", nullable: false),
                    is_active = table.Column<bool>(type: "bit", nullable: false),
                    can_access_all_pages = table.Column<bool>(type: "bit", nullable: false),
                    created_at = table.Column<DateTime>(type: "datetime2", nullable: false),
                    updated_at = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_admin_organization_memberships", x => x.id);
                    table.ForeignKey(
                        name: "FK_admin_organization_memberships_organizations_organization_id",
                        column: x => x.organization_id,
                        principalTable: "organizations",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_admin_organization_memberships_users_user_id",
                        column: x => x.user_id,
                        principalTable: "users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "admin_organization_page_permissions",
                columns: table => new
                {
                    id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    user_id = table.Column<int>(type: "int", nullable: false),
                    organization_id = table.Column<int>(type: "int", nullable: false),
                    page_key = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    can_access = table.Column<bool>(type: "bit", nullable: false),
                    created_at = table.Column<DateTime>(type: "datetime2", nullable: false),
                    updated_at = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_admin_organization_page_permissions", x => x.id);
                    table.ForeignKey(
                        name: "FK_admin_organization_page_permissions_organizations_organization_id",
                        column: x => x.organization_id,
                        principalTable: "organizations",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_admin_organization_page_permissions_users_user_id",
                        column: x => x.user_id,
                        principalTable: "users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_admin_organization_memberships_organization_id",
                table: "admin_organization_memberships",
                column: "organization_id");

            migrationBuilder.CreateIndex(
                name: "IX_admin_organization_memberships_user_id",
                table: "admin_organization_memberships",
                column: "user_id");

            migrationBuilder.CreateIndex(
                name: "IX_admin_organization_page_permissions_organization_id",
                table: "admin_organization_page_permissions",
                column: "organization_id");

            migrationBuilder.CreateIndex(
                name: "IX_admin_organization_page_permissions_user_id",
                table: "admin_organization_page_permissions",
                column: "user_id");

            // Migrate existing admin memberships
            migrationBuilder.Sql(@"
                INSERT INTO admin_organization_memberships (user_id, organization_id, is_active, can_access_all_pages, created_at, updated_at)
                SELECT Id, OrganizationId, IsActive, CASE WHEN page_permissions = '*' THEN 1 ELSE 0 END, GETUTCDATE(), GETUTCDATE()
                FROM users
                WHERE Role = 'Admin' AND OrganizationId IS NOT NULL;
            ");

            // Migrate existing admin permissions per organization
            migrationBuilder.Sql(@"
                INSERT INTO admin_organization_page_permissions (user_id, organization_id, page_key, can_access, created_at, updated_at)
                SELECT u.Id, u.OrganizationId, RTRIM(LTRIM(s.value)), 1, GETUTCDATE(), GETUTCDATE()
                FROM users u
                CROSS APPLY STRING_SPLIT(u.page_permissions, ',') s
                WHERE u.Role = 'Admin' AND u.OrganizationId IS NOT NULL AND u.page_permissions IS NOT NULL AND u.page_permissions <> '*';
            ");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "admin_organization_memberships");

            migrationBuilder.DropTable(
                name: "admin_organization_page_permissions");
        }
    }
}
