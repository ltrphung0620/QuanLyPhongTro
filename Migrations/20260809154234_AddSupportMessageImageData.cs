using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace NhaTro.Migrations
{
    /// <inheritdoc />
    public partial class AddSupportMessageImageData : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "image_data",
                table: "support_messages",
                type: "nvarchar(max)",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "image_data",
                table: "support_messages");
        }
    }
}
