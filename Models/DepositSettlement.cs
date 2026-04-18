using System.ComponentModel.DataAnnotations.Schema;

namespace NhaTro.Models
{
    public class DepositSettlement
    {
        public int DepositSettlementId { get; set; }

        public int? ContractId { get; set; }

        [Column(TypeName = "decimal(18,2)")]
        public decimal DepositAmount { get; set; }

        [Column(TypeName = "decimal(18,2)")]
        public decimal FinalInvoiceAmount { get; set; }

        [Column(TypeName = "decimal(18,2)")]
        public decimal DeductedAmount { get; set; }

        [Column(TypeName = "decimal(18,2)")]
        public decimal RefundedAmount { get; set; }

        public DateTime SettledAt { get; set; } = DateTime.UtcNow;

        public string? Note { get; set; }

        public string? ContractSnapshotJson { get; set; }

        public Contract? Contract { get; set; }
    }
}
