BEGIN TRANSACTION;
IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260809154234_AddSupportMessageImageData'
)
BEGIN
    ALTER TABLE [support_messages] ADD [image_data] nvarchar(max) NULL;
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260809154234_AddSupportMessageImageData'
)
BEGIN
    INSERT INTO [__EFMigrationsHistory] ([MigrationId], [ProductVersion])
    VALUES (N'20260809154234_AddSupportMessageImageData', N'9.0.17');
END;

COMMIT;
GO

