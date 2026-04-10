using Microsoft.AspNetCore.Mvc;
using NhaTro.Dtos.Rooms;
using NhaTro.Interfaces.Services;

namespace NhaTro.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class RoomsController : ControllerBase
    {
        private readonly IRoomService _roomService;

        public RoomsController(IRoomService roomService)
        {
            _roomService = roomService;
        }

        [HttpGet]
        public async Task<IActionResult> GetAll([FromQuery] string? status = null)
        {
            try
            {
                var rooms = await _roomService.GetAllAsync(status);
                return Ok(rooms);
            }
            catch (ArgumentException ex)
            {
                return BadRequest(new { message = ex.Message });
            }
        }

        [HttpGet("{id:int}")]
        public async Task<IActionResult> GetById(int id)
        {
            var room = await _roomService.GetByIdAsync(id);

            if (room == null)
            {
                return NotFound(new { message = "Không tìm thấy phòng." });
            }

            return Ok(room);
        }

        [HttpPost]
        public async Task<IActionResult> Create([FromBody] CreateRoomDto dto)
        {
            try
            {
                var createdRoom = await _roomService.CreateAsync(dto);
                return CreatedAtAction(nameof(GetById), new { id = createdRoom.RoomId }, createdRoom);
            }
            catch (InvalidOperationException ex)
            {
                return Conflict(new { message = ex.Message });
            }
            catch (ArgumentException ex)
            {
                return BadRequest(new { message = ex.Message });
            }
        }

        [HttpPut("{id:int}")]
        public async Task<IActionResult> Update(int id, [FromBody] UpdateRoomDto dto)
        {
            try
            {
                var updatedRoom = await _roomService.UpdateAsync(id, dto);

                if (updatedRoom == null)
                {
                    return NotFound(new { message = "Không tìm thấy phòng." });
                }

                return Ok(updatedRoom);
            }
            catch (InvalidOperationException ex)
            {
                return Conflict(new { message = ex.Message });
            }
            catch (ArgumentException ex)
            {
                return BadRequest(new { message = ex.Message });
            }
        }

        [HttpPatch("{id:int}/status")]
        public async Task<IActionResult> UpdateStatus(int id, [FromBody] UpdateRoomStatusDto dto)
        {
            try
            {
                var updatedRoom = await _roomService.UpdateStatusAsync(id, dto);

                if (updatedRoom == null)
                {
                    return NotFound(new { message = "Không tìm thấy phòng." });
                }

                return Ok(updatedRoom);
            }
            catch (ArgumentException ex)
            {
                return BadRequest(new { message = ex.Message });
            }
        }
        [HttpGet("by-code/{roomCode}")]
        public async Task<IActionResult> GetByRoomCode(string roomCode)
        {
            try
            {
                var room = await _roomService.GetByRoomCodeAsync(roomCode);

                if (room == null)
                    return NotFound(new { message = "Không tìm thấy phòng." });

                return Ok(room);
            }
            catch (Exception ex)
            {
                return BadRequest(new { message = ex.Message });
            }
        }
    }
}