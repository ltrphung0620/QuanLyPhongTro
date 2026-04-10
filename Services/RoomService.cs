using NhaTro.Dtos.Rooms;
using NhaTro.Interfaces.Repositories;
using NhaTro.Interfaces.Services;
using NhaTro.Models;

namespace NhaTro.Services
{
    public class RoomService : IRoomService
    {
        private readonly IRoomRepository _roomRepository;

        private static readonly HashSet<string> AllowedStatuses = new()
        {
            "vacant",
            "occupied"
        };

        public RoomService(IRoomRepository roomRepository)
        {
            _roomRepository = roomRepository;
        }

        public async Task<List<RoomDto>> GetAllAsync(string? status = null)
        {
            if (!string.IsNullOrWhiteSpace(status))
            {
                ValidateStatus(status);
            }

            var rooms = await _roomRepository.GetAllAsync(status);
            return rooms.Select(MapToDto).ToList();
        }

        public async Task<RoomDto?> GetByIdAsync(int roomId)
        {
            var room = await _roomRepository.GetByIdAsync(roomId);
            return room == null ? null : MapToDto(room);
        }

        public async Task<RoomDto> CreateAsync(CreateRoomDto dto)
        {
            ValidateStatus(dto.Status);

            var existingRoom = await _roomRepository.GetByRoomCodeAsync(dto.RoomCode);
            if (existingRoom != null)
            {
                throw new InvalidOperationException("Mã phòng đã tồn tại.");
            }

            var room = new Room
            {
                RoomCode = dto.RoomCode.Trim(),
                ListedPrice = dto.ListedPrice,
                Status = dto.Status.Trim().ToLower(),
                CreatedAt = DateTime.UtcNow,
                UpdatedAt = DateTime.UtcNow
            };

            await _roomRepository.AddAsync(room);
            await _roomRepository.SaveChangesAsync();

            return MapToDto(room);
        }

        public async Task<RoomDto?> UpdateAsync(int roomId, UpdateRoomDto dto)
        {
            ValidateStatus(dto.Status);

            var room = await _roomRepository.GetByIdAsync(roomId);
            if (room == null)
            {
                return null;
            }

            var existingRoom = await _roomRepository.GetByRoomCodeAsync(dto.RoomCode);
            if (existingRoom != null && existingRoom.RoomId != roomId)
            {
                throw new InvalidOperationException("Mã phòng đã tồn tại.");
            }

            room.RoomCode = dto.RoomCode.Trim();
            room.ListedPrice = dto.ListedPrice;
            room.Status = dto.Status.Trim().ToLower();
            room.UpdatedAt = DateTime.UtcNow;

            _roomRepository.Update(room);
            await _roomRepository.SaveChangesAsync();

            return MapToDto(room);
        }

        public async Task<RoomDto?> UpdateStatusAsync(int roomId, UpdateRoomStatusDto dto)
        {
            ValidateStatus(dto.Status);

            var room = await _roomRepository.GetByIdAsync(roomId);
            if (room == null)
            {
                return null;
            }

            room.Status = dto.Status.Trim().ToLower();
            room.UpdatedAt = DateTime.UtcNow;

            _roomRepository.Update(room);
            await _roomRepository.SaveChangesAsync();

            return MapToDto(room);
        }

        private static void ValidateStatus(string status)
        {
            var normalizedStatus = status.Trim().ToLower();

            if (!AllowedStatuses.Contains(normalizedStatus))
            {
                throw new ArgumentException("Status chỉ được là 'vacant' hoặc 'occupied'.");
            }
        }

        private static RoomDto MapToDto(Room room)
        {
            return new RoomDto
            {
                RoomId = room.RoomId,
                RoomCode = room.RoomCode,
                ListedPrice = room.ListedPrice,
                Status = room.Status,
                CreatedAt = room.CreatedAt,
                UpdatedAt = room.UpdatedAt
            };
        }
        public async Task<RoomDto?> GetByRoomCodeAsync(string roomCode)
        {
            if (string.IsNullOrWhiteSpace(roomCode))
                throw new ArgumentException("RoomCode không hợp lệ.");

            var room = await _roomRepository.GetByRoomCodeAsync(roomCode);

            if (room == null)
                return null;

            return MapToDto(room);
        }
    }
}