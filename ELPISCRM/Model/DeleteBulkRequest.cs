using System.Collections.Generic;

namespace Elpis_CRM.Model
{
    public class DeleteBulkRequest
    {
        public List<long> ids { get; set; } = new List<long>();
    }
}
