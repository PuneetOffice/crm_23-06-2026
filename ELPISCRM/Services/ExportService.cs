using Elpis_CRM.Data;
using ClosedXML.Excel;
using Elpis_CRM.Model;
using Microsoft.EntityFrameworkCore;
using System.Reflection;


namespace Elpis_CRM.Services
{
    public class ExportService
    {
        private readonly AppDbContext _context;

        public ExportService(AppDbContext context)
        {
            _context = context;
        }

        // ─── Accounts ───────────────────────────────────────────────────────────

        public async Task<byte[]> ExportAccountsAsync(
            string? search,
            string? tag,
            List<string>? columns)
        {
            IQueryable<AccountModel> query = _context.Accounts.AsNoTracking();

            if (!string.IsNullOrWhiteSpace(search))
            {
                string s = search.Trim().ToLower();
                query = query.Where(a =>
                    (a.Name != null && a.Name.ToLower().Contains(s)) ||
                    (a.City != null && a.City.ToLower().Contains(s)) ||
                    (a.Country != null && a.Country.ToLower().Contains(s)) ||
                    (a.Phone != null && a.Phone.ToLower().Contains(s)) ||
                    (a.Website != null && a.Website.ToLower().Contains(s)));
            }

            if (!string.IsNullOrWhiteSpace(tag))
            {
                string t = tag.Trim().ToLower();
                query = query.Where(a => a.Tags != null && a.Tags.ToLower().Contains(t));
            }

            List<AccountModel> data = await query.ToListAsync();
            return BuildExcel(data, columns, "Accounts");
        }

        // ─── Contacts ───────────────────────────────────────────────────────────

        public async Task<byte[]> ExportContactsAsync(
            string? search,
            List<string>? columns)
        {
            IQueryable<ContactModel> query = _context.Contacts.AsNoTracking();

            if (!string.IsNullOrWhiteSpace(search))
            {
                string s = search.Trim().ToLower();
                query = query.Where(c =>
                    (c.FirstName != null && c.FirstName.ToLower().Contains(s)) ||
                    (c.LastName != null && c.LastName.ToLower().Contains(s)) ||
                    (c.WorkEmail != null && c.WorkEmail.ToLower().Contains(s)) ||
                    (c.WorkPhone != null && c.WorkPhone.ToLower().Contains(s)) ||
                    (c.City != null && c.City.ToLower().Contains(s)) ||
                    (c.Country != null && c.Country.ToLower().Contains(s)));
            }

            List<ContactModel> data = await query.ToListAsync();
            return BuildExcel(data, columns, "Contacts");
        }

        // ─── Generic Excel builder ───────────────────────────────────────────────

        /// <summary>
        /// Builds an Excel workbook from a list of model objects.
        /// Only the properties listed in <paramref name="columns"/> are included;
        /// if <paramref name="columns"/> is null/empty, ALL properties are exported.
        /// </summary>
        private static byte[] BuildExcel<T>(
            IReadOnlyList<T> rows,
            List<string>? columns,
            string sheetName)
        {
            // Resolve which properties to export
            PropertyInfo[] allProps = typeof(T).GetProperties(BindingFlags.Public | BindingFlags.Instance);

            PropertyInfo[] props = (columns != null && columns.Count > 0)
                ? columns
                    .Select(col => allProps.FirstOrDefault(p =>
                        string.Equals(p.Name, col, StringComparison.OrdinalIgnoreCase)))
                    .Where(p => p != null)
                    .Cast<PropertyInfo>()
                    .ToArray()
                : allProps;

            using var workbook = new XLWorkbook();
            IXLWorksheet ws = workbook.Worksheets.Add(sheetName);

            // Header row
            for (int c = 0; c < props.Length; c++)
            {
                IXLCell cell = ws.Cell(1, c + 1);
                cell.Value = props[c].Name;
                cell.Style.Font.Bold = true;
                cell.Style.Fill.BackgroundColor = XLColor.FromHtml("#4472C4");
                cell.Style.Font.FontColor = XLColor.White;
                cell.Style.Alignment.Horizontal = XLAlignmentHorizontalValues.Center;
            }

            // Data rows – stream values directly; avoid boxing where possible
            for (int r = 0; r < rows.Count; r++)
            {
                T row = rows[r];
                for (int c = 0; c < props.Length; c++)
                {
                    object? value = props[c].GetValue(row);
                    IXLCell cell = ws.Cell(r + 2, c + 1);
                    SetCellValue(cell, value);
                }
            }

            // Auto-fit after all data is written (one pass, avoids repeated resize)
            ws.ColumnsUsed().AdjustToContents(1, 60); // cap at 60 chars width

            // Freeze header row
            ws.SheetView.FreezeRows(1);

            using var ms = new MemoryStream();
            workbook.SaveAs(ms);
            return ms.ToArray();
        }

        // ─── Helpers ────────────────────────────────────────────────────────────

        private static void SetCellValue(IXLCell cell, object? value)
        {
            if (value is null)
            {
                cell.SetValue(string.Empty);
                return;
            }

            switch (value)
            {
                case DateTime dt:
                    cell.Value = dt;
                    cell.Style.DateFormat.Format = "yyyy-MM-dd HH:mm:ss";
                    break;
                case DateTimeOffset dto:
                    cell.Value = dto.DateTime;
                    cell.Style.DateFormat.Format = "yyyy-MM-dd HH:mm:ss";
                    break;
                case int i:    cell.Value = i;   break;
                case long l:   cell.Value = l;   break;
                case decimal d: cell.Value = d;  break;
                case double db: cell.Value = db; break;
                case bool b:   cell.Value = b;   break;
                default:       cell.Value = value.ToString(); break;
            }
        }
    }
}
