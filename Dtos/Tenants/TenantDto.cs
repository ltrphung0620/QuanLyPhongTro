namespace NhaTro.Dtos.Tenants
{
    public class TenantDto
    {
        public int TenantId { get; set; }
        public string FullName { get; set; } = string.Empty;
        public string? Phone { get; set; }
        public string? CCCD { get; set; }
        public DateTime CreatedAt { get; set; }
        public DateTime UpdatedAt { get; set; }
    }
}