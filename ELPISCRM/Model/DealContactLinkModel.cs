using System.ComponentModel.DataAnnotations.Schema;

namespace Elpis_CRM.Model
{
    [Table("DealContactLinks")]
    public class DealContactLinkModel
    {
        public long DealId { get; set; }
        public long ContactId { get; set; }

        public DealModel? Deal { get; set; }
        public ContactModel? Contact { get; set; }
    }
}
