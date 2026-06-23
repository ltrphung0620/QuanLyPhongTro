using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace NhaTro.Migrations
{
    /// <inheritdoc />
    public partial class SeedRoomsTenantsContracts : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(@"
DECLARE @AppUserId INT = 4;

-- Table variable to store seed data
DECLARE @SeedData TABLE (
    RoomCode NVARCHAR(50),
    TenantName NVARCHAR(255),
    ElectricityMay INT,
    Price DECIMAL(18,2),
    Occupants INT
);

INSERT INTO @SeedData (RoomCode, TenantName, ElectricityMay, Price, Occupants) VALUES
(N'A1', N'Em Yen', 1454, 2500000.00, 1),
(N'A2', N'Nhi & bạn', 116, 2500000.00, 2),
(N'A3', N'Kim Mai', 7283, 2000000.00, 1),
(N'A5', N'Quỳnh Nguyên', 2596, 5000000.00, 1),
(N'A6', N'Mới', 6994, 2500000.00, 1),
(N'A7', N'Phát', 1256, 2500000.00, 1),
(N'A8', N'Ha', 2622, 2500000.00, 1),
(N'B1', N'Ny anh & 1 bạn', 2860, 2000000.00, 2),
(N'B2', N'Mai', 3961, 2000000.00, 1),
(N'B3', N'2 em Thanh', 4483, 2000000.00, 2),
(N'B4', N'Tiền Giang', 9213, 2000000.00, 1),
(N'B5', N'Hồng Tươi', 1621, 2000000.00, 1),
(N'B6', N'Mai Thy + bạn', 9690, 2000000.00, 2),
(N'B7', N'Quốc và Doanh', 4224, 2000000.00, 2),
(N'B8', N'Dũng', 13780, 2000000.00, 1),
(N'Kios 110/2A', N'Anh Việt', 13777, 3500000.00, 1),
(N'Kios 110/2B', N'Gd Yen', 2401, 3500000.00, 2);

-- Loop variables
DECLARE @RoomCode NVARCHAR(50), @TenantName NVARCHAR(255), @ElectricityMay INT, @Price DECIMAL(18,2), @Occupants INT;
DECLARE @RoomId INT, @TenantId INT, @ContractId INT;

DECLARE db_cursor CURSOR FOR 
SELECT RoomCode, TenantName, ElectricityMay, Price, Occupants FROM @SeedData;

OPEN db_cursor;
FETCH NEXT FROM db_cursor INTO @RoomCode, @TenantName, @ElectricityMay, @Price, @Occupants;

WHILE @@FETCH_STATUS = 0
BEGIN
    -- 1. Get or Insert Room
    SET @RoomId = NULL;
    SELECT @RoomId = room_id FROM rooms WHERE room_code = @RoomCode AND AppUserId = @AppUserId;
    
    IF @RoomId IS NULL
    BEGIN
        INSERT INTO rooms (room_code, listed_price, status, created_at, updated_at, AppUserId)
        VALUES (@RoomCode, @Price, 'occupied', GETUTCDATE(), GETUTCDATE(), @AppUserId);
        SET @RoomId = SCOPE_IDENTITY();
    END
    ELSE
    BEGIN
        UPDATE rooms SET status = 'occupied', listed_price = @Price WHERE room_id = @RoomId;
    END

    -- 2. Insert Tenant
    INSERT INTO tenants (full_name, created_at, updated_at, AppUserId)
    VALUES (@TenantName, GETUTCDATE(), GETUTCDATE(), @AppUserId);
    SET @TenantId = SCOPE_IDENTITY();

    -- 3. Insert Contract
    INSERT INTO contracts (room_id, tenant_id, start_date, deposit_amount, deposit_paid_amount, occupant_count, actual_room_price, status, is_archived, created_at, updated_at, AppUserId)
    VALUES (@RoomId, @TenantId, '2026-05-01', @Price, @Price, @Occupants, @Price, 'active', 0, GETUTCDATE(), GETUTCDATE(), @AppUserId);
    SET @ContractId = SCOPE_IDENTITY();

    -- 4. Insert Meter Reading
    IF NOT EXISTS (SELECT 1 FROM meter_readings WHERE room_id = @RoomId AND billing_month = '2026-05-01')
    BEGIN
        INSERT INTO meter_readings (room_id, contract_id, billing_month, previous_reading, current_reading, consumed_units, unit_price, amount, created_at, AppUserId)
        VALUES (@RoomId, @ContractId, '2026-05-01', @ElectricityMay, @ElectricityMay, 0, 3500.00, 0.00, GETUTCDATE(), @AppUserId);
    END

    FETCH NEXT FROM db_cursor INTO @RoomCode, @TenantName, @ElectricityMay, @Price, @Occupants;
END;

CLOSE db_cursor;
DEALLOCATE db_cursor;
");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(@"
DECLARE @AppUserId INT = 4;

-- Delete meter readings
DELETE FROM meter_readings 
WHERE AppUserId = @AppUserId 
  AND billing_month = '2026-05-01'
  AND room_id IN (SELECT room_id FROM rooms WHERE room_code IN ('A1','A2','A3','A5','A6','A7','A8','B1','B2','B3','B4','B5','B6','B7','B8','Kios 110/2A','Kios 110/2B') AND AppUserId = @AppUserId);

-- Delete contracts
DELETE FROM contracts 
WHERE AppUserId = @AppUserId 
  AND room_id IN (SELECT room_id FROM rooms WHERE room_code IN ('A1','A2','A3','A5','A6','A7','A8','B1','B2','B3','B4','B5','B6','B7','B8','Kios 110/2A','Kios 110/2B') AND AppUserId = @AppUserId);

-- Delete tenants
DELETE FROM tenants 
WHERE AppUserId = @AppUserId 
  AND full_name IN (N'Em Yen', N'Nhi & bạn', N'Kim Mai', N'Quỳnh Nguyên', N'Mới', N'Phát', N'Ha', N'Ny anh & 1 bạn', N'Mai', N'2 em Thanh', N'Tiền Giang', N'Hồng Tươi', N'Mai Thy + bạn', N'Quốc và Doanh', N'Dũng', N'Anh Việt', N'Gd Yen');

-- Delete rooms we created
DELETE FROM rooms 
WHERE AppUserId = @AppUserId 
  AND room_code IN ('A6','A7','A8','B1','B3','B4','B5','B6','B7','B8','Kios 110/2A','Kios 110/2B');

-- Revert status of rooms that already existed
UPDATE rooms 
SET status = 'vacant' 
WHERE AppUserId = @AppUserId 
  AND room_code IN ('A1','A2','A3','A5','B2');
");
        }
    }
}
