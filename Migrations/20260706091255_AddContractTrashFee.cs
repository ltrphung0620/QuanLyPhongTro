using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace NhaTro.Migrations
{
    /// <inheritdoc />
    public partial class AddContractTrashFee : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<decimal>(
                name: "trash_fee",
                table: "contracts",
                type: "decimal(18,2)",
                precision: 18,
                scale: 2,
                nullable: false,
                defaultValue: 30000m);

            migrationBuilder.Sql("""
                UPDATE c
                SET c.trash_fee = COALESCE(TRY_CONVERT(decimal(18, 2), s.setting_value), 30000)
                FROM contracts c
                LEFT JOIN system_settings s
                    ON s.organization_id = c.OrganizationId
                    AND s.setting_key = N'Pricing.TrashFee';
                """);

            migrationBuilder.AddCheckConstraint(
                name: "CK_contracts_trash_fee",
                table: "contracts",
                sql: "trash_fee >= 0");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropCheckConstraint(
                name: "CK_contracts_trash_fee",
                table: "contracts");

            migrationBuilder.DropColumn(
                name: "trash_fee",
                table: "contracts");
        }
    }
}
