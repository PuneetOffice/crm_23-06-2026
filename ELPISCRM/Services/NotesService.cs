//using Elpis_CRM.Data;
//using Elpis_CRM.Model;
//using Elpis_CRM.Model.DTOs;
//using Microsoft.EntityFrameworkCore;

//namespace Elpis_CRM.Services
//{
//    public class NotesService
//    {
//        private readonly AppDbContext _notesDb;

//        public NotesService(AppDbContext notesDb)
//        {
//            _notesDb = notesDb;
//        }

//        // ─────────────────────────────────────────────────────────────────────────
//        // PRIVATE HELPER — find the mirror row for a given note
//        // ─────────────────────────────────────────────────────────────────────────
//        private async Task<NotesModel?> FindMirrorAsync(NotesModel note)
//        {
//            if (note.RelatedToType == null || !note.RelatedToType.StartsWith("mirror:"))
//                return null;

//            if (!int.TryParse(note.RelatedToType["mirror:".Length..], out var mirrorId))
//                return null;

//            return await _notesDb.Notes.FindAsync(mirrorId);
//        }

//        // ─────────────────────────────────────────────────────────────────────────
//        // ADD
//        // ─────────────────────────────────────────────────────────────────────────
//        public async Task<NotesModel> AddNote(NotesModel note)
//        {
//            note.CreatedAt = DateTime.UtcNow;
//            note.UpdatedAt = DateTime.UtcNow;

//            // ── Case 1: Contact panel ─────────────────────────────────────────────
//            if (note.ContactId.HasValue && !note.DealId.HasValue)
//            {
//                var linkedDealIds = await _notesDb.DealContactLinks
//                    .Where(x => x.ContactId == note.ContactId.Value)
//                    .Select(x => x.DealId)
//                    .Union(_notesDb.Deals
//                        .Where(d => d.ContactId == note.ContactId.Value)
//                        .Select(d => d.Id))
//                    .ToListAsync();

//                // No deals linked, or multiple deals — save contact note only, no mirror
//                if (linkedDealIds.Count == 0 || linkedDealIds.Count > 1)
//                {
//                    _notesDb.Notes.Add(note);
//                    await _notesDb.SaveChangesAsync();
//                    return note;
//                }

//                // Exactly one deal linked — mirror into it
//                var dealId = linkedDealIds[0];

//                note.RelatedToType = null;
//                _notesDb.Notes.Add(note);
//                await _notesDb.SaveChangesAsync();

//                var mirror = new NotesModel
//                {
//                    Description = note.Description,
//                    CreatedById = note.CreatedById,
//                    CreatedAt = note.CreatedAt,
//                    UpdatedAt = note.UpdatedAt,
//                    ContactId = null,
//                    DealId = dealId,
//                    RelatedToType = $"mirror:{note.Id}",
//                };
//                _notesDb.Notes.Add(mirror);
//                await _notesDb.SaveChangesAsync();

//                note.RelatedToType = $"mirror:{mirror.Id}";
//                await _notesDb.SaveChangesAsync();

//                return note;
//            }

//            // ── Case 2: Deal panel → mirror into linked contact ───────────────────
//            if (note.DealId.HasValue && !note.ContactId.HasValue)
//            {
//                var linkedContactIds = await _notesDb.DealContactLinks
//                    .Where(x => x.DealId == note.DealId.Value)
//                    .Select(x => x.ContactId)
//                    .ToListAsync();

//                if (linkedContactIds.Count == 0)
//                {
//                    var legacyContactId = await _notesDb.Deals
//                        .Where(d => d.Id == note.DealId.Value)
//                        .Select(d => d.ContactId)
//                        .FirstOrDefaultAsync();

//                    if (legacyContactId.HasValue)
//                    {
//                        linkedContactIds.Add(legacyContactId.Value);
//                    }
//                }

//                if (linkedContactIds.Count != 1)
//                {
//                    _notesDb.Notes.Add(note);
//                    await _notesDb.SaveChangesAsync();
//                    return note;
//                }

//                note.RelatedToType = null;
//                _notesDb.Notes.Add(note);
//                await _notesDb.SaveChangesAsync();

//                var mirror = new NotesModel
//                {
//                    Description = note.Description,
//                    CreatedById = note.CreatedById,
//                    CreatedAt = note.CreatedAt,
//                    UpdatedAt = note.UpdatedAt,
//                    ContactId = linkedContactIds[0],
//                    DealId = null,
//                    RelatedToType = $"mirror:{note.Id}",
//                };
//                _notesDb.Notes.Add(mirror);
//                await _notesDb.SaveChangesAsync();

//                note.RelatedToType = $"mirror:{mirror.Id}";
//                await _notesDb.SaveChangesAsync();

