using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using NhaTro.Data;
using NhaTro.Dtos.Support;
using NhaTro.Interfaces.Services;
using NhaTro.Models;

namespace NhaTro.Controllers
{
    [Route("api/support")]
    [ApiController]
    [Authorize(Roles = "Admin,SuperAdmin")]
    public class SupportController : ControllerBase
    {
        private readonly NhaTroDbContext _context;
        private readonly ICurrentUserService _currentUser;
        private readonly IRealtimeService _realtime;
        private readonly IWebHostEnvironment _environment;
        private static readonly HashSet<string> AllowedImageExtensions = new(StringComparer.OrdinalIgnoreCase)
        {
            ".jpg", ".jpeg", ".png", ".webp"
        };
        private const long MaxImageSizeBytes = 5 * 1024 * 1024;

        public SupportController(
            NhaTroDbContext context,
            ICurrentUserService currentUser,
            IRealtimeService realtime,
            IWebHostEnvironment environment)
        {
            _context = context;
            _currentUser = currentUser;
            _realtime = realtime;
            _environment = environment;
        }

        [HttpGet("conversation")]
        public async Task<ActionResult<SupportConversationDto>> GetMyConversation()
        {
            if (!IsAdmin()) return Forbid();

            var conversation = await GetOrCreateAdminConversationAsync(_currentUser.UserId);
            return Ok(await BuildConversationDtoAsync(conversation, forSuperAdmin: false));
        }

        [HttpGet("conversations")]
        public async Task<ActionResult<List<SupportConversationDto>>> GetConversations()
        {
            if (!IsSuperAdmin()) return Forbid();

            var rows = await _context.SupportConversations
                .AsNoTracking()
                .Select(conversation => new
                {
                    Conversation = conversation,
                    LastMessage = conversation.Messages
                        .OrderByDescending(message => message.SupportMessageId)
                        .Select(message => string.IsNullOrEmpty(message.Content) ? "[Ảnh]" : message.Content)
                        .FirstOrDefault(),
                    UnreadCount = conversation.Messages.Count(message =>
                        message.SenderUserId == conversation.AdminUserId && message.ReadAt == null)
                })
                .OrderByDescending(x => x.Conversation.LastMessageAt ?? x.Conversation.CreatedAt)
                .ToListAsync();

            var adminIds = rows.Select(x => x.Conversation.AdminUserId).Distinct().ToList();
            var admins = await _context.Users
                .IgnoreQueryFilters()
                .AsNoTracking()
                .Where(user => adminIds.Contains(user.Id))
                .ToDictionaryAsync(user => user.Id);

            var memberships = await _context.AdminOrganizationMemberships
                .AsNoTracking()
                .Include(membership => membership.Organization)
                .Where(membership => adminIds.Contains(membership.UserId) && membership.IsActive)
                .ToListAsync();

            return Ok(rows.Select(row =>
            {
                admins.TryGetValue(row.Conversation.AdminUserId, out var admin);
                return new SupportConversationDto
                {
                    SupportConversationId = row.Conversation.SupportConversationId,
                    AdminUserId = row.Conversation.AdminUserId,
                    AdminName = admin?.DisplayName ?? admin?.Username ?? "Admin",
                    AdminEmail = admin?.Email ?? string.Empty,
                    OrganizationNames = memberships
                        .Where(membership => membership.UserId == row.Conversation.AdminUserId)
                        .Select(membership => membership.Organization.Name)
                        .Distinct()
                        .OrderBy(name => name)
                        .ToList(),
                    LastMessage = row.LastMessage,
                    LastMessageAt = row.Conversation.LastMessageAt,
                    UnreadCount = row.UnreadCount
                };
            }).ToList());
        }

