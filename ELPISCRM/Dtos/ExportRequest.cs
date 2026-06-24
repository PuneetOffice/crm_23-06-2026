namespace Elpis_CRM.DTOs
{
    public class ExportRequest
    {
        public string? Search { get; set; }
        public string? Tag { get; set; }
        public List<string>? Columns { get; set; }
    }
}
