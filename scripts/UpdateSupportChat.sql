BEGIN TRANSACTION;
IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260805053750_AddSupportChat'
)
BEGIN
    CREATE TABLE [support_conversations] (
        [support_conversation_id] int NOT NULL IDENTITY,
        [admin_user_id] int NOT NULL,
        [created_at] datetime2 NOT NULL,
        [updated_at] datetime2 NOT NULL,
        [last_message_at] datetime2 NULL,
        CONSTRAINT [PK_support_conversations] PRIMARY KEY ([support_conversation_id]),
        CONSTRAINT [FK_support_conversations_users_admin_user_id] FOREIGN KEY ([admin_user_id]) REFERENCES [users] ([Id]) ON DELETE NO ACTION
    );
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260805053750_AddSupportChat'
)
BEGIN
    CREATE TABLE [support_messages] (
        [support_message_id] int NOT NULL IDENTITY,
        [support_conversation_id] int NOT NULL,
        [sender_user_id] int NOT NULL,
        [content] nvarchar(2000) NOT NULL,
        [sent_at] datetime2 NOT NULL,
        [read_at] datetime2 NULL,
        CONSTRAINT [PK_support_messages] PRIMARY KEY ([support_message_id]),
        CONSTRAINT [FK_support_messages_support_conversations_support_conversation_id] FOREIGN KEY ([support_conversation_id]) REFERENCES [support_conversations] ([support_conversation_id]) ON DELETE CASCADE,
        CONSTRAINT [FK_support_messages_users_sender_user_id] FOREIGN KEY ([sender_user_id]) REFERENCES [users] ([Id]) ON DELETE NO ACTION
    );
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260805053750_AddSupportChat'
)
BEGIN
    CREATE UNIQUE INDEX [IX_support_conversations_admin_user_id] ON [support_conversations] ([admin_user_id]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260805053750_AddSupportChat'
)
BEGIN
    CREATE INDEX [IX_support_conversations_last_message_at] ON [support_conversations] ([last_message_at]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260805053750_AddSupportChat'
)
BEGIN
    CREATE INDEX [IX_support_messages_sender_user_id] ON [support_messages] ([sender_user_id]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260805053750_AddSupportChat'
)
BEGIN
    CREATE INDEX [IX_support_messages_support_conversation_id_read_at] ON [support_messages] ([support_conversation_id], [read_at]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260805053750_AddSupportChat'
)
BEGIN
    CREATE INDEX [IX_support_messages_support_conversation_id_support_message_id] ON [support_messages] ([support_conversation_id], [support_message_id]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260805053750_AddSupportChat'
)
BEGIN
    INSERT INTO [__EFMigrationsHistory] ([MigrationId], [ProductVersion])
    VALUES (N'20260805053750_AddSupportChat', N'9.0.17');
END;

COMMIT;
GO

