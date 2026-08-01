using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace NhaTro.Migrations
{
    /// <inheritdoc />
    public partial class AddContractCustomWaterFee : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<decimal>(
                name: "custom_water_fee",
                table: "contracts",
                type: "decimal(18,2)",
                precision: 18,
                scale: 2,
                nullable: true);

            migrationBuilder.AddCheckConstraint(
                name: "CK_contracts_custom_water_fee",
                table: "contracts",
                sql: "custom_water_fee IS NULL OR custom_water_fee >= 0");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropCheckConstraint(
                name: "CK_contracts_custom_water_fee",
                table: "contracts");

            migrationBuilder.DropColumn(
                name: "custom_water_fee",
                table: "contracts");
        }
    }
}
