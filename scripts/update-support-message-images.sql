BEGIN TRANSACTION;
IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260809151952_AddSupportMessageImages'
)
BEGIN
    ALTER TABLE [support_messages] ADD [image_path] nvarchar(500) NULL;
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260809151952_AddSupportMessageImages'
)
BEGIN
    INSERT INTO [__EFMigrationsHistory] ([MigrationId], [ProductVersion])
    VALUES (N'20260809151952_AddSupportMessageImages', N'9.0.17');
END;

COMMIT;
GO

