using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace NhaTro.Migrations
{
    /// <inheritdoc />
    public partial class FixColumnsFinal : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_deposit_settlements_contracts_contract_id",
                table: "deposit_settlements");

            migrationBuilder.DropForeignKey(
                name: "FK_invoices_contracts_contract_id",
                table: "invoices");

            migrationBuilder.DropForeignKey(
                name: "FK_meter_readings_contracts_contract_id",
                table: "meter_readings");

            migrationBuilder.DropIndex(
                name: "IX_deposit_settlements_contract_id",
                table: "deposit_settlements");

            migrationBuilder.AlterColumn<int>(
                name: "contract_id",
                table: "meter_readings",
                type: "int",
                nullable: true,
                oldClrType: typeof(int),
                oldType: "int");

            migrationBuilder.AddColumn<string>(
                name: "contract_snapshot_json",
                table: "meter_readings",
                type: "nvarchar(max)",
                nullable: true);

            migrationBuilder.AlterColumn<int>(
                name: "contract_id",
                table: "invoices",
                type: "int",
                nullable: true,
                oldClrType: typeof(int),
                oldType: "int");

            migrationBuilder.AddColumn<string>(
                name: "contract_snapshot_json",
                table: "invoices",
                type: "nvarchar(max)",
                nullable: true);

            migrationBuilder.AlterColumn<int>(
                name: "contract_id",
                table: "deposit_settlements",
                type: "int",
                nullable: true,
                oldClrType: typeof(int),
                oldType: "int");

            migrationBuilder.AddColumn<string>(
                name: "contract_snapshot_json",
                table: "deposit_settlements",
                type: "nvarchar(max)",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_deposit_settlements_contract_id",
                table: "deposit_settlements",
                column: "contract_id",
                unique: true,
                filter: "[contract_id] IS NOT NULL");

            migrationBuilder.AddForeignKey(
                name: "FK_deposit_settlements_contracts_contract_id",
                table: "deposit_settlements",
                column: "contract_id",
                principalTable: "contracts",
                principalColumn: "contract_id",
                onDelete: ReferentialAction.SetNull);

            migrationBuilder.AddForeignKey(
                name: "FK_invoices_contracts_contract_id",
                table: "invoices",
                column: "contract_id",
                principalTable: "contracts",
                principalColumn: "contract_id",
                onDelete: ReferentialAction.SetNull);

            migrationBuilder.AddForeignKey(
                name: "FK_meter_readings_contracts_contract_id",
                table: "meter_readings",
                column: "contract_id",
                principalTable: "contracts",
                principalColumn: "contract_id",
                onDelete: ReferentialAction.SetNull);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_deposit_settlements_contracts_contract_id",
                table: "deposit_settlements");

            migrationBuilder.DropForeignKey(
                name: "FK_invoices_contracts_contract_id",
                table: "invoices");

            migrationBuilder.DropForeignKey(
                name: "FK_meter_readings_contracts_contract_id",
                table: "meter_readings");

            migrationBuilder.DropIndex(
                name: "IX_deposit_settlements_contract_id",
                table: "deposit_settlements");

            migrationBuilder.DropColumn(
                name: "contract_snapshot_json",
                table: "meter_readings");

            migrationBuilder.DropColumn(
                name: "contract_snapshot_json",
                table: "invoices");

            migrationBuilder.DropColumn(
                name: "contract_snapshot_json",
                table: "deposit_settlements");

            migrationBuilder.AlterColumn<int>(
                name: "contract_id",
                table: "meter_readings",
                type: "int",
                nullable: false,
                defaultValue: 0,
                oldClrType: typeof(int),
                oldType: "int",
                oldNullable: true);

            migrationBuilder.AlterColumn<int>(
                name: "contract_id",
                table: "invoices",
                type: "int",
                nullable: false,
                defaultValue: 0,
                oldClrType: typeof(int),
                oldType: "int",
                oldNullable: true);

            migrationBuilder.AlterColumn<int>(
                name: "contract_id",
                table: "deposit_settlements",
                type: "int",
                nullable: false,
                defaultValue: 0,
                oldClrType: typeof(int),
                oldType: "int",
                oldNullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_deposit_settlements_contract_id",
                table: "deposit_settlements",
                column: "contract_id",
                unique: true);

            migrationBuilder.AddForeignKey(
                name: "FK_deposit_settlements_contracts_contract_id",
                table: "deposit_settlements",
                column: "contract_id",
                principalTable: "contracts",
                principalColumn: "contract_id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_invoices_contracts_contract_id",
                table: "invoices",
                column: "contract_id",
                principalTable: "contracts",
                principalColumn: "contract_id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_meter_readings_contracts_contract_id",
                table: "meter_readings",
                column: "contract_id",
                principalTable: "contracts",
                principalColumn: "contract_id",
                onDelete: ReferentialAction.Restrict);
        }
    }
}
