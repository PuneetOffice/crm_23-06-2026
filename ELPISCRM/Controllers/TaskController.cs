using Elpis_CRM.Model;
using Elpis_CRM.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using System.Threading.Tasks;

namespace Elpis_CRM.Controllers
{
    /// <summary>
    /// Controller for managing tasks in the CRM system.
    /// </summary>
    [Route("api/[controller]")]
    [ApiController]
    public class TaskListController : ControllerBase
    {
        private readonly TaskService _taskService;

        /// <summary>
        /// Constructor
        /// </summary>
        public TaskListController(TaskService taskService)
        {
            _taskService = taskService;
        }

        /// <summary>
        /// Add new task
        /// </summary>
        [HttpPost]
        [Authorize(AuthenticationSchemes = JwtBearerDefaults.AuthenticationScheme, Roles = "Admin,Manager,User")]
        public async Task<IActionResult> Add([FromBody] TaskModel task)
        {
            if (task == null)
            {
                return BadRequest("Invalid task data");
            }

            var created = await _taskService.AddTask(task);

            return CreatedAtAction(
                nameof(GetById),
                new { taskId = created.Id },
                created
            );
        }

        /// <summary>
        /// Get all tasks
        /// </summary>
        [HttpGet]
        [Authorize(AuthenticationSchemes = JwtBearerDefaults.AuthenticationScheme, Roles = "Admin,Manager,User")]
        public async Task<IActionResult> GetAll()
        {
            var tasks = await _taskService.GetAllTasks();
            return Ok(tasks);
        }

        /// <summary>
        /// Get task by Id
        /// </summary>
        [HttpGet("{taskId:long}")]
        [Authorize(AuthenticationSchemes = JwtBearerDefaults.AuthenticationScheme, Roles = "Admin,Manager,User")]
        public async Task<IActionResult> GetById(int taskId)
        {
            var task = await _taskService.GetById(taskId);

            if (task == null)
            {
                return NotFound("Task not found");
            }

            return Ok(task);
        }

          /// <summary>
        /// Get tasks by ContactId
        /// </summary>
        [HttpGet("contact/{contactId:long}")]
        [Authorize(AuthenticationSchemes = JwtBearerDefaults.AuthenticationScheme, Roles = "Admin,Manager,User")]
        public async Task<IActionResult> GetTasksByContactId(long contactId)
        {
            var tasks = await _taskService.GetTasksByContactIdAsync(contactId);
            return Ok(tasks);
        }

        /// <summary>
        /// Update task
        /// </summary>
        [HttpPut("{taskId:long}")]
        [Authorize(AuthenticationSchemes = JwtBearerDefaults.AuthenticationScheme, Roles = "Admin,Manager,User")]
        public async Task<IActionResult> Update(int taskId, [FromBody] TaskModel task)
        {
            var updated = await _taskService.UpdateTask(taskId, task);

            if (updated == null)
            {
                return NotFound("Task not found");
            }

            return Ok(updated);
        }

        /// <summary>
        /// Delete task
        /// </summary>
        [HttpDelete("{taskId:long}")]
        [Authorize(AuthenticationSchemes = JwtBearerDefaults.AuthenticationScheme, Roles = "Admin")]
        public async Task<IActionResult> Delete(int taskId)
        {
            var deleted = await _taskService.DeleteTask(taskId);

            if (!deleted)
            {
                return NotFound("Task not found");
            }

            return Ok("Task deleted successfully");
        }

        /// <summary>
        /// Get tasks with due reminders
        /// </summary>
        [HttpGet("due-reminders")]
        [Authorize(AuthenticationSchemes = JwtBearerDefaults.AuthenticationScheme, Roles = "Admin,Manager,User")]
        public async Task<IActionResult> GetDueReminders()
        {
            var reminders = await _taskService.GetDueReminders();
            return Ok(reminders);
        }

        /// <summary>
        /// Mark reminder as sent
        /// </summary>
        [HttpPost("{taskId:int}/mark-reminder-sent")]
        [Authorize(AuthenticationSchemes = JwtBearerDefaults.AuthenticationScheme, Roles = "Admin,Manager,User")]
        public async Task<IActionResult> MarkReminderAsSent(int taskId)
        {
            var result = await _taskService.MarkReminderAsSent(taskId);

            if (!result)
            {
                return NotFound("Task not found");
            }

            return Ok("Reminder marked as sent");
        }
    }
}