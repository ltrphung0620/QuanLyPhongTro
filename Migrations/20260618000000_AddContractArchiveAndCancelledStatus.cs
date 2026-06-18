using System;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using NhaTro.Data;

#nullable disable

namespace NhaTro.Migrations
{
    [DbContext(typeof(NhaTroDbContext))]
    [Migration("20260618000000_AddContractArchiveAndCancelledStatus")]
    public partial class AddContractArchiveAndCancelledStatus : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropCheckConstraint(
                name: "CK_contracts_status",
                table: "contracts");

            migrationBuilder.AddColumn<string>(
                name: "archive_reason",
                table: "contracts",
                type: "nvarchar(500)",
                maxLength: 500,
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "archived_at",
                table: "contracts",
                type: "datetime2",
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "is_archived",
                table: "contracts",
                type: "bit",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddCheckConstraint(
                name: "CK_contracts_status",
                table: "contracts",
                sql: "status IN ('active', 'ended', 'cancelled')");
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropCheckConstraint(
                name: "CK_contracts_status",
                table: "contracts");

            migrationBuilder.DropColumn(
                name: "archive_reason",
                table: "contracts");

            migrationBuilder.DropColumn(
                name: "archived_at",
                table: "contracts");

            migrationBuilder.DropColumn(
                name: "is_archived",
                table: "contracts");

            migrationBuilder.AddCheckConstraint(
                name: "CK_contracts_status",
                table: "contracts",
                sql: "status IN ('active', 'ended')");
        }
    }
}
