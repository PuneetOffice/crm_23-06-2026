 using Elpis_CRM.Data;
using Elpis_CRM.Dtos;
using Elpis_CRM.Model;
using Microsoft.EntityFrameworkCore;
using System;
using System.Threading.Tasks;
 
 namespace ELPISCRM.Model
{
    /// <summary>
    /// Result of processing a public "Contact Us" submission.
    /// </summary>
    public class ContactUsResult
    {
        /// <summary>True when the contact already existed; false when a new one was created.</summary>
        public bool ContactMatched { get; set; }
        public long ContactId { get; set; }
        public string? ContactName { get; set; }
        /// <summary>True when the account (company) already existed; false when a new one was created.</summary>
        public bool AccountMatched { get; set; }
        public long AccountId { get; set; }
        public string? AccountName { get; set; }
        public long DealId { get; set; }
        public string? DealName { get; set; }
        public string Message { get; set; } = string.Empty;
    }
}