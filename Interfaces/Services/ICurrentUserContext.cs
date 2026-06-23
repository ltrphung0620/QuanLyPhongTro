namespace NhaTro.Interfaces.Services
{
    public interface ICurrentUserContext
    {
        int UserId { get; }
        string? Role { get; }
        int? OrganizationId { get; }
        int? TenantId { get; }
        bool IsAuthenticated { get; }
    }
}
