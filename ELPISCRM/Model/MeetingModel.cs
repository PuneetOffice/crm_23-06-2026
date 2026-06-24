using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Elpis_CRM.Model
{
    [Table("Meetings")]
    public class MeetingModel
    {
        [Key]
        [DatabaseGenerated(DatabaseGeneratedOption.Identity)]
        public int MeetingId { get; set; }

        [Required]
        [StringLength(100)]
        public string Title { get; set; } = string.Empty;

        [Column("StartTime", TypeName = "datetime2")]
        public DateTime? From { get; set; }

        [Column("EndTime", TypeName = "datetime2")]
        public DateTime? To { get; set; }

        [StringLength(100)]
        public string? TimeZone { get; set; }

        public bool? AddVideoConference { get; set; }

        [StringLength(100)]
        public string? Location { get; set; }

        public string? Description { get; set; }

        [StringLength(100)]
        public string? Outcome { get; set; }

        public string? Notes { get; set; }

        [StringLength(100)]
        public string? RelatedTo { get; set; }

        [Column(TypeName = "datetime2")]
        public DateTime? CreatedAt { get; set; }

        [Column(TypeName = "datetime2")]
        public DateTime? UpdatedAt { get; set; }

        [StringLength(100)]
        public string? CreatedBy { get; set; }

        // Foreign Keys
        public long? ContactId { get; set; }

        public long? AccountId { get; set; }

        public long? DealId { get; set; }
    }
}