using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Elpis_CRM.Model
{
    [Table("Notes")]
    public class NotesModel
    {
        [Key]
        [DatabaseGenerated(DatabaseGeneratedOption.Identity)]
        public int Id { get; set; }
        public string? Description { get; set; }
        public long? CreatedById { get; set; }
        public DateTime? CreatedAt { get; set; }
        public DateTime? UpdatedAt { get; set; }
        public long? ContactId { get; set; }
        public string? RelatedToType { get; set; }
        public long? DealId { get; set; }
    }
}