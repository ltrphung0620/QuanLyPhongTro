using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace NhaTro.Migrations
{
    /// <inheritdoc />
    public partial class AddTransactionRelatedRoom : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "related_room_id",
                table: "transactions",
                type: "int",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_transactions_related_room_id",
                table: "transactions",
                column: "related_room_id");

            migrationBuilder.AddForeignKey(
                name: "FK_transactions_rooms_related_room_id",
                table: "transactions",
                column: "related_room_id",
                principalTable: "rooms",
                principalColumn: "room_id",
                onDelete: ReferentialAction.SetNull);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_transactions_rooms_related_room_id",
                table: "transactions");

            migrationBuilder.DropIndex(
                name: "IX_transactions_related_room_id",
                table: "transactions");

            migrationBuilder.DropColumn(
                name: "related_room_id",
                table: "transactions");
        }
    }
}
