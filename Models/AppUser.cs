using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace NhaTro.Models
{
    [Table("users")]
    public class AppUser
    {
        public int Id { get; set; }

        [Required]
        [MaxLength(255)]
        public string Username { get; set; } = string.Empty;

        [Required]
        [EmailAddress]
        [MaxLength(255)]
        public string Email { get; set; } = string.Empty;

        [Required]
        [MaxLength(255)]
        public string PasswordHash { get; set; } = string.Empty;

        [Required]
        [MaxLength(255)]
        public string DisplayName { get; set; } = string.Empty;

        [Required]
        [MaxLength(50)]
        public string Role { get; set; } = string.Empty; // SuperAdmin, Admin, Tenant

        public int? OrganizationId { get; set; }
        public Organization? Organization { get; set; }

        public int? TenantId { get; set; }
        public Tenant? Tenant { get; set; }

        public bool IsActive { get; set; } = false;

        public bool MustChangePassword { get; set; } = false;

        [MaxLength(6)]
        public string? OtpCode { get; set; }

        public DateTime? OtpExpiryTime { get; set; }

        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

        public DateTime? LastLoginAt { get; set; }

        // Navigation properties for Multi-tenancy
        public ICollection<Room> Rooms { get; set; } = new List<Room>();
        public ICollection<Tenant> Tenants { get; set; } = new List<Tenant>();
        public ICollection<Contract> Contracts { get; set; } = new List<Contract>();
        public ICollection<MeterReading> MeterReadings { get; set; } = new List<MeterReading>();
        public ICollection<Invoice> Invoices { get; set; } = new List<Invoice>();
        public ICollection<DepositSettlement> DepositSettlements { get; set; } = new List<DepositSettlement>();
        public ICollection<Transaction> Transactions { get; set; } = new List<Transaction>();
        public ICollection<PaymentTransaction> PaymentTransactions { get; set; } = new List<PaymentTransaction>();
        public ICollection<EmailNotification> EmailNotifications { get; set; } = new List<EmailNotification>();
        public ICollection<SystemSetting> SystemSettings { get; set; } = new List<SystemSetting>();
    }
}
