using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
namespace Elpis_CRM.Model.DTOs
{
    public class DealNoteDto
    {
        public int Id { get; set; }
        public string? Description { get; set; }
        public long? CreatedById { get; set; }
        public DateTime? CreatedAt { get; set; }
        public DateTime? UpdatedAt { get; set; }
        [Required]
        public long DealId { get; set; }
        // No ContactId or RelatedToType - Deal-specific
    }
}