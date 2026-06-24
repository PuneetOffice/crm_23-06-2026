using Elpis_CRM.Data;
using Elpis_CRM.Model;
using Microsoft.EntityFrameworkCore;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;

namespace Elpis_CRM.Services
{
    /// <summary>
    /// Service class to handle CRUD operations for products.
    /// </summary>
    public class ProductService
    {
        private readonly AppDbContext _productDb;

        /// <summary>
        /// Initializes a new instance of the <see cref="ProductService"/> class.
        /// </summary>
        /// <param name="productDb">The database context for products.</param>
        public ProductService(AppDbContext productDb)
        {
            _productDb = productDb;
        }

        /// <summary>
        /// Retrieves all products.
        /// </summary>
        /// <returns>A list of <see cref="ProductsModel"/> objects.</returns>
        public async Task<List<ProductsModel>> GetAllAsync()
        {
            var productList = await _productDb.Products.ToListAsync();
            return productList;
        }

        /// <summary>
        /// Retrieves a product by its ID.
        /// </summary>
        /// <param name="productId">The ID of the product.</param>
        /// <returns>The <see cref="ProductsModel"/> if found; otherwise, null.</returns>
        public async Task<ProductsModel?> GetByIdAsync(int productId)
        {
            return await _productDb.Products.FindAsync(productId);
        }

        /// <summary>
        /// Retrieves a product by its name.
        /// </summary>
        /// <param name="name">The name of the product.</param>
        /// <returns>The <see cref="ProductsModel"/> if found; otherwise, null.</returns>
        public async Task<ProductsModel?> GetProductByNameAsync(string name)
        {
            return await _productDb.Products
                .FirstOrDefaultAsync(p => p.Name == name);
        }

        /// <summary>
        /// Retrieves products by their category.
        /// </summary>
        /// <param name="category">The category name.</param>
        /// <returns>A list of <see cref="ProductsModel"/> in the specified category.</returns>
        public async Task<List<ProductsModel>> GetByCategoryAsync(string category)
        {
            var productCategory = await _productDb.Products
                                   .Where(p => p.Category == category)
                                   .ToListAsync();
            return productCategory;
        }

        /// <summary>
        /// Adds a new product.
        /// </summary>
        /// <param name="product">The <see cref="ProductsModel"/> to add.</param>
        /// <returns>The added <see cref="ProductsModel"/> with updated timestamps.</returns>
        public async Task<ProductsModel> AddAsync(ProductsModel product)
        {
            product.CreatedAt = DateTime.UtcNow;
            product.UpdatedAt = DateTime.UtcNow;

            _productDb.Products.Add(product);
            await _productDb.SaveChangesAsync();
            return product;
        }

        /// <summary>
        /// Updates an existing product.
        /// </summary>
        /// <param name="productId">The ID of the product to update.</param>
        /// <param name="product">The <see cref="ProductsModel"/> containing updated values.</param>
        /// <returns>The updated <see cref="ProductsModel"/> if found; otherwise, null.</returns>
        public async Task<ProductsModel?> UpdateAsync(int productId, ProductsModel product)
        {
            var existing = await _productDb.Products.FindAsync(productId);
            if (existing == null)
            {
                return null;
            }

            existing.Name = product.Name;
            existing.Active = product.Active;
            existing.BaseCurrencyAmount = product.BaseCurrencyAmount;
            existing.Category = product.Category;
            existing.UpdatedAt = DateTime.UtcNow;
            existing.UpdatedBy = product.UpdatedBy;

            await _productDb.SaveChangesAsync();
            return existing;
        }

        /// <summary>
        /// Deletes a product by its ID.
        /// </summary>
        /// <param name="productId">The ID of the product to delete.</param>
        /// <returns>True if the product was deleted; otherwise, false.</returns>
        public async Task<bool> DeleteAsync(int productId)
        {
            var product = await _productDb.Products.FindAsync(productId);

            if (product == null)
            {
                return false;
            }
            _productDb.Products.Remove(product);
            await _productDb.SaveChangesAsync();
            return true;
        }
    }
}