//                return note;
//            }

//            // ── Case 3: Both ids set or neither — save as-is ─────────────────────
//            _notesDb.Notes.Add(note);
//            await _notesDb.SaveChangesAsync();
//            return note;
//        }

//        // ─────────────────────────────────────────────────────────────────────────
//        // UPDATE
//        // ─────────────────────────────────────────────────────────────────────────
//        public async Task<NotesModel?> UpdateNote(int id, NotesModel note)
//        {
//            var existing = await _notesDb.Notes.FindAsync(id);
//            if (existing == null) return null;

//            existing.Description = note.Description;
//            existing.CreatedById = note.CreatedById;
//            existing.UpdatedAt = DateTime.UtcNow;

//            var mirror = await FindMirrorAsync(existing);
//            if (mirror != null)
//            {
//                mirror.Description = note.Description;
//                mirror.UpdatedAt = DateTime.UtcNow;
//            }

//            await _notesDb.SaveChangesAsync();
//            return existing;
//        }

//        // ─────────────────────────────────────────────────────────────────────────
//        // DELETE
//        // ─────────────────────────────────────────────────────────────────────────
//        public async Task<bool> DeleteNote(int id)
//        {
//            var note = await _notesDb.Notes.FindAsync(id);
//            if (note == null) return false;

//            var mirror = await FindMirrorAsync(note);
//            if (mirror != null)
//            {
//                mirror.RelatedToType = null;
//            }

//            _notesDb.Notes.Remove(note);
//            await _notesDb.SaveChangesAsync();
//            return true;
//        }

//        // ─────────────────────────────────────────────────────────────────────────
//        // READ
//        // ─────────────────────────────────────────────────────────────────────────
//        public async Task<List<NotesModel>> GetAllNotes()
//        {
//            return await _notesDb.Notes
//                .OrderByDescending(n => n.CreatedAt)
//                .ToListAsync();
//        }

//        public async Task<NotesModel?> GetById(int id)
//        {
//            return await _notesDb.Notes.FindAsync(id);
//        }

//        public async Task<List<ContactNoteDto>> GetNotesByContactAsync(long contactId)
//        {
//            return await _notesDb.Notes
//                .Where(n => n.ContactId == contactId)
//                .OrderByDescending(n => n.CreatedAt)
//                .Select(n => new ContactNoteDto
//                {
//                    Id = n.Id,
//                    Description = n.Description,
//                    CreatedById = n.CreatedById,
//                    CreatedAt = n.CreatedAt,
//                    UpdatedAt = n.UpdatedAt,
//                    ContactId = n.ContactId!.Value,
//                })
//                .ToListAsync();
//        }

//        public async Task<List<DealNoteDto>> GetNotesByDealAsync(long dealId)
//        {
//            return await _notesDb.Notes
//                .Where(n => n.DealId == dealId)
//                .OrderByDescending(n => n.CreatedAt)
//                .Select(n => new DealNoteDto
//                {
//                    Id = n.Id,
//                    Description = n.Description,
//                    CreatedById = n.CreatedById,
//                    CreatedAt = n.CreatedAt,
//                    UpdatedAt = n.UpdatedAt,
//                    DealId = n.DealId!.Value,
//                })
//                .ToListAsync();
//        }
//    }
//}

using Elpis_CRM.Data;
using Elpis_CRM.Model;
using Elpis_CRM.Model.DTOs;
using Microsoft.EntityFrameworkCore;

namespace Elpis_CRM.Services
{
    public class NotesService
    {
        private readonly AppDbContext _notesDb;

        public NotesService(AppDbContext notesDb)
        {
            _notesDb = notesDb;
        }

