using Elpis_CRM.Data;
using Elpis_CRM.Model;
using Microsoft.EntityFrameworkCore;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;

namespace Elpis_CRM.Service
{
    /// <summary>
    /// Service class to manage CRUD operations and retrieval for email/template models.
    /// </summary>
    public class TemplateService
    {
        private readonly AppDbContext _templateDbContext;

        /// <summary>
        /// Initializes a new instance of the <see cref="TemplateService"/> class.
        /// </summary>
        /// <param name="templateDbContext">The database context used for template operations.</param>
        public TemplateService(AppDbContext templateDbContext)
        {
            _templateDbContext = templateDbContext;
        }

        /// <summary>
        /// Adds a new template to the database.
        /// </summary>
        /// <param name="template">The template details to add.</param>
        /// <returns>The added <see cref="TemplateModel"/> with timestamps.</returns>
        public async Task<TemplateModel> AddTemplate(TemplateModel template)
        {
            template.CreatedAt = DateTime.UtcNow;
            template.UpdatedAt = DateTime.UtcNow;

            _templateDbContext.Templates.Add(template);
            await _templateDbContext.SaveChangesAsync();
            return template;
        }

        /// <summary>
        /// Retrieves all templates from the database.
        /// </summary>
        /// <returns>A list of <see cref="TemplateModel"/> objects.</returns>
        public async Task<List<TemplateModel>> GetAllAsync()
        {
            return await _templateDbContext.Templates.ToListAsync();
        }

        /// <summary>
        /// Retrieves a template by its ID.
        /// </summary>
        /// <param name="templateId">The ID of the template.</param>
        /// <returns>The <see cref="TemplateModel"/> if found; otherwise, null.</returns>
        public async Task<TemplateModel?> GetByIdAsync(int templateId)
        {
            return await _templateDbContext.Templates.FindAsync(templateId);
        }

        /// <summary>
        /// Retrieves a template by its name.
        /// </summary>
        /// <param name="name">The name of the template.</param>
        /// <returns>The <see cref="TemplateModel"/> if found; otherwise, null.</returns>
        public async Task<TemplateModel?> GetByNameAsync(string name)
        {
            return await _templateDbContext.Templates
                                           .FirstOrDefaultAsync(t => t.Name == name);
        }

        /// <summary>
        /// Updates an existing template by its ID.
        /// </summary>
        /// <param name="templateId">The ID of the template to update.</param>
        /// <param name="template">The template object containing updated values.</param>
        /// <returns>The updated <see cref="TemplateModel"/> if found; otherwise, null.</returns>
        public async Task<TemplateModel?> UpdateTemplate(int templateId, TemplateModel template)
        {
            var existing = await _templateDbContext.Templates.FindAsync(templateId);
            if (existing == null)
            {
                return null;
            }

            existing.Name = template.Name;
            existing.Subject = template.Subject;
            existing.Body = template.Body;
            existing.TemplateType = template.TemplateType;
            existing.UpdatedAt = DateTime.UtcNow;
            existing.IsActive = template.IsActive;

            await _templateDbContext.SaveChangesAsync();
            return existing;
        }

        /// <summary>
        /// Deletes a template by its ID.
        /// </summary>
        /// <param name="templateId">The ID of the template to delete.</param>
        /// <returns>True if the template was deleted; otherwise, false.</returns>
        public async Task<bool> DeleteTemplate(int templateId)
        {
            var template = await _templateDbContext.Templates.FindAsync(templateId);

            if (template == null)
            {
                return false;
            }
            _templateDbContext.Templates.Remove(template);
            await _templateDbContext.SaveChangesAsync();
            return true;
        }

        /// <summary>
        /// Retrieves all active templates.
        /// </summary>
        /// <returns>A list of <see cref="TemplateModel"/> objects with <c>IsActive</c> set to true.</returns>
        public async Task<List<TemplateModel>> GetActiveTemplatesAsync()
        {
            return await _templateDbContext.Templates
                                           .Where(t => t.IsActive)
                                           .ToListAsync();
        }

        /// <summary>
        /// Retrieves templates by their type.
        /// </summary>
        /// <param name="templateType">The type of templates to retrieve.</param>
        /// <returns>A list of <see cref="TemplateModel"/> objects matching the type.</returns>
        public async Task<List<TemplateModel>> GetByTypeAsync(string templateType)
        {
            return await _templateDbContext.Templates
                                           .Where(t => t.TemplateType == templateType)
                                           .ToListAsync();
        }
    }
}