        [HttpGet("conversations/{conversationId:int}/messages")]
        public async Task<ActionResult<SupportMessagePageDto>> GetMessages(
            int conversationId,
            [FromQuery] int? beforeId = null,
            [FromQuery] int take = 50)
        {
            var conversation = await FindAuthorizedConversationAsync(conversationId);
            if (conversation == null) return NotFound(new { message = "Không tìm thấy hội thoại hỗ trợ." });

            var currentUserId = _currentUser.UserId;
            var unreadMessages = await _context.SupportMessages
                .Where(message => message.SupportConversationId == conversationId &&
                                  message.SenderUserId != currentUserId &&
                                  message.ReadAt == null)
                .ToListAsync();

            if (unreadMessages.Count > 0)
            {
                var readAt = DateTime.UtcNow;
                foreach (var message in unreadMessages) message.ReadAt = readAt;
                await _context.SaveChangesAsync();
            }

            take = Math.Clamp(take, 1, 100);
            var query = _context.SupportMessages
                .AsNoTracking()
                .Where(message => message.SupportConversationId == conversationId);

            if (beforeId.HasValue)
            {
                query = query.Where(message => message.SupportMessageId < beforeId.Value);
            }

            var messages = await query
                .OrderByDescending(message => message.SupportMessageId)
                .Take(take + 1)
                .ToListAsync();

            var hasMore = messages.Count > take;
            messages = messages.Take(take).OrderBy(message => message.SupportMessageId).ToList();

            return Ok(new SupportMessagePageDto
            {
                Items = await MapMessagesAsync(messages),
                HasMore = hasMore
            });
        }

        [HttpPost("conversations/{conversationId:int}/messages")]
        public async Task<ActionResult<SupportMessageDto>> SendMessage(
            int conversationId,
            [FromForm] SendSupportMessageDto dto)
        {
            if (!ModelState.IsValid) return ValidationProblem(ModelState);

            var conversation = await FindAuthorizedConversationAsync(conversationId);
            if (conversation == null) return NotFound(new { message = "Không tìm thấy hội thoại hỗ trợ." });

            var content = dto.Content?.Trim() ?? string.Empty;
            if (content.Length == 0 && dto.Image == null)
            {
                return BadRequest(new { message = "Nội dung hoặc ảnh đính kèm không được để trống." });
            }

            string? imagePath;
            try
            {
                imagePath = await SaveImageAsync(dto.Image);
            }
            catch (ArgumentException ex)
            {
                return BadRequest(new { message = ex.Message });
            }

            var now = DateTime.UtcNow;
            var message = new SupportMessage
            {
                SupportConversationId = conversationId,
                SenderUserId = _currentUser.UserId,
                Content = content,
                ImagePath = imagePath,
                SentAt = now
            };

            conversation.LastMessageAt = now;
            conversation.UpdatedAt = now;
            _context.SupportMessages.Add(message);
            await _context.SaveChangesAsync();

            var messageDto = (await MapMessagesAsync(new List<SupportMessage> { message })).Single();
            var payload = new
            {
                conversationId,
                adminUserId = conversation.AdminUserId,
                message = messageDto
            };

            await Task.WhenAll(
                _realtime.PublishToRoleAsync("SuperAdmin", "support.message.created", payload, "support"),
                _realtime.PublishToUserAsync(conversation.AdminUserId, "support.message.created", payload, "support"));

            return Ok(messageDto);
        }

        private async Task<SupportConversation> GetOrCreateAdminConversationAsync(int adminUserId)
        {
            var conversation = await _context.SupportConversations
                .FirstOrDefaultAsync(item => item.AdminUserId == adminUserId);

            if (conversation != null) return conversation;

            conversation = new SupportConversation
            {
                AdminUserId = adminUserId,
                CreatedAt = DateTime.UtcNow,
                UpdatedAt = DateTime.UtcNow
            };
            _context.SupportConversations.Add(conversation);
            await _context.SaveChangesAsync();
            return conversation;
        }

        private async Task<SupportConversation?> FindAuthorizedConversationAsync(int conversationId)
        {
            var conversation = await _context.SupportConversations
                .FirstOrDefaultAsync(item => item.SupportConversationId == conversationId);

            if (conversation == null) return null;
            if (IsSuperAdmin()) return conversation;
            return IsAdmin() && conversation.AdminUserId == _currentUser.UserId ? conversation : null;
        }

