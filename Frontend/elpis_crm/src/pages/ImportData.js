import React, { useEffect, useContext } from "react";
import { useNavigate } from "react-router-dom";
import { FiUpload, FiUsers, FiBriefcase, FiDollarSign, FiPhone, FiCalendar, FiFileText, FiArrowLeft, FiLink } from "react-icons/fi";
import AuthContext from "../auth/AuthContext";
import ImportCard from "./ImportCard";

function ImportData() {
  const navigate = useNavigate();
  const auth = useContext(AuthContext);
  const userRole = auth?.getRole?.();
  const isAdmin = userRole?.toLowerCase() === "admin";

  // Redirect if not admin
  useEffect(() => {
    if (!isAdmin) {
      navigate("/Dashboard");
    }
  }, [isAdmin, navigate]);

  if (!isAdmin) {
    return null;
  }

  /** Two-column Excel: DealId + ContactId → updates existing deals only (no new deals). */
  const dealContactLinkImport = {
    name: "Deal Contact Links",
    icon: FiLink,
    highlight: true,
    description:
      "Your file: DealId + ContactId only. Matches each DealId in the database and sets ContactId; ContactName is loaded from Contacts automatically.",
    comingSoon: false,
  };

  const dataTypes = [
    dealContactLinkImport,
    {
      name: "Accounts",
      icon: FiBriefcase,
      description: "Import company accounts and business information",
      comingSoon: false,
    },
    {
      name: "Contacts",
      icon: FiUsers,
      description: "Import contact details and information",
      comingSoon: false,
    },
    {
      name: "Deals",
      icon: FiDollarSign,
      description:
        "Import NEW deals only (full deal rows). Do not use this to attach contacts — use “Deal Contact Links” above.",
      comingSoon: false,
    },
    {
      name: "Call Logs",
      icon: FiPhone,
      description: "Import call logs and communication records",
      comingSoon: false,
    },
    {
      name: "Tasks",
      icon: FiCalendar,
      description: "Import task schedules and details",
      comingSoon: false,
    },
    {
      name: "Notes",
      icon: FiFileText,
      description: "Import notes and documentation",
      comingSoon: false,
    },
  ];

  const handleImportSuccess = (dataType) => {
    if (typeof window.addToast === "function") {
      window.addToast(
        dataType === "Deal Contact Links"
          ? "Deal contact links updated successfully!"
          : "Data imported successfully!",
        "success"
      );
    }
    if (dataType === "Deal Contact Links" && typeof window.refetchDeals === "function") {
      window.refetchDeals();
    }
  };

  return (
    <div className="h-full overflow-y-auto bg-gray-50 pt-0 pb-6">
      {/* Header Section */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-2 lg:px-5 py-2">
          <div className="flex items-center gap-3 mb-2">
            <button
              onClick={() => navigate("/Dashboard")}
              className="p-1.5 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
              title="Go back"
              aria-label="Go back"
            >
              <FiArrowLeft size={18} />
            </button>
            <div>
              <h1 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                <div className="p-1.5 bg-blue-100 rounded-lg">
                  <FiUpload size={18} className="text-blue-600" />
                </div>
                Import Data
              </h1>
              <p className="text-gray-600 text-xs mt-0.5">
                Bulk import accounts, contacts, and deals from Excel or CSV files
              </p>
            </div>
          </div>

          {/* Info Banner */}
          {/* <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <p className="text-sm text-blue-900">
              <strong>Supported formats:</strong> .xlsx, .xlsb, .xls, .csv • <strong>Maximum file size:</strong> 50MB
            </p>
          </div> */}
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
        <div className="mb-5 p-4 bg-emerald-50 border-2 border-emerald-300 rounded-xl">
          <p className="text-sm font-semibold text-emerald-900 mb-1">Deals already in the system?</p>
          <p className="text-xs text-emerald-800">
            Use <strong>Deal Contact Links</strong> (first card) — not Deals. Excel: DealId + ContactId only.
            Existing deals are updated; none are created.
          </p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {dataTypes.map((dataType) => (
            <ImportCard
              key={dataType.name}
              dataType={dataType.name}
              icon={dataType.icon}
              description={dataType.description}
              comingSoon={dataType.comingSoon}
              highlight={dataType.highlight}
              isLinkImport={dataType.name === "Deal Contact Links"}
              onSuccess={() => handleImportSuccess(dataType.name)}
            />
          ))}
        </div>

        {/* Help Section */}
        <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Getting Started Card */}
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <h3 className="text-base font-semibold text-gray-900 mb-2">Getting Started</h3>
            <ul className="space-y-1 text-xs text-gray-600">
              <li className="flex items-start gap-2">
                <span className="text-blue-600 font-bold mt-0.5">1.</span>
                <span>Download the import template for your data type</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-blue-600 font-bold mt-0.5">2.</span>
                <span>Fill in your data following the template structure</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-blue-600 font-bold mt-0.5">3.</span>
                <span>Upload your file using drag-and-drop or file picker</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-blue-600 font-bold mt-0.5">4.</span>
                <span>Review the import results and verify the data</span>
              </li>
            </ul>
          </div>

          {/* Best Practices Card */}
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <h3 className="text-base font-semibold text-gray-900 mb-2">Best Practices</h3>
            <ul className="space-y-1 text-xs text-gray-600">
              <li className="flex items-start gap-2">
                <span className="text-green-600">✓</span>
                <span>Use the provided templates for consistent formatting</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-green-600">✓</span>
                <span>Keep file sizes under 50MB for optimal performance</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-green-600">✓</span>
                <span>Validate data before importing large batches</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-green-600">✓</span>
                <span>Check import summary for any skipped rows</span>
              </li>
            </ul>
          </div>

          {/* Supported Formats Card */}
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <h3 className="text-base font-semibold text-gray-900 mb-2">File Formats</h3>
            <div className="space-y-2 text-xs">
              <div>
                <p className="font-medium text-gray-900">Excel Formats</p>
                <p className="text-gray-600">.xlsx, .xlsb, .xls</p>
              </div>
              <div>
                <p className="font-medium text-gray-900">CSV Format</p>
                <p className="text-gray-600">.csv (UTF-8 encoding recommended)</p>
              </div>
              <div className="mt-4 p-3 bg-yellow-50 rounded-lg border border-yellow-200">
                <p className="text-xs text-yellow-800">
                  <strong>Note:</strong> Ensure your file has headers in the first row matching the template columns.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* FAQ Section */}
        <div className="mt-8 bg-white rounded-lg border border-gray-200 p-5">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Frequently Asked Questions</h2>
          <div className="space-y-4">
            <div>
              <h4 className="text-sm font-medium text-gray-900 mb-1">What happens if there are errors in my file?</h4>
              <p className="text-xs text-gray-600">
                The import process will show you a detailed report of any skipped rows. Rows with errors will not be imported, but valid rows will be processed. You can then correct the errors and re-import.
              </p>
            </div>
            <div>
              <h4 className="text-sm font-medium text-gray-900 mb-1">Can I import partial data?</h4>
              <p className="text-xs text-gray-600">
                Yes, you can import only the columns that have data. However, required fields must be included in your file. Check the import template to see which fields are mandatory.
              </p>
            </div>
            <div>
              <h4 className="text-sm font-medium text-gray-900 mb-1">Is there a limit to how much data I can import?</h4>
              <p className="text-xs text-gray-600">
                The maximum file size is 50MB per import. For very large datasets, consider splitting them into multiple files and importing in batches.
              </p>
            </div>
            <div>
              <h4 className="text-sm font-medium text-gray-900 mb-1">Will duplicate data be overwritten?</h4>
              <p className="text-xs text-gray-600">
                Duplicates are handled based on your import settings. The system will typically skip duplicate entries or merge them depending on matching criteria. Check the import results for details.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default ImportData;
