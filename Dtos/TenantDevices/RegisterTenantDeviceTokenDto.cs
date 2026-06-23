using System.ComponentModel.DataAnnotations;

namespace NhaTro.Dtos.TenantDevices
{
    public class RegisterTenantDeviceTokenDto
    {
        [Required]
        [MaxLength(255)]
        public string ExpoPushToken { get; set; } = string.Empty;

        [MaxLength(30)]
        public string? Platform { get; set; }

        [MaxLength(120)]
        public string? DeviceName { get; set; }
    }

    public class UnregisterTenantDeviceTokenDto
    {
        [Required]
        [MaxLength(255)]
        public string ExpoPushToken { get; set; } = string.Empty;
    }
}
