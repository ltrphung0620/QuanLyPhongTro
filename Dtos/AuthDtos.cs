using System;
using System.Collections.Generic;
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

    public class AdminOrganizationInputDto
    {
        [Required]
        public int OrganizationId { get; set; }
        public bool HasFullAccess { get; set; } = true;
        public List<string> PagePermissions { get; set; } = new();
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

        public bool HasFullAccess { get; set; } = true;

        public List<string> PagePermissions { get; set; } = new();

        public List<AdminOrganizationInputDto> Memberships { get; set; } = new();
    }

    public class UpdateAdminPermissionsDto
    {
        public bool HasFullAccess { get; set; } = true;

        public List<string> PagePermissions { get; set; } = new();
    }

    public class UpdateAdminProfileDto
    {
        [Required]
        [MaxLength(255)]
        public string Username { get; set; } = string.Empty;

        [Required]
        [EmailAddress]
        [MaxLength(255)]
        public string Email { get; set; } = string.Empty;

        [Required]
        [MaxLength(255)]
        public string DisplayName { get; set; } = string.Empty;

        public bool IsActive { get; set; }

        public List<AdminOrganizationInputDto> Memberships { get; set; } = new();
    }

    public class ResetPasswordDto
    {
        [Required]
        [MinLength(6)]
        public string NewPassword { get; set; } = string.Empty;
    }

    public class UserOrganizationDto
    {
        public int Id { get; set; }
        public string Name { get; set; } = string.Empty;
        public string Code { get; set; } = string.Empty;
        public bool IsActive { get; set; }
        public bool HasFullAccess { get; set; }
        public List<string> PagePermissions { get; set; } = new();
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
        public bool HasFullAccess { get; set; }
        public List<string> PagePermissions { get; set; } = new();
        public List<UserOrganizationDto> Organizations { get; set; } = new();
        public UserOrganizationDto? ActiveOrganization { get; set; }
    }
}
