using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace NhaTro.Migrations
{
    /// <inheritdoc />
    public partial class EnforceContractBusinessInvariants : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_contracts_room_id_status",
                table: "contracts");

            migrationBuilder.CreateIndex(
                name: "IX_contracts_room_id_status",
                table: "contracts",
                columns: new[] { "room_id", "status" },
                unique: true,
                filter: "[status] = 'active' AND [is_archived] = 0");

            migrationBuilder.AddCheckConstraint(
                name: "CK_contracts_deposit_paid_amount",
                table: "contracts",
                sql: "deposit_paid_amount >= 0 AND deposit_paid_amount <= deposit_amount");

            migrationBuilder.AddCheckConstraint(
                name: "CK_contracts_expected_end_date",
                table: "contracts",
                sql: "expected_end_date IS NULL OR expected_end_date >= start_date");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_contracts_room_id_status",
                table: "contracts");

            migrationBuilder.DropCheckConstraint(
                name: "CK_contracts_deposit_paid_amount",
                table: "contracts");

            migrationBuilder.DropCheckConstraint(
                name: "CK_contracts_expected_end_date",
                table: "contracts");

            migrationBuilder.CreateIndex(
                name: "IX_contracts_room_id_status",
                table: "contracts",
                columns: new[] { "room_id", "status" });
        }
    }
}