        private async Task<SupportConversationDto> BuildConversationDtoAsync(
            SupportConversation conversation,
            bool forSuperAdmin)
        {
            var admin = await _context.Users
                .IgnoreQueryFilters()
                .AsNoTracking()
                .FirstAsync(user => user.Id == conversation.AdminUserId);

            var organizations = await _context.AdminOrganizationMemberships
                .AsNoTracking()
                .Include(membership => membership.Organization)
                .Where(membership => membership.UserId == conversation.AdminUserId && membership.IsActive)
                .Select(membership => membership.Organization.Name)
                .Distinct()
                .OrderBy(name => name)
                .ToListAsync();

            var lastMessage = await _context.SupportMessages
                .AsNoTracking()
                .Where(message => message.SupportConversationId == conversation.SupportConversationId)
                .OrderByDescending(message => message.SupportMessageId)
                .Select(message => string.IsNullOrEmpty(message.Content) ? "[Ảnh]" : message.Content)
                .FirstOrDefaultAsync();

            var unreadCount = await _context.SupportMessages
                .AsNoTracking()
                .CountAsync(message => message.SupportConversationId == conversation.SupportConversationId &&
                                       message.ReadAt == null &&
                                       (forSuperAdmin
                                           ? message.SenderUserId == conversation.AdminUserId
                                           : message.SenderUserId != conversation.AdminUserId));

            return new SupportConversationDto
            {
                SupportConversationId = conversation.SupportConversationId,
                AdminUserId = conversation.AdminUserId,
                AdminName = admin.DisplayName ?? admin.Username,
                AdminEmail = admin.Email,
                OrganizationNames = organizations,
                LastMessage = lastMessage,
                LastMessageAt = conversation.LastMessageAt,
                UnreadCount = unreadCount
            };
        }

        private async Task<List<SupportMessageDto>> MapMessagesAsync(List<SupportMessage> messages)
        {
            var userIds = messages.Select(message => message.SenderUserId).Distinct().ToList();
            var users = await _context.Users
                .IgnoreQueryFilters()
                .AsNoTracking()
                .Where(user => userIds.Contains(user.Id))
                .ToDictionaryAsync(user => user.Id);

            return messages.Select(message =>
            {
                users.TryGetValue(message.SenderUserId, out var sender);
                return new SupportMessageDto
                {
                    SupportMessageId = message.SupportMessageId,
                    SupportConversationId = message.SupportConversationId,
                    SenderUserId = message.SenderUserId,
                    SenderName = sender?.DisplayName ?? sender?.Username ?? "Người dùng",
                    SenderRole = sender?.Role ?? string.Empty,
                    Content = message.Content,
                    ImagePath = message.ImagePath,
                    SentAt = message.SentAt,
                    ReadAt = message.ReadAt,
                    IsMine = message.SenderUserId == _currentUser.UserId
                };
            }).ToList();
        }

        private bool IsAdmin() => string.Equals(_currentUser.Role, "Admin", StringComparison.OrdinalIgnoreCase);
        private bool IsSuperAdmin() => string.Equals(_currentUser.Role, "SuperAdmin", StringComparison.OrdinalIgnoreCase);

        private async Task<string?> SaveImageAsync(IFormFile? image)
        {
            if (image == null) return null;
            if (image.Length == 0) throw new ArgumentException("Ảnh đính kèm không hợp lệ.");
            if (image.Length > MaxImageSizeBytes) throw new ArgumentException("Ảnh đính kèm tối đa 5 MB.");

            var extension = Path.GetExtension(image.FileName);
            if (string.IsNullOrWhiteSpace(extension) || !AllowedImageExtensions.Contains(extension) ||
                !image.ContentType.StartsWith("image/", StringComparison.OrdinalIgnoreCase))
            {
                throw new ArgumentException("Chỉ hỗ trợ ảnh JPG, PNG hoặc WEBP.");
            }

            var webRootPath = _environment.WebRootPath;
            if (string.IsNullOrWhiteSpace(webRootPath))
            {
                webRootPath = Path.Combine(_environment.ContentRootPath, "wwwroot");
            }

            var uploadDirectory = Path.Combine(webRootPath, "uploads", "support");
            Directory.CreateDirectory(uploadDirectory);
            var fileName = $"{Guid.NewGuid():N}{extension.ToLowerInvariant()}";
            var filePath = Path.Combine(uploadDirectory, fileName);
            await using var stream = System.IO.File.Create(filePath);
            await image.CopyToAsync(stream);

            return $"uploads/support/{fileName}";
        }
    }
}
