using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Elpis_CRM.Model
{
    [Table("Products")]
    public class ProductsModel
    {
        [Key]
        [DatabaseGenerated(DatabaseGeneratedOption.Identity)]
        public int ProductId { get; set; }

        [StringLength(100)]
        [Column("ProductName")]
        public string? Name { get; set; }

        [StringLength(10)]
        public string? Active { get; set; } = "Yes";

        [Column(TypeName = "decimal(18,2)")]
        public decimal? BaseCurrencyAmount { get; set; }

        [StringLength(100)]
        [Column("ProductCategory")]
        public string? Category { get; set; }

        [Column(TypeName = "datetime2")]
        public DateTime? CreatedAt { get; set; }

        [StringLength(100)]
        public string? CreatedBy { get; set; }

        [Column(TypeName = "datetime2")]
        public DateTime? UpdatedAt { get; set; }

        [StringLength(100)]
        public string? UpdatedBy { get; set; }
    }
}

