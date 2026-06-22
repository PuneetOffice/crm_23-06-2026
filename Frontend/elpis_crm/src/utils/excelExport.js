import * as XLSX from 'xlsx';

/**
 * Exports table data to a professional Excel file
 * @param {Object} config - Configuration object
 * @param {Array} config.data - Full data array
 * @param {Set} config.selected - Set of selected row indices
 * @param {Array} config.columns - Column configuration array with { key, label } objects
 * @param {string} config.title - Title for the export (e.g., "Accounts Export")
 * @param {string} config.filename - Output filename (e.g., "accounts_export.xlsx")
 * @param {Function} config.getField - Helper function to get field values with fallback (optional)
 * @returns {void}
 */
export const exportTableToExcel = ({
  data = [],
  selected = new Set(),
  columns = [],
  title = "Data Export",
  filename = "export.xlsx",
  getField = (obj, key) => {
    if (!obj) return undefined;
    if (key in obj) return obj[key];
    const lower = key.charAt(0).toLowerCase() + key.slice(1);
    if (lower in obj) return obj[lower];
    return obj[key.toLowerCase()];
  },
}) => {
  try {
    // Get selected rows
    const selectedRows = Array.from(selected).map((idx) => data[idx]);

    if (selectedRows.length === 0) {
      console.warn("No rows selected for export");
      return;
    }

    // Create a new workbook
    const wb = XLSX.utils.book_new();

    // Prepare header row
    const headerLabels = columns.map((c) => c.label);
    const headerKeys = columns.map((c) => c.key);

    // Prepare data rows
    const dataRows = selectedRows.map((row) =>
      headerKeys.map((key) => {
        const val = getField(row, key) ?? "";
        // Format dates if they look like ISO strings
        if (typeof val === "string" && /^\d{4}-\d{2}-\d{2}/.test(val)) {
          return val.split("T")[0]; // Return just the date part
        }
        return val;
      })
    );

    // Build worksheet data: title + headers + data
    const wsData = [
      [title], // Title row
      [], // Blank row
      headerLabels, // Header row
      ...dataRows, // Data rows
    ];

    // Create worksheet
    const ws = XLSX.utils.aoa_to_sheet(wsData);

    // Set column widths - auto-fit based on content
    const colWidths = headerLabels.map((label, idx) => {
      const headerWidth = label.length + 2;
      const maxDataWidth = Math.max(
        ...dataRows.map((row) => String(row[idx] || "").length + 1)
      );
      return Math.min(Math.max(headerWidth, maxDataWidth), 50); // Cap at 50
    });

    ws["!cols"] = colWidths.map((width) => ({ wch: width }));

    // Style title row (row 1)
    const titleCell = ws["A1"];
    if (titleCell && titleCell.v) {
      ws["A1"].s = {
        font: { bold: true, size: 14, color: { rgb: "FFFFFF" } },
        fill: { fgColor: { rgb: "1F2937" } }, // Dark gray
        alignment: { horizontal: "left", vertical: "center" },
      };
      ws["!merges"] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: headerLabels.length - 1 } }];
    }

    // Style header row (row 3)
    const headerRowStart = 2; // 0-indexed
    headerLabels.forEach((_, colIdx) => {
      const cellRef = XLSX.utils.encode_col(colIdx) + (headerRowStart + 1);
      ws[cellRef] = ws[cellRef] || { v: headerLabels[colIdx] };
      ws[cellRef].s = {
        font: { bold: true, color: { rgb: "FFFFFF" }, size: 11 },
        fill: { fgColor: { rgb: "4F46E5" } }, // Indigo background
        alignment: { horizontal: "center", vertical: "center", wrapText: true },
        border: {
          top: { style: "thin", color: { rgb: "E5E7EB" } },
          bottom: { style: "thin", color: { rgb: "E5E7EB" } },
          left: { style: "thin", color: { rgb: "E5E7EB" } },
          right: { style: "thin", color: { rgb: "E5E7EB" } },
        },
      };
    });

    // Style data rows with borders and alternating colors
    dataRows.forEach((row, rowIdx) => {
      const excelRowIdx = headerRowStart + 2 + rowIdx; // +1 for header, +1 for 0-indexing
      const isEvenRow = rowIdx % 2 === 0;

      row.forEach((cellValue, colIdx) => {
        const cellRef = XLSX.utils.encode_col(colIdx) + (excelRowIdx + 1);
        ws[cellRef] = ws[cellRef] || { v: cellValue };

        ws[cellRef].s = {
          font: { color: { rgb: "1F2937" }, size: 10 },
          fill: isEvenRow
            ? { fgColor: { rgb: "F9FAFB" } } // Light gray
            : { fgColor: { rgb: "FFFFFF" } }, // White
          alignment: { horizontal: "left", vertical: "center", wrapText: false },
          border: {
            top: { style: "thin", color: { rgb: "E5E7EB" } },
            bottom: { style: "thin", color: { rgb: "E5E7EB" } },
            left: { style: "thin", color: { rgb: "E5E7EB" } },
            right: { style: "thin", color: { rgb: "E5E7EB" } },
          },
        };

        // Right-align numeric values
        if (typeof cellValue === "number") {
          ws[cellRef].s.alignment.horizontal = "right";
        }
      });
    });

    // Set row heights
    ws["!rows"] = [
      { hpx: 28 }, // Title row
      { hpx: 10 }, // Blank row
      { hpx: 28 }, // Header row
      ...dataRows.map(() => ({ hpx: 24 })), // Data rows
    ];

    // Enable autofilter on the header row
    const lastCol = XLSX.utils.encode_col(headerLabels.length - 1);
    ws["!autofilter"] = {
      ref: `A3:${lastCol}${dataRows.length + 3}`,
    };

    // Freeze header row (freeze rows 1-3)
    ws["!freeze"] = { xSplit: 0, ySplit: 3 };

    // Add worksheet to workbook
    XLSX.utils.book_append_sheet(wb, ws, "Data");

    // Write workbook to file
    XLSX.writeFile(wb, filename);
  } catch (error) {
    console.error("Error exporting to Excel:", error);
    throw error;
  }
};
