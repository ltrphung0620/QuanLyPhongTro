namespace NhaTro.Services
{
    public class AssistantActionDefinition
    {
        public string Intent { get; init; } = string.Empty;
        public string Description { get; init; } = string.Empty;
        public string[] RequiredFields { get; init; } = Array.Empty<string>();
        public string[] OptionalFields { get; init; } = Array.Empty<string>();
        public bool RequiresConfirmation { get; init; }
        public bool CanExecute { get; init; } = true;
        public string[] Examples { get; init; } = Array.Empty<string>();
    }
}
