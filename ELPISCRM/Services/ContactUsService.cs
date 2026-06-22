using Elpis_CRM.Data;
using Elpis_CRM.Dtos;
using Elpis_CRM.Model;
using Elpis_CRM.Services;
using Microsoft.EntityFrameworkCore;
using System;
using System.Threading.Tasks;
using ELPISCRM.Model;

namespace Elpis_CRM.Services
{
    /// <summary>
    /// Handles "Contact Us" form submissions:
    /// 1. Looks up the Contacts table by name + company.
    /// 2. If a contact exists, opens a new deal against it.
    /// 3. Otherwise creates the contact first, then the deal.
    /// Contact/Deal creation is delegated to the existing services so that
    /// ID generation, default values and FK resolution stay consistent.
    /// </summary>
    public class ContactUsService
    {
        private readonly AppDbContext _db;
        private readonly ContactService _contactService;
        private readonly DealsService _dealsService;
        private readonly AccountService _accountService;

        public ContactUsService(
            AppDbContext db,
            ContactService contactService,
            DealsService dealsService,
            AccountService accountService)
        {
            _db = db;
            _contactService = contactService;
            _dealsService = dealsService;
            _accountService = accountService;
        }

        public async Task<ContactUsResult> SubmitAsync(ContactUsFormDto form)
        {
            if (form == null) throw new ArgumentNullException(nameof(form));

            var firstName = (form.FirstName ?? string.Empty).Trim();
            var lastName = (form.LastName ?? string.Empty).Trim();
            var company = (form.Company ?? string.Empty).Trim();

            if (string.IsNullOrWhiteSpace(firstName))
                throw new ArgumentException("First name is required.");
            if (string.IsNullOrWhiteSpace(company))
                throw new ArgumentException("Company is required.");

            // 1. Ensure an account exists for the company — create one if none matches.
            var (account, accountMatched) = await EnsureAccountAsync(company);

            // 2. Try to match an existing contact by name + company (case-insensitive).
            var existing = await FindExistingContactAsync(firstName, lastName, company);

            ContactModel contact;
            bool contactMatched;

            if (existing != null)
            {
                // Matched contact is left completely untouched — never change its
                // existing account name / link.
                contact = existing;
                contactMatched = true;
            }
            else
            {
                // 3. No match — create a new contact from the form fields,
                //    linked to the resolved/new account.
                var newContact = new ContactModel
                {
                    FirstName = firstName,
                    LastName = string.IsNullOrWhiteSpace(lastName) ? null : lastName,
                    AccountId = account?.AccountId,
                    Account = account?.Name ?? company,
                    WorkEmail = string.IsNullOrWhiteSpace(form.Email) ? null : form.Email.Trim(),
                    Mobile = string.IsNullOrWhiteSpace(form.Phone) ? null : form.Phone.Trim(),
                    JobTitle = string.IsNullOrWhiteSpace(form.JobTitle) ? null : form.JobTitle.Trim(),
                    Message = string.IsNullOrWhiteSpace(form.Message) ? null : form.Message.Trim(),
                    Source = "Contact Us",
                    LifeCycleStage = "Prospect",
                    Status = "New"
                };

                // AddAsync generates the ContactId and sets the timestamps.
                contact = await _contactService.AddAsync(newContact);
                contactMatched = false;
            }

            // 4. Create a deal linked to the (matched or new) contact and account.
            var deal = new DealModel
            {
                Name = BuildDealName(form, contact),
                ContactId = contact.ContactId,
                AccountId = contact.AccountId ?? account?.AccountId, // null is fine — only validated when set
                AccountName = contact.Account ?? account?.Name ?? company,
                RecentNote = string.IsNullOrWhiteSpace(form.Message) ? null : form.Message.Trim(),
                Source = "Contact Us",
                WebForm = "Contact Us",
                Type = "New Business"
            };

            var createdDeal = await _dealsService.AddAsync(deal);

            return new ContactUsResult
            {
                ContactMatched = contactMatched,
                ContactId = contact.ContactId,
                ContactName = $"{contact.FirstName} {contact.LastName}".Trim(),
                AccountMatched = accountMatched,
                AccountId = account?.AccountId ?? 0,
                AccountName = account?.Name,
                DealId = createdDeal.Id,
                DealName = createdDeal.Name,
                Message = BuildMessage(contactMatched, accountMatched)
            };
        }

        /// <summary>
        /// Finds an account by name (case-insensitive). Creates a new one when the
        /// company name doesn't match any existing account.
        /// Returns the account and whether it already existed.
        /// </summary>
        private async Task<(AccountModel account, bool matched)> EnsureAccountAsync(string company)
        {
            var lower = company.ToLowerInvariant();

            var existing = await _db.Accounts.AsNoTracking()
                .FirstOrDefaultAsync(a => a.Name != null && a.Name.ToLower() == lower);

            if (existing != null)
            {
                return (existing, true);
            }

            // AddAsync generates the AccountId and sets the timestamps.
            var created = await _accountService.AddAsync(new AccountModel
            {
                Name = company,
                Territory = null
            });

            return (created, false);
        }

        private static string BuildMessage(bool contactMatched, bool accountMatched)
        {
            var contactPart = contactMatched ? "Existing contact found" : "New contact created";
            var accountPart = accountMatched ? "existing account" : "new account created";
            return $"{contactPart} ({accountPart}). A new deal was created.";
        }

        /// <summary>
        /// Finds a contact whose first name, last name and account (company) match the form,
        /// case-insensitively. When the form has no last name, only first name + company are compared.
        /// </summary>
        private async Task<ContactModel?> FindExistingContactAsync(string firstName, string lastName, string company)
        {
            var first = firstName.ToLower();
            var comp = company.ToLower();
            var hasLast = !string.IsNullOrWhiteSpace(lastName);
            var last = lastName.ToLower();

            var query = _db.Contacts.AsNoTracking().Where(c =>
                c.FirstName != null && c.FirstName.ToLower() == first &&
                c.Account != null && c.Account.ToLower() == comp);

            if (hasLast)
            {
                query = query.Where(c => c.LastName != null && c.LastName.ToLower() == last);
            }

            return await query.FirstOrDefaultAsync();
        }

        private static string BuildDealName(ContactUsFormDto form, ContactModel contact)
        {
            if (!string.IsNullOrWhiteSpace(form.Subject))
                return form.Subject.Trim();

            var who = $"{contact.FirstName} {contact.LastName}".Trim();
            if (string.IsNullOrWhiteSpace(who))
                who = contact.Account ?? form.Company;

            return $"Website Enquiry - {who}".Trim();
        }
    }
}
