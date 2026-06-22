using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Elpis_CRM.Model
{
    [Table("Contacts")]
    public class ContactModel
    {
        [Key]
        [DatabaseGenerated(DatabaseGeneratedOption.None)]
         public long ContactId { get; set; }
        public string? FirstName { get; set; }
        public string? LastName { get; set; }
        public string? JobTitle { get; set; }
        public string? WorkPhone { get; set; }
        public string? Mobile { get; set; }
        public DateTime? LastSeenOnChat { get; set; }
        public string? Locale { get; set; }
        public int? TotalChatSessions { get; set; }
        public DateTime? FirstSeenOnChat { get; set; }
        public string? ExternalID { get; set; }
        public string? TimeZone { get; set; }
        public string? Address { get; set; }
        public string? City { get; set; }
        public string? State { get; set; }
        public string? Zipcode { get; set; }
        public string? Country { get; set; }
        public string? Facebook { get; set; }
        public string? Twitter { get; set; }
        public string? LinkedIn { get; set; }
        public string? Medium { get; set; }
        public string? Keyword { get; set; }
        public DateTime? LastContactedTime { get; set; }
        public string? LastContactedMode { get; set; }
        public string? LastActivityType { get; set; }
        public DateTime? LastActivityDate { get; set; }
        public DateTime? LastSeenOnWeb { get; set; }
        public int? Score { get; set; }
        public string? SubscriptionStatus { get; set; }
        public string? UnsubscribeReason { get; set; }
        public string? OtherUnsubscribeReasons { get; set; }
        public string? WhatsAppSubscriptionStatus { get; set; }
        public string? SMSSubscriptionStatus { get; set; }
        public string? RecentNote { get; set; }
        public DateTime? CreatedAt { get; set; }
        public DateTime? UpdatedAt { get; set; }
        public string? Source { get; set; }
        public string? Campaign { get; set; }
        public string? Territory { get; set; }
        public string? LifeCycleStage { get; set; }
        public string? Status { get; set; }
        public string? LostReason { get; set; }
        public string? OriginalCampaign { get; set; }
        public string? OriginalMedium { get; set; }
        public string? OriginalSource { get; set; }
        public string? CreatedThroughCampaign { get; set; }
        public string? CreatedFromMedium { get; set; }
        public string? CreatedFromSource { get; set; }
        public string? MostRecentCampaign { get; set; }
        public string? MostRecentMedium { get; set; }
        public string? MostRecentSource { get; set; }
        public string? WorkEmail { get; set; }
        public int? ActiveSalesSequences { get; set; }
        public int? CompletedSalesSequences { get; set; }
        public string? CustomerFit { get; set; }
        public string? WebForms { get; set; }
        public DateTime? LastAssignedAt { get; set; }
        public long? AccountId { get; set; }
        public string? Account { get; set; }
        public long? SalesOwnerId { get; set; }
        public string? SalesOwner { get; set; }
        public long? CreatedById { get; set; }
        public string? CreatedBy { get; set; }
        public long? UpdatedById { get; set; }
        public string? UpdatedBy { get; set; }
        public string? ImportID { get; set; }
        public string? Emails { get; set; }
        public string? Products { get; set; }
        public string? Message { get; set; }
        public string? Tags { get; set; }
        public string? Lists { get; set; }
        public byte[]? FrontImage { get; set; }
        public byte[]? BackImage { get; set; }
    }
}


