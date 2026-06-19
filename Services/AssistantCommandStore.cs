using System.Collections.Concurrent;
using NhaTro.Dtos.Assistant;

namespace NhaTro.Services
{
    public class AssistantCommandStore
    {
        private readonly ConcurrentDictionary<string, PendingAssistantCommand> _commands = new();

        public string AddCommand(int userId, AssistantCommandDto command)
        {
            var commandId = Guid.NewGuid().ToString("N");
            _commands[commandId] = new PendingAssistantCommand
            {
                CommandId = commandId,
                UserId = userId,
                Command = command,
                CreatedAt = DateTime.UtcNow
            };

            return commandId;
        }

        public bool TryTake(string commandId, int userId, out PendingAssistantCommand? command)
        {
            command = null;
            if (!_commands.TryGetValue(commandId, out var existing))
            {
                return false;
            }

            if (existing.UserId != userId)
            {
                return false;
            }

            if (DateTime.UtcNow - existing.CreatedAt > TimeSpan.FromMinutes(10))
            {
                _commands.TryRemove(commandId, out _);
                return false;
            }

            return _commands.TryRemove(commandId, out command);
        }
    }

    public class PendingAssistantCommand
    {
        public string CommandId { get; set; } = string.Empty;
        public int UserId { get; set; }
        public AssistantCommandDto Command { get; set; } = new();
        public DateTime CreatedAt { get; set; }
    }
}
