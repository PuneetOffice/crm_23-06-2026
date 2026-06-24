using Elpis_CRM.Model;
using Elpis_CRM.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using System;
using System.Threading.Tasks;

namespace Elpis_CRM.Controllers
{
    /// <summary>
    /// Controller for managing products in the CRM system.
    /// </summary>
    [ApiController]
    [Route("api/[controller]")]
    public class ProductsController : ControllerBase
    {
        private readonly ProductService _productService;

        /// <summary>
        /// Initializes a new instance of the <see cref="ProductsController"/> class.
        /// </summary>
        /// <param name="productService">Service for product-related operations.</param>
        public ProductsController(ProductService productService)
        {
            _productService = productService;
        }

        /// <summary>
        /// Retrieves all products.
        /// </summary>
        /// <returns>A list of all products.</returns>
        [HttpGet]
        [Authorize(AuthenticationSchemes = JwtBearerDefaults.AuthenticationScheme, Roles = "Admin,Manager,User")]
        public async Task<IActionResult> GetAll()
        {
            try
            {
                var products = await _productService.GetAllAsync();
                return Ok(products);
            }
            catch (Exception ex)
            {
                // Development-time convenience: return exception details as JSON to help debugging.
                // Remove or restrict this in production.
                return StatusCode(500, new { message = ex.Message, detail = ex.ToString() });
            }
        }

        /// <summary>
        /// Retrieves a product by its unique ID.
        /// </summary>
        /// <param name="id">The product ID.</param>
        /// <returns>The product matching the specified ID.</returns>
        /// <response code="200">Product retrieved successfully</response>
        /// <response code="404">Product not found</response>
        [HttpGet("{id:int}")]
        [Authorize(AuthenticationSchemes = JwtBearerDefaults.AuthenticationScheme, Roles = "Admin,Manager,User")]
        public async Task<IActionResult> GetById(int id)
        {
            var product = await _productService.GetByIdAsync(id);
            if (product == null)
            {
                return NotFound($"Product with ID '{id}' not found.");
            }
            return Ok(product);
        }

        /// <summary>
        /// Retrieves a product by its name.
        /// </summary>
        /// <param name="name">The name of the product.</param>
        /// <returns>The product matching the specified name.</returns>
        /// <response code="200">Product retrieved successfully</response>
        /// <response code="404">Product not found</response>
        [HttpGet("name/{name}")]
        [Authorize(AuthenticationSchemes = JwtBearerDefaults.AuthenticationScheme, Roles = "Admin,Manager,User")]
        public async Task<IActionResult> GetByName(string name)
        {
            var product = await _productService.GetProductByNameAsync(name);
            if (product == null)
            {
                return NotFound($"Product with name '{name}' not found.");
            }
            return Ok(product);
        }

        /// <summary>
        /// Retrieves products belonging to a specific category.
        /// </summary>
        /// <param name="category">The category name.</param>
        /// <returns>A list of products in the specified category.</returns>
        [HttpGet("category/{category}")]
        [Authorize(AuthenticationSchemes = JwtBearerDefaults.AuthenticationScheme, Roles = "Admin,Manager,User")]
        public async Task<IActionResult> GetByCategory(string category)
        {
            var products = await _productService.GetByCategoryAsync(category);
            return Ok(products);
        }

        /// <summary>
        /// Adds a new product to the system.
        /// </summary>
        /// <param name="product">The product details.</param>
        /// <returns>The created product.</returns>
        /// <response code="201">Product created successfully</response>
        [HttpPost]
        [Authorize(AuthenticationSchemes = JwtBearerDefaults.AuthenticationScheme, Roles = "Admin,Manager,User")]
        public async Task<IActionResult> Add([FromBody] ProductsModel product)
        {
            if (product == null)
            {
                return BadRequest("Product payload is null");
            }

            if (!ModelState.IsValid)
            {
                return BadRequest(ModelState);
            }

            try
            {
                var added = await _productService.AddAsync(product);
                return CreatedAtAction(nameof(GetById), new { id = added.ProductId }, added);
            }
            catch (Exception ex)
            {
                // Dev-only: return exception details to help debugging
                return StatusCode(500, new { message = ex.Message, detail = ex.ToString() });
            }
        }

        /// <summary>
        /// Updates an existing product.
        /// </summary>
        /// <param name="id">The ID of the product to update.</param>
        /// <param name="product">The updated product details.</param>
        /// <returns>The updated product.</returns>
        /// <response code="200">Product updated successfully</response>
        /// <response code="404">Product not found</response>
        [HttpPut("{id:int}")]
        [Authorize(AuthenticationSchemes = JwtBearerDefaults.AuthenticationScheme, Roles = "Admin,Manager")]
        public async Task<IActionResult> Update(int id, [FromBody] ProductsModel product)
        {
            var updated = await _productService.UpdateAsync(id, product);
            if (updated == null)
            {
                return NotFound($"Product with ID '{id}' not found.");
            }
            return Ok(updated);
        }

        /// <summary>
        /// Deletes a product by its ID.
        /// </summary>
        /// <param name="id">The product ID.</param>
        /// <returns>Confirmation message.</returns>
        /// <response code="200">Product deleted successfully</response>
        /// <response code="404">Product not found</response>
        [HttpDelete("{id:int}")]
        [Authorize(AuthenticationSchemes = JwtBearerDefaults.AuthenticationScheme, Roles = "Admin")]
        public async Task<IActionResult> Delete(int id)
        {
            var deleted = await _productService.DeleteAsync(id);
            if (!deleted)
            {
                return NotFound($"Product with ID '{id}' not found.");
            }
            return Ok("Deleted Successfully");
        }
    }
}
