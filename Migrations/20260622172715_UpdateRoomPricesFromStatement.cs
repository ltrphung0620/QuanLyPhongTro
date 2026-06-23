using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace NhaTro.Migrations
{
    /// <inheritdoc />
    public partial class UpdateRoomPricesFromStatement : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(@"
DECLARE @AppUserId INT = 4;

DECLARE @Prices TABLE (
    RoomCode NVARCHAR(50) NOT NULL PRIMARY KEY,
    Price DECIMAL(18,2) NOT NULL
);

INSERT INTO @Prices (RoomCode, Price) VALUES
(N'A1', 2300000.00),
(N'A2', 2500000.00),
(N'A3', 2200000.00),
(N'A5', 2500000.00),
(N'A6', 2500000.00),
(N'A7', 2300000.00),
(N'A8', 2500000.00),
(N'B1', 2300000.00),
(N'B2', 2500000.00),
(N'B3', 2200000.00),
(N'B4', 2800000.00),
(N'B5', 2500000.00),
(N'B6', 2300000.00),
(N'B7', 2500000.00),
(N'B8', 2600000.00),
(N'Kios 110/2A', 2800000.00),
(N'Kios 110/2B', 3000000.00);

UPDATE r
SET r.listed_price = p.Price,
    r.updated_at = GETUTCDATE()
FROM rooms r
INNER JOIN @Prices p ON p.RoomCode = r.room_code
WHERE r.AppUserId = @AppUserId;

-- Existing invoices keep their historical amount. Future invoices use the
-- updated price from the current active contract.
UPDATE c
SET c.actual_room_price = p.Price,
    c.updated_at = GETUTCDATE()
FROM contracts c
INNER JOIN rooms r ON r.room_id = c.room_id
INNER JOIN @Prices p ON p.RoomCode = r.room_code
WHERE r.AppUserId = @AppUserId
  AND c.status = 'active'
  AND c.is_archived = 0;
");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(@"
DECLARE @AppUserId INT = 4;

DECLARE @Prices TABLE (
    RoomCode NVARCHAR(50) NOT NULL PRIMARY KEY,
    Price DECIMAL(18,2) NOT NULL
);

INSERT INTO @Prices (RoomCode, Price) VALUES
(N'A1', 2500000.00),
(N'A2', 2500000.00),
(N'A3', 2000000.00),
(N'A5', 5000000.00),
(N'A6', 2500000.00),
(N'A7', 2500000.00),
(N'A8', 2500000.00),
(N'B1', 2000000.00),
(N'B2', 2000000.00),
(N'B3', 2000000.00),
(N'B4', 2000000.00),
(N'B5', 2000000.00),
(N'B6', 2000000.00),
(N'B7', 2000000.00),
(N'B8', 2000000.00),
(N'Kios 110/2A', 3500000.00),
(N'Kios 110/2B', 3500000.00);

UPDATE r
SET r.listed_price = p.Price,
    r.updated_at = GETUTCDATE()
FROM rooms r
INNER JOIN @Prices p ON p.RoomCode = r.room_code
WHERE r.AppUserId = @AppUserId;

UPDATE c
SET c.actual_room_price = p.Price,
    c.updated_at = GETUTCDATE()
FROM contracts c
INNER JOIN rooms r ON r.room_id = c.room_id
INNER JOIN @Prices p ON p.RoomCode = r.room_code
WHERE r.AppUserId = @AppUserId
  AND c.status = 'active'
  AND c.is_archived = 0;
");
        }
    }
}
