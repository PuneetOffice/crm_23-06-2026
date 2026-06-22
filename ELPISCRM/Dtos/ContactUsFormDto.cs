using System.ComponentModel.DataAnnotations;

namespace Elpis_CRM.Dtos
{
    /// <summary>
    /// Payload posted by the public "Contact Us" form on the external website.
    /// Carries the few important fields needed to identify / create a Contact
    /// and open a Deal against it.
    /// </summary>
    public class ContactUsFormDto
    {
        [Required(ErrorMessage = "First name is required.")]
        public string FirstName { get; set; } = string.Empty;
        public string? LastName { get; set; }
        [Required(ErrorMessage = "Company is required.")]
        public string Company { get; set; } = string.Empty;
        [EmailAddress(ErrorMessage = "A valid email is required.")]
        public string? Email { get; set; }
        public string? Phone { get; set; }
        public string? JobTitle { get; set; }
        public string? Subject { get; set; }
        public string? Message { get; set; }
    }
}
