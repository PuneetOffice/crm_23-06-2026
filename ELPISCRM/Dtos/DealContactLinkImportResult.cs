namespace Elpis_CRM.Dtos;

/// <summary>
/// Result of importing DealId → ContactId mappings onto existing deals.
/// </summary>
public sealed record DealContactLinkImportResult(
    bool Success,
    int RowsUpdated,
    int RowsSkipped,
    TimeSpan Elapsed,
    string? Error = null,
    IReadOnlyList<string>? RowErrors = null);
