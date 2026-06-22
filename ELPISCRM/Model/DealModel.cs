using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Elpis_CRM.Model
{
    [Table("Deals")]
    public class DealModel
    {
        [Key]
        [DatabaseGenerated(DatabaseGeneratedOption.None)]
        public long Id { get; set; }
        public string? Name { get; set; }
        public decimal? DealValue { get; set; }
        public string? Currency { get; set; }
        public decimal? DealValueInBaseCurrency { get; set; }
        public DateTime? ExpectedCloseDate { get; set; }
        public DateTime? ClosedDate { get; set; }
        public int? Probability { get; set; }
        public string? LastActivityType { get; set; }
        public DateTime? LastActivityDate { get; set; }
        public string? RecentNote { get; set; }
        public DateTime? CreatedAt { get; set; }
        public DateTime? UpdatedAt { get; set; }
        public string? DealPipeline { get; set; }
        public string? DealStage { get; set; }
        public string? LostReason { get; set; }
        public string? WonReasons { get; set; }
        public string? PaymentStatus { get; set; }
        public string? Territory { get; set; }
        public string? Type { get; set; }
        public string? Source { get; set; }
        public string? Campaign { get; set; }
        public string? ForecastCategory { get; set; }
        public int? ActiveSalesSequences { get; set; }
        public int? CompletedSalesSequences { get; set; }
        public string? WebForm { get; set; }
        public string? UpcomingActivities { get; set; }
        public DateTime? DealStageUpdatedAt { get; set; }
        public DateTime? LastAssignedAt { get; set; }
        public decimal? ExpectedDealValue { get; set; }
        public long? AccountId { get; set; }
        public string? AccountName { get; set; }
        public long? ContactId { get; set; }
        public string? ContactName { get; set; }
        [NotMapped]
        public List<long> ContactIds { get; set; } = new();
        [NotMapped]
        public List<string> ContactNames { get; set; } = new();
        public long? SalesOwnerId { get; set; }
        public string? SalesOwner { get; set; }
        public long? CreatedById { get; set; }
        public string? CreatedBy { get; set; }
        public long? UpdatedById { get; set; }
        public string? UpdatedBy { get; set; }
        public string? ImportID { get; set; }
        public string? EnquiryNumber { get; set; }
        public string? Tags { get; set; }
        public int? AgeInDays { get; set; }
    }
}
