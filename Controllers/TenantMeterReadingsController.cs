using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using NhaTro.Data;
using NhaTro.Interfaces.Services;
using System.Linq;
using System.Threading.Tasks;

namespace NhaTro.Controllers
{
    [Route("api/tenant/meter-readings")]
    [ApiController]
    [Authorize(Policy = "TenantOnly")]
    public class TenantMeterReadingsController : ControllerBase
    {
        private readonly NhaTroDbContext _context;
        private readonly ICurrentUserService _currentUserService;

        public TenantMeterReadingsController(NhaTroDbContext context, ICurrentUserService currentUserService)
        {
            _context = context;
            _currentUserService = currentUserService;
        }

        // GET /api/tenant/meter-readings
        [HttpGet]
        public async Task<IActionResult> GetMyMeterReadings()
        {
            var tenantId = _currentUserService.TenantId;
            if (!tenantId.HasValue) return Forbid();

            var readings = await _context.MeterReadings
                .AsNoTracking()
                .Where(m => m.Contract != null && m.Contract.TenantId == tenantId.Value)
                .OrderByDescending(m => m.BillingMonth)
                .Select(m => new
                {
                    m.MeterReadingId,
                    m.RoomId,
                    RoomCode = m.Room != null ? m.Room.RoomCode : string.Empty,
                    m.ContractId,
                    m.BillingMonth,
                    m.PreviousReading,
                    m.CurrentReading,
                    m.ConsumedUnits,
                    m.UnitPrice,
                    m.Amount,
                    m.MeterImagePath,
                    m.CreatedAt,
                    ReadingDate = m.CreatedAt
                })
                .ToListAsync();

            return Ok(readings);
        }

        // GET /api/tenant/meter-readings/{id}
        [HttpGet("{id:int}")]
        public async Task<IActionResult> GetMyMeterReadingDetails(int id)
        {
            var tenantId = _currentUserService.TenantId;
            if (!tenantId.HasValue) return Forbid();

            var reading = await _context.MeterReadings
                .AsNoTracking()
                .Where(m => m.MeterReadingId == id && m.Contract != null && m.Contract.TenantId == tenantId.Value)
                .Select(m => new
                {
                    m.MeterReadingId,
                    m.RoomId,
                    RoomCode = m.Room != null ? m.Room.RoomCode : string.Empty,
                    m.ContractId,
                    m.BillingMonth,
                    m.PreviousReading,
                    m.CurrentReading,
                    m.ConsumedUnits,
                    m.UnitPrice,
                    m.Amount,
                    m.MeterImagePath,
                    m.CreatedAt,
                    ReadingDate = m.CreatedAt
                })
                .FirstOrDefaultAsync();

            if (reading == null)
            {
                return NotFound(new { message = "Không tìm thấy chỉ số điện." });
            }

            return Ok(reading);
        }
    }
}
