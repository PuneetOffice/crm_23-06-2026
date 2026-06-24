using System.Collections.Generic;
using Microsoft.EntityFrameworkCore;
using Elpis_CRM.Model;

namespace Elpis_CRM.Data
{
    public class AppDbContext : DbContext
    {
        public AppDbContext(DbContextOptions<AppDbContext> options) : base(options) { }

        public DbSet<LoginModel> Login { get; set; }
        public DbSet<AccountModel> Accounts { get; set; }
        public DbSet<ContactModel> Contacts { get; set; }
        public DbSet<ProductsModel> Products { get; set; }
        public DbSet<DealModel> Deals { get; set; }
        public DbSet<DealContactLinkModel> DealContactLinks { get; set; }
        public DbSet<TemplateModel> Templates { get; set; }
        public DbSet<CallLogModel> CallLog { get; set; }
        public DbSet<TaskModel> Tasks { get; set; }
        public DbSet<MeetingModel> Meeting { get; set; }
        public DbSet<NotesModel> Notes { get; set; }
        public DbSet<AppointmentsModel> Appointments { get; set; }

        protected override void OnModelCreating(ModelBuilder modelBuilder)
        {
            base.OnModelCreating(modelBuilder);

            modelBuilder.Entity<ContactModel>()
                .Property(x => x.ContactId)
                .ValueGeneratedNever();

            modelBuilder.Entity<AccountModel>()
                .Property(x => x.AccountId)
                .ValueGeneratedNever();

            modelBuilder.Entity<DealModel>()
                .Property(x => x.Id)
                .ValueGeneratedNever();

            modelBuilder.Entity<DealContactLinkModel>()
                .HasKey(x => new { x.DealId, x.ContactId });

            modelBuilder.Entity<DealContactLinkModel>()
                .HasOne(x => x.Deal)
                .WithMany()
                .HasForeignKey(x => x.DealId)
                .OnDelete(DeleteBehavior.Cascade);

            modelBuilder.Entity<DealContactLinkModel>()
                .HasOne(x => x.Contact)
                .WithMany()
                .HasForeignKey(x => x.ContactId)
                .OnDelete(DeleteBehavior.Cascade);
        }
    }
}
