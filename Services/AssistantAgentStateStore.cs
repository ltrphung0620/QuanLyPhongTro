using System.Collections.Concurrent;
using NhaTro.Dtos.Assistant;

namespace NhaTro.Services
{
    public class AssistantAgentStateStore
    {
        private static readonly TimeSpan Lifetime = TimeSpan.FromMinutes(30);
        private readonly ConcurrentDictionary<int, PendingAssistantAgentState> _items = new();

        public void Set(int userId, AssistantAgentPlanDto plan, AssistantAgentExecutionDto execution, int nextStepNumber, string originalMessage)
        {
            _items[userId] = new PendingAssistantAgentState
            {
                UserId = userId,
                Plan = plan,
                Execution = execution,
                NextStepNumber = nextStepNumber,
                OriginalMessage = originalMessage,
                UpdatedAt = DateTime.UtcNow
            };
        }

        public bool TryGet(int userId, out PendingAssistantAgentState? state)
        {
            state = null;
            if (!_items.TryGetValue(userId, out var existing))
            {
                return false;
            }

            if (DateTime.UtcNow - existing.UpdatedAt > Lifetime)
            {
                _items.TryRemove(userId, out _);
                return false;
            }

            state = existing;
            return true;
        }

        public void Clear(int userId)
        {
            _items.TryRemove(userId, out _);
        }
    }

    public class PendingAssistantAgentState
    {
        public int UserId { get; set; }
        public AssistantAgentPlanDto Plan { get; set; } = new();
        public AssistantAgentExecutionDto Execution { get; set; } = new();
        public int NextStepNumber { get; set; } = 1;
        public string OriginalMessage { get; set; } = string.Empty;
        public DateTime UpdatedAt { get; set; }
    }
}
