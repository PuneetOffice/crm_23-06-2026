using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Elpis_CRM.Model
{
    [Table("Accounts")]
    public class AccountModel
    {
        [Key]
        [DatabaseGenerated(DatabaseGeneratedOption.None)]
        public long AccountId { get; set; }
        public string? Name { get; set; }
        public int? NumberOfEmployees { get; set; }
        public decimal? AnnualRevenue { get; set; }

        public string? Website { get; set; }

        public string? Phone { get; set; }

        public string? DisplayPhone { get; set; }

        public string? Address { get; set; }

        public string? City { get; set; }

        public string? State { get; set; }

        public string? Zipcode { get; set; }

        public string? Country { get; set; }

        public string? Facebook { get; set; }

        public string? Twitter { get; set; }

        public string? LinkedIn { get; set; }

        public DateTime? LastContactedTime { get; set; }

        public string? LastContactedMode { get; set; }

        public string? LastActivityType { get; set; }

        public DateTime? LastActivityDate { get; set; }

        public string? RecentNote { get; set; }

        public string? IndustryType { get; set; }

        public string? BusinessType { get; set; }

        public string? Territory { get; set; }

        public DateTime? CreatedAt { get; set; } = DateTime.Now;

        public DateTime? UpdatedAt { get; set; }

        public int? ActiveSalesSequences { get; set; }
        public int? CompletedSalesSequences { get; set; }

        public DateTime? LastAssignedAt { get; set; }

        public long? ParentAccountId { get; set; }

        public string? ParentAccount { get; set; }

        public long? SalesOwnerId { get; set; }

        public string? SalesOwner { get; set; }

        public long? CreatedById { get; set; }

        public string? CreatedBy { get; set; }

        public long? UpdatedById { get; set; }

        public string? UpdatedBy { get; set; }

        public string? ImportID { get; set; }

        public string? Tags { get; set; }

    }
}