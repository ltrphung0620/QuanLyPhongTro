using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace NhaTro.Migrations
{
    /// <inheritdoc />
    public partial class RepairInvalidMeterReadingChronology : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(@"
                DELETE mr
                FROM meter_readings mr
                INNER JOIN contracts c ON c.contract_id = mr.contract_id
                WHERE c.actual_end_date IS NOT NULL
                  AND mr.billing_month > EOMONTH(c.actual_end_date);");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {

        }
    }
}
