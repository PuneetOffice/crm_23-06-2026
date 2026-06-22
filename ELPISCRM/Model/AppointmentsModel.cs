using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Elpis_CRM.Model
{
    [Table("Appointments")]
    public class AppointmentsModel
    {
        [Key]
        [DatabaseGenerated(DatabaseGeneratedOption.Identity)]
        public long AppointmentId { get; set; }

        [StringLength(100)]
        public string? MeetingOwner { get; set; }

        [StringLength(100)]
        public string? UpdatedBy { get; set; }

        [StringLength(50)]
        public string? ContactEmailStatus { get; set; }

        [StringLength(100)]
        public string? ContactJobTitle { get; set; }

        [StringLength(300)]
        public string? ContactAddress { get; set; }

        [Column(TypeName = "decimal(18,2)")]
        public decimal? OpenDealsAmount { get; set; }

        [Column(TypeName = "datetime2")]
        public DateTime? FirstContacted { get; set; }

        [Column(TypeName = "datetime2")]
        public DateTime? FirstAssignedAt { get; set; }

        [StringLength(500)]
        public string? Tags { get; set; }

        [StringLength(500)]
        public string? EmailIDs { get; set; }

        [Column(TypeName = "datetime2")]
        public DateTime? CreatedAt { get; set; }

        [Column(TypeName = "datetime2")]
        public DateTime? UpdatedAt { get; set; }

        // Foreign Keys
        public long? AccountId { get; set; }

        public long? ContactId { get; set; }

    }
}