using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace NhaTro.Migrations
{
    /// <inheritdoc />
    public partial class AddSupportMessageImages : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "image_path",
                table: "support_messages",
                type: "nvarchar(500)",
                maxLength: 500,
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "image_path",
                table: "support_messages");
        }
    }
}
