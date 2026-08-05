using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace NhaTro.Migrations
{
    /// <inheritdoc />
    public partial class AddSupportChat : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "support_conversations",
                columns: table => new
                {
                    support_conversation_id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    admin_user_id = table.Column<int>(type: "int", nullable: false),
                    created_at = table.Column<DateTime>(type: "datetime2", nullable: false),
                    updated_at = table.Column<DateTime>(type: "datetime2", nullable: false),
                    last_message_at = table.Column<DateTime>(type: "datetime2", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_support_conversations", x => x.support_conversation_id);
                    table.ForeignKey(
                        name: "FK_support_conversations_users_admin_user_id",
                        column: x => x.admin_user_id,
                        principalTable: "users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "support_messages",
                columns: table => new
                {
                    support_message_id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    support_conversation_id = table.Column<int>(type: "int", nullable: false),
                    sender_user_id = table.Column<int>(type: "int", nullable: false),
                    content = table.Column<string>(type: "nvarchar(2000)", maxLength: 2000, nullable: false),
                    sent_at = table.Column<DateTime>(type: "datetime2", nullable: false),
                    read_at = table.Column<DateTime>(type: "datetime2", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_support_messages", x => x.support_message_id);
                    table.ForeignKey(
                        name: "FK_support_messages_support_conversations_support_conversation_id",
                        column: x => x.support_conversation_id,
                        principalTable: "support_conversations",
                        principalColumn: "support_conversation_id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_support_messages_users_sender_user_id",
                        column: x => x.sender_user_id,
                        principalTable: "users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "IX_support_conversations_admin_user_id",
                table: "support_conversations",
                column: "admin_user_id",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_support_conversations_last_message_at",
                table: "support_conversations",
                column: "last_message_at");

            migrationBuilder.CreateIndex(
                name: "IX_support_messages_sender_user_id",
                table: "support_messages",
                column: "sender_user_id");

            migrationBuilder.CreateIndex(
                name: "IX_support_messages_support_conversation_id_read_at",
                table: "support_messages",
                columns: new[] { "support_conversation_id", "read_at" });

            migrationBuilder.CreateIndex(
                name: "IX_support_messages_support_conversation_id_support_message_id",
                table: "support_messages",
                columns: new[] { "support_conversation_id", "support_message_id" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "support_messages");

            migrationBuilder.DropTable(
                name: "support_conversations");
        }
    }
}