        // ─────────────────────────────────────────────────────────────────────────
        // ADD
        //
        // New behaviour (replaces the old 1:1 auto-mirroring):
        //
        //  • Contact panel note  → saved ONLY against that contact. No mirroring.
        //
        //  • Deal panel note     → the caller (UI) explicitly says where the note
        //                          should also appear, via note.MirrorToContactIds.
        //                          - Always writes the original Deal note.
        //                          - For every id in MirrorToContactIds, writes an
        //                            INDEPENDENT copy against that contact.
        //                          - Copies are independent rows: editing/deleting
        //                            one later does NOT affect the others.
        //
        // Validation of "at least one destination chosen" is expected to happen in
        // the UI/controller before this is called; this method trusts its input.
        // ─────────────────────────────────────────────────────────────────────────
        public async Task<NotesModel> AddNote(NotesModel note)
        {
            note.CreatedAt = DateTime.UtcNow;
            note.UpdatedAt = DateTime.UtcNow;

            // ── Case 1: Contact panel — always contact-only, never mirrored ──────
            if (note.ContactId.HasValue && !note.DealId.HasValue)
            {
                note.RelatedToType = "Contact";

                _notesDb.Notes.Add(note);
                await _notesDb.SaveChangesAsync();

                var mirrorDealIds = (note.MirrorToDealIds ?? new List<long>())
                    .Distinct()
                    .ToList();

                foreach (var dealId in mirrorDealIds)
                {
                    var copy = new NotesModel
                    {
                        Description = note.Description,
                        CreatedById = note.CreatedById,
                        CreatedAt = note.CreatedAt,
                        UpdatedAt = note.UpdatedAt,
                        DealId = dealId,
                        ContactId = null,
                        RelatedToType = "Deal"
                    };

                    _notesDb.Notes.Add(copy);
                }

                if (mirrorDealIds.Count > 0)
                {
                    await _notesDb.SaveChangesAsync();
                }

                return note;
            }

            // ── Case 2: Deal panel — write the deal note, then independent ───────
            //            copies for every contact the user explicitly checked.
            if (note.DealId.HasValue && !note.ContactId.HasValue)
            {
                note.RelatedToType = "Deal";
                _notesDb.Notes.Add(note);
                await _notesDb.SaveChangesAsync();

                var mirrorContactIds = (note.MirrorToContactIds ?? new List<long>())
                    .Distinct()
                    .ToList();

                foreach (var contactId in mirrorContactIds)
                {
                    var copy = new NotesModel
                    {
                        Description = note.Description,
                        CreatedById = note.CreatedById,
                        CreatedAt = note.CreatedAt,
                        UpdatedAt = note.UpdatedAt,
                        ContactId = contactId,
                        DealId = null,
                        RelatedToType = "Contact",
                    };
                    _notesDb.Notes.Add(copy);
                }

                if (mirrorContactIds.Count > 0)
                {
                    await _notesDb.SaveChangesAsync();
                }

                return note;
            }

            // ── Case 3: Both ids set or neither — save as-is ─────────────────────
            _notesDb.Notes.Add(note);
            await _notesDb.SaveChangesAsync();
            return note;
        }

        // ─────────────────────────────────────────────────────────────────────────
        // UPDATE
        //
        // Copies are independent now, so this only ever touches the single note
        // being edited — no mirror lookup, no propagation.
        // ─────────────────────────────────────────────────────────────────────────
        public async Task<NotesModel?> UpdateNote(int id, NotesModel note)
        {
            var existing = await _notesDb.Notes.FindAsync(id);
            if (existing == null) return null;

            existing.Description = note.Description;
            existing.CreatedById = note.CreatedById;
            existing.UpdatedAt = DateTime.UtcNow;

            await _notesDb.SaveChangesAsync();
            return existing;
        }

        // ─────────────────────────────────────────────────────────────────────────
        // DELETE
        //
        // Independent copies → plain delete of the single row, no mirror cleanup.
        // ─────────────────────────────────────────────────────────────────────────
        public async Task<bool> DeleteNote(int id)
        {
            var note = await _notesDb.Notes.FindAsync(id);
            if (note == null) return false;

            _notesDb.Notes.Remove(note);
            await _notesDb.SaveChangesAsync();
            return true;
        }

        // ─────────────────────────────────────────────────────────────────────────
        // READ
        // ─────────────────────────────────────────────────────────────────────────
        public async Task<List<NotesModel>> GetAllNotes()
        {
            return await _notesDb.Notes
                .OrderByDescending(n => n.CreatedAt)
                .ToListAsync();
        }

        public async Task<NotesModel?> GetById(int id)
        {
            return await _notesDb.Notes.FindAsync(id);
        }

        public async Task<List<ContactNoteDto>> GetNotesByContactAsync(long contactId)
        {
            return await _notesDb.Notes
                .Where(n => n.ContactId == contactId)
                .OrderByDescending(n => n.CreatedAt)
                .Select(n => new ContactNoteDto
                {
                    Id = n.Id,
                    Description = n.Description,
                    CreatedById = n.CreatedById,
                    CreatedAt = n.CreatedAt,
                    UpdatedAt = n.UpdatedAt,
                    ContactId = n.ContactId!.Value,
                })
                .ToListAsync();
        }

        public async Task<List<DealNoteDto>> GetNotesByDealAsync(long dealId)
        {
            return await _notesDb.Notes
                .Where(n => n.DealId == dealId)
                .OrderByDescending(n => n.CreatedAt)
                .Select(n => new DealNoteDto
                {
                    Id = n.Id,
                    Description = n.Description,
                    CreatedById = n.CreatedById,
                    CreatedAt = n.CreatedAt,
                    UpdatedAt = n.UpdatedAt,
                    DealId = n.DealId!.Value,
                })
                .ToListAsync();
        }
    }
}