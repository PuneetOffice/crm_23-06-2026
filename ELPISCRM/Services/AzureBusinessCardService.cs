using global::Azure;
using global::Azure.AI.FormRecognizer.DocumentAnalysis;
using Elpis_CRM.Model;
using Microsoft.Extensions.Options;

namespace Elpis_CRM.Services;

/// <summary>
/// Settings for Azure Document Intelligence
/// </summary>
public sealed class AzureDocumentIntelligenceSettings
{
    public const string SectionName = "AzureDocumentIntelligence";
    public string Endpoint { get; set; } = string.Empty;
    public string Key { get; set; } = string.Empty;
}

/// <summary>
/// Settings for file uploads
/// </summary>
public sealed class FileUploadSettings
{
    public const string SectionName = "FileUploadSettings";
    public long MaxFileSizeBytes { get; set; } = 5 * 1024 * 1024;
    public string[] AllowedContentTypes { get; set; } =
    [
        "image/jpeg", "image/png", "image/tiff", "image/bmp", "image/webp"
    ];
}

/// <summary>
/// Service for scanning business cards using Azure Document Intelligence
/// Maps extracted data directly to AccountsModel fields
/// </summary>
public sealed class AzureBusinessCardService
{
    private const string ModelId = "business_card_c1";

    private readonly DocumentAnalysisClient _client;
    private readonly FileUploadSettings _uploadSettings;

    public AzureBusinessCardService(
        DocumentAnalysisClient client,
        IOptions<FileUploadSettings> uploadSettings)
    {
        _client = client;
        _uploadSettings = uploadSettings.Value;
    }

    /// <summary>
    /// Scans a business card image and returns mapped AccountsModel data
    /// </summary>
    public async Task<AccountModel> ScanAsync(
        IFormFile file,
        CancellationToken cancellationToken = default)
    {
        if (file.Length == 0)
            throw new ArgumentException("Uploaded file is empty.", nameof(file));

        if (file.Length > _uploadSettings.MaxFileSizeBytes)
            throw new ArgumentException(
                $"File size {file.Length:N0} bytes exceeds the maximum allowed " +
                $"size of {_uploadSettings.MaxFileSizeBytes:N0} bytes.", nameof(file));

        if (!_uploadSettings.AllowedContentTypes.Contains(
                file.ContentType, StringComparer.OrdinalIgnoreCase))
            throw new ArgumentException(
                $"Content type '{file.ContentType}' is not permitted. " +
                $"Allowed: {string.Join(", ", _uploadSettings.AllowedContentTypes)}.", nameof(file));

        AnalyzeResult result;
        try
        {
            await using var stream = file.OpenReadStream();

            var operation = await _client.AnalyzeDocumentAsync(
                WaitUntil.Completed,
                ModelId,
                stream,
                cancellationToken: cancellationToken);

            result = operation.Value;
        }
        catch (RequestFailedException ex)
        {
            throw new InvalidOperationException(
                $"Azure Document Intelligence analysis failed: {ex.Message}", ex);
        }

        if (result.Documents.Count == 0)
            return new AccountModel { Name = string.Empty };

        var doc = result.Documents[0];
        
        // Extract name components
        //var firstName = GetStringField(doc, "FirstName") ?? string.Empty;
        //var lastName = GetStringField(doc, "LastName") ?? string.Empty;
        //var Name= $"{firstName} {lastName}".Trim();

        // ── Debug: Log all field names from Azure response ──
        if (doc.Fields.Count > 0)
        {
            var fieldNames = string.Join(", ", doc.Fields.Keys);
            Console.WriteLine($"[AzureBusinessCardService] Azure response field names: {fieldNames}");
        }
        else
        {
            Console.WriteLine("[AzureBusinessCardService] No" +
                " fields found in Azure response.");
        }

        var account = new AccountModel
        {
            // Name  
            Name = GetFirstListItem(doc,"Company Name"),

            // Company information
            Website = GetFirstListItem(doc, "Website"),
            Phone = GetFirstListItem(doc, "Phone"),

            // Address information
            Address = GetAddressField(doc, "Address"),
            //OwnerEmail = GetFirstListItem(doc,"Email"),

            // Set timestamps
            CreatedAt = DateTime.Now,
            UpdatedAt = DateTime.Now,
            //Active = "Yes"
        };

        return account;
    }


    /// <summary>
    /// Extracts a string field value from an analyzed document
    /// </summary>
    private static string? GetStringField(AnalyzedDocument doc, string fieldName)
    {
        if (!doc.Fields.TryGetValue(fieldName, out var field) || field is null)
            return null;

        var value = field.Value?.AsString();
        return string.IsNullOrWhiteSpace(value) ? null : value.Trim();
    }

    /// <summary>
    /// Extracts the first item from a list field, or uses string if not a list.
    /// Handles both phone number and string types.
    /// </summary>
    private static string? GetFirstListItem(AnalyzedDocument doc, string fieldName)
    {
        if (!doc.Fields.TryGetValue(fieldName, out var field) || field is null)
            return null;

        // Try as List first
        try
        {
            var list = field.Value?.AsList();
            if (list is not null && list.Count > 0)
            {
                var item = list[0];
                // Try PhoneNumber first (for phone fields), then fall back to String.
                try
                {
                    var phone = item.Value?.AsPhoneNumber();
                    if (!string.IsNullOrWhiteSpace(phone))
                        return phone.Trim();
                }
                catch (InvalidOperationException) { }

                try
                {
                    var value = item.Value?.AsString();
                    return string.IsNullOrWhiteSpace(value) ? null : value.Trim();
                }
                catch (InvalidOperationException)
                {
                    return null;
                }
            }
        }
        catch (InvalidOperationException) { }

        // Fallback: Try as String
        try
        {
            var value = field.Value?.AsString();
            return string.IsNullOrWhiteSpace(value) ? null : value.Trim();
        }
        catch (InvalidOperationException)
        {
            return null;
        }
    }

    /// <summary>
    /// Extracts and formats address from a structured or raw address field, handling both list and string types.
    /// </summary>
    private static string? GetAddressField(AnalyzedDocument doc, string fieldName)
    {
        if (!doc.Fields.TryGetValue(fieldName, out var field) || field is null)
            return null;

        // Try as List first
        try
        {
            var list = field.Value?.AsList();
            if (list is not null && list.Count > 0)
            {
                var firstAddr = list[0];
                // Try structured address object first.
                try
                {
                    var structured = firstAddr.Value?.AsAddress();
                    if (structured is not null)
                    {
                        var parts = new[]
                        {
                            structured.StreetAddress,
                            structured.City,
                            structured.State,
                            structured.PostalCode,
                            structured.CountryRegion
                        }.Where(p => !string.IsNullOrWhiteSpace(p));

                        var formatted = string.Join(", ", parts);
                        return string.IsNullOrWhiteSpace(formatted) ? null : formatted;
                    }
                }
                catch (InvalidOperationException) { }

                // Raw string fallback.
                var raw = firstAddr.Value?.AsString();
                return string.IsNullOrWhiteSpace(raw) ? null : raw.Trim();
            }
        }
        catch (InvalidOperationException) { }

        // Fallback: Try as String
        try
        {
            var value = field.Value?.AsString();
            return string.IsNullOrWhiteSpace(value) ? null : value.Trim();
        }
        catch (InvalidOperationException)
        {
            return null;
        }
    }
}
