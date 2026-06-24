using Elpis_CRM.Data;
using Elpis_CRM.Model;
using Microsoft.EntityFrameworkCore;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;

namespace Elpis_CRM.Services
{
    public class TaskService
    {
        private readonly AppDbContext _taskDb;

        public TaskService(AppDbContext taskDb)
        {
            _taskDb = taskDb;
        }

        // Add Task
        public async Task<TaskModel> AddTask(TaskModel task)
        {
            task.CreatedAt = DateTime.UtcNow;
            task.UpdatedAt = DateTime.UtcNow;
           

            _taskDb.Tasks.Add(task);
            await _taskDb.SaveChangesAsync();

            return task;
        }

        // GET ALL TASKS
        public async Task<List<TaskModel>> GetAllTasks()
        {
            return await _taskDb.Tasks.ToListAsync();
        }

        // GET TASK BY ID
        public async Task<TaskModel?> GetById(int id)
        {
            return await _taskDb.Tasks.FindAsync(id);
        }
        
        // GET TASKS BY CONTACT ID
        public async Task<List<TaskModel>> GetTasksByContactIdAsync(long contactId)
        {
            return await _taskDb.Tasks
                .AsNoTracking()
                .Where(t => t.ContactId == contactId)
                .OrderByDescending(t => t.DueDate ?? DateTime.MinValue)
                .ThenByDescending(t => t.CreatedAt ?? DateTime.MinValue)
                .ToListAsync();
        }
        
        // UPDATE TASK
        public async Task<TaskModel?> UpdateTask(int id, TaskModel task)
        {
            var existing = await _taskDb.Tasks.FindAsync(id);

            if (existing == null)
            {
                return null;
            }
            existing.Title = task.Title;
            existing.Description = task.Description;
            existing.Status = task.Status;
            existing.TaskType = task.TaskType;
            existing.DueDate = task.DueDate;
            existing.CompletedDate = task.CompletedDate;
            existing.Outcome = task.Outcome;
            existing.OwnerId = task.OwnerId;
            existing.CreatedById = task.CreatedById;
            existing.UpdatedById = task.UpdatedById;
            existing.UpdatedAt = DateTime.UtcNow;

            await _taskDb.SaveChangesAsync();
            return existing;
        }

        // DELETE TASK
        public async Task<bool> DeleteTask(int id)
        {
            var task = await _taskDb.Tasks.FindAsync(id);

            if (task == null)
            {
                return false;
            }
            _taskDb.Tasks.Remove(task);
            await _taskDb.SaveChangesAsync();

            return true;
        }

        // GET TASKS DUE TODAY
        public async Task<List<TaskModel>> GetTasksDueToday()
        {
            DateTime today = DateTime.Today;

            return await _taskDb.Tasks
                .Where(t => t.DueDate.HasValue && t.DueDate.Value.Date == today)
                .ToListAsync();
        }

        // GET TASKS WITH DUE REMINDERS - Returns empty (reminders handled client-side)
        public async Task<List<TaskModel>> GetDueReminders()
        {
            // Reminder functionality is handled client-side in useTaskReminders hook
            // Return empty list to maintain API compatibility
            return await Task.FromResult(new List<TaskModel>());
        }

        // MARK REMINDER AS SENT - No-op (reminders handled client-side)
        public async Task<bool> MarkReminderAsSent(int id)
        {
            // Reminder functionality is handled client-side
            // Return true to indicate successful processing
            return await Task.FromResult(true);
        }
    }
}