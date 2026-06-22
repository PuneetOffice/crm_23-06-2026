using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Elpis_CRM.Model
{
    [Table("Templates")]
    public class TemplateModel
    {
        [Key]
        [DatabaseGenerated(DatabaseGeneratedOption.Identity)]
        public int TemplateId { get; set; }

        [StringLength(40)]
        public string? Name { get; set; }

        [StringLength(255)]
        public string? Subject { get; set; }

        public string? Body { get; set; }

        [StringLength(50)]
        public string? TemplateType { get; set; }

        [Column(TypeName = "datetime2")]
        public DateTime? CreatedAt { get; set; }

        [StringLength(100)]
        public string? CreatedBy { get; set; }

        [Column(TypeName = "datetime2")]
        public DateTime? UpdatedAt { get; set; }

        public bool IsActive { get; set; } = true;
    }
}