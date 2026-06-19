using System.Collections.Concurrent;
using NhaTro.Dtos.Assistant;

namespace NhaTro.Services
{
    public class AssistantConversationStore
    {
        private static readonly TimeSpan Lifetime = TimeSpan.FromMinutes(10);
        private readonly ConcurrentDictionary<int, PendingAssistantConversation> _items = new();

        public void Set(
            int userId,
            AssistantCommandDto command,
            bool isCorrectionMode = false,
            bool isValueLearningMode = false,
            string? learningField = null,
            string? learningRawValue = null)
        {
            _items[userId] = new PendingAssistantConversation
            {
                UserId = userId,
                Command = command,
                IsCorrectionMode = isCorrectionMode,
                IsValueLearningMode = isValueLearningMode,
                LearningField = learningField,
                LearningRawValue = learningRawValue,
                UpdatedAt = DateTime.UtcNow
            };
        }

        public bool TryGet(int userId, out PendingAssistantConversation? conversation)
        {
            conversation = null;
            if (!_items.TryGetValue(userId, out var existing))
            {
                return false;
            }

            if (DateTime.UtcNow - existing.UpdatedAt > Lifetime)
            {
                _items.TryRemove(userId, out _);
                return false;
            }

            conversation = existing;
            return true;
        }

        public void Clear(int userId)
        {
            _items.TryRemove(userId, out _);
        }
    }

    public class PendingAssistantConversation
    {
        public int UserId { get; set; }
        public AssistantCommandDto Command { get; set; } = new();
        public bool IsCorrectionMode { get; set; }
        public bool IsValueLearningMode { get; set; }
        public string? LearningField { get; set; }
        public string? LearningRawValue { get; set; }
        public DateTime UpdatedAt { get; set; }
    }
}
