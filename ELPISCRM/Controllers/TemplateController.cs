using Elpis_CRM.Model;
using Elpis_CRM.Service;
using Microsoft.AspNetCore.Mvc;
using System.Collections.Generic;
using System.Threading.Tasks;

namespace Elpis_CRM.Controllers
{
    /// <summary>
    /// Controller for managing templates in the CRM system.
    /// </summary>
    [Route("api/[controller]")]
    [ApiController]
    public class TemplateController : ControllerBase
    {
        private readonly TemplateService _templateService;

        /// <summary>
        /// Initializes a new instance of the <see cref="TemplateController"/> class.
        /// </summary>
        /// <param name="templateService">Service for template operations.</param>
        public TemplateController(TemplateService templateService)
        {
            _templateService = templateService;
        }

        /// <summary>
        /// Creates a new template.
        /// </summary>
        /// <param name="template">Template details to create.</param>
        /// <returns>The created template.</returns>
        /// <response code="201">Template created successfully</response>
        [HttpPost]
        public async Task<ActionResult<TemplateModel>> Create([FromBody] TemplateModel template)
        {
            var created = await _templateService.AddTemplate(template);
            return CreatedAtAction(nameof(GetById), new { id = created.TemplateId }, created);
        }

        /// <summary>
        /// Retrieves all templates.
        /// </summary>
        /// <returns>List of all templates.</returns>
        [HttpGet]
        public async Task<ActionResult<List<TemplateModel>>> GetAll()
        {
            return Ok(await _templateService.GetAllAsync());
        }

        /// <summary>
        /// Retrieves a template by its ID.
        /// </summary>
        /// <param name="id">ID of the template.</param>
        /// <returns>The template with the specified ID.</returns>
        /// <response code="200">Template found</response>
        /// <response code="404">Template not found</response>
        [HttpGet("{id:int}")]
        public async Task<ActionResult<TemplateModel>> GetById(int id)
        {
            var template = await _templateService.GetByIdAsync(id);
            if (template == null)
            {
                return NotFound($"No template found for ID '{id}'.");
            }
            return Ok(template);
        }

        /// <summary>
        /// Retrieves a template by its name.
        /// </summary>
        /// <param name="name">Name of the template.</param>
        /// <returns>The template with the specified name.</returns>
        /// <response code="200">Template found</response>
        /// <response code="404">Template not found</response>
        [HttpGet("name/{name}")]
        public async Task<ActionResult<TemplateModel>> GetByName(string name)
        {
            var template = await _templateService.GetByNameAsync(name);
            if (template == null)
            {
                return NotFound($"No template found for name '{name}'.");
            }
            return Ok(template);
        }

        /// <summary>
        /// Retrieves all active templates.
        /// </summary>
        /// <returns>List of active templates.</returns>
        [HttpGet("active")]
        public async Task<ActionResult<List<TemplateModel>>> GetActiveTemplates()
        {
            var templates = await _templateService.GetActiveTemplatesAsync();
            return Ok(templates);
        }

        /// <summary>
        /// Retrieves templates by their type.
        /// </summary>
        /// <param name="templateType">Type of template.</param>
        /// <returns>List of templates with the specified type.</returns>
        [HttpGet("type/{templateType}")]
        public async Task<ActionResult<List<TemplateModel>>> GetByType(string templateType)
        {
            var templates = await _templateService.GetByTypeAsync(templateType);
            return Ok(templates);
        }

        /// <summary>
        /// Updates an existing template.
        /// </summary>
        /// <param name="id">ID of the template to update.</param>
        /// <param name="template">Updated template details.</param>
        /// <returns>Confirmation of update.</returns>
        /// <response code="200">Template updated successfully</response>
        /// <response code="404">Template not found</response>
        [HttpPut("{id:int}")]
        public async Task<ActionResult<TemplateModel>> UpdateTemplate(int id, [FromBody] TemplateModel template)
        {
            var updated = await _templateService.UpdateTemplate(id, template);
            if (updated == null)
            {
                return NotFound($"Template with ID '{id}' not found.");
            }
            return Ok("Updated successfully");
        }

        /// <summary>
        /// Deletes a template by its ID.
        /// </summary>
        /// <param name="id">ID of the template to delete.</param>
        /// <returns>Confirmation of deletion.</returns>
        /// <response code="200">Template deleted successfully</response>
        /// <response code="404">Template not found</response>
        [HttpDelete("{id:int}")]
        public async Task<ActionResult> Delete(int id)
        {
            var result = await _templateService.DeleteTemplate(id);
            if (!result)
            {
                return NotFound($"Template with ID '{id}' not found.");
            }
            return Ok("Deleted Successfully");
        }
    }
}
