using System;
using System.ComponentModel.DataAnnotations;

namespace NhaTro.Dtos
{
    public class RegisterDto
    {
        [Required]
        [EmailAddress]
        public string Email { get; set; } = string.Empty;

        [Required]
        [MinLength(6)]
        public string Password { get; set; } = string.Empty;
    }

    public class VerifyOtpDto
    {
        [Required]
        [EmailAddress]
        public string Email { get; set; } = string.Empty;

        [Required]
        [StringLength(6, MinimumLength = 6)]
        public string OtpCode { get; set; } = string.Empty;
    }

    public class LoginDto
    {
        [Required]
        public string Email { get; set; } = string.Empty; // Holds email or username

        [Required]
        public string Password { get; set; } = string.Empty;
    }

    public class AuthResponseDto
    {
        public string Token { get; set; } = string.Empty;
        public string Email { get; set; } = string.Empty;
        public int UserId { get; set; }
    }

    public class ChangePasswordDto
    {
        [Required]
        public string OldPassword { get; set; } = string.Empty;

        [Required]
        [MinLength(6)]
        public string NewPassword { get; set; } = string.Empty;
    }

    public class CreateOrganizationDto
    {
        [Required]
        [MaxLength(255)]
        public string Name { get; set; } = string.Empty;

        [Required]
        [MaxLength(50)]
        public string Code { get; set; } = string.Empty;

        [MaxLength(255)]
        public string? OwnerName { get; set; }

        [MaxLength(20)]
        public string? Phone { get; set; }

        [MaxLength(255)]
        [EmailAddress]
        public string? Email { get; set; }

        [MaxLength(500)]
        public string? Address { get; set; }
    }

    public class CreateAdminDto
    {
        [Required]
        [MaxLength(255)]
        public string Username { get; set; } = string.Empty;

        [Required]
        [EmailAddress]
        [MaxLength(255)]
        public string Email { get; set; } = string.Empty;

        [Required]
        [MinLength(6)]
        [MaxLength(255)]
        public string Password { get; set; } = string.Empty;

        [Required]
        [MaxLength(255)]
        public string DisplayName { get; set; } = string.Empty;
    }

    public class ResetPasswordDto
    {
        [Required]
        [MinLength(6)]
        public string NewPassword { get; set; } = string.Empty;
    }

    public class UserProfileDto
    {
        public int Id { get; set; }
        public string Username { get; set; } = string.Empty;
        public string Email { get; set; } = string.Empty;
        public string DisplayName { get; set; } = string.Empty;
        public string Role { get; set; } = string.Empty;
        public int? OrganizationId { get; set; }
        public int? TenantId { get; set; }
        public bool MustChangePassword { get; set; }
        public bool IsActive { get; set; }
        public DateTime? LastLoginAt { get; set; }
    }
}
