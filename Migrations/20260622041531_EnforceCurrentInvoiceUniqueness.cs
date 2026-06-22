using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace NhaTro.Migrations
{
    /// <inheritdoc />
    public partial class EnforceCurrentInvoiceUniqueness : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_invoices_room_month_type",
                table: "invoices");

            migrationBuilder.CreateIndex(
                name: "IX_invoices_room_month_type",
                table: "invoices",
                columns: new[] { "room_id", "billing_month", "invoice_type" },
                unique: true,
                filter: "[replaced_by_invoice_id] IS NULL");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_invoices_room_month_type",
                table: "invoices");

            migrationBuilder.CreateIndex(
                name: "IX_invoices_room_month_type",
                table: "invoices",
                columns: new[] { "room_id", "billing_month", "invoice_type" });
        }
    }
}
