using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Elpis_CRM.Model
{
    [Table("CallLog")]
    public class CallLogModel
    {
        [Key]
        [DatabaseGenerated(DatabaseGeneratedOption.Identity)]
        public int CallLogId { get; set; }

        [StringLength(100)]
        public string? CallOwner { get; set; }

        public DateTime? CreatedAt { get; set; }

        [StringLength(50)]
        public string? CallDirection { get; set; }

        [StringLength(50)]
        public string? CallStatus { get; set; }

        public TimeSpan? CallDuration { get; set; }

        public string? Outcome { get; set; }

        [StringLength(50)]
        public string? Phone { get; set; }

        [StringLength(100)]
        public string? CallType { get; set; }

        public string? Notes { get; set; }

        [StringLength(100)]
        public string? AssociatedWithCall { get; set; }

        // Foreign Keys
        public long? ContactId { get; set; }

        public long? AccountId { get; set; }

        public long? DealId { get; set; }
    }
}