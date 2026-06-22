import { useEffect } from 'react';
import { toast } from 'react-toastify';
import apiClient from '../api/client';
import { Clock, CheckCircle2, X } from 'lucide-react';

// Track which tasks we've already notified to avoid duplicates
const notifiedTasks = new Set();

// Show task reminder notification
const showTaskReminder = (task, minutesDiff) => {
    const taskTitle = task.Title || task.title || 'Untitled Task';
    const taskDescription = task.Description || task.description || '';
    
    // Format time remaining message
    let timeMsg = '';
    if (minutesDiff < 0) {
        timeMsg = 'Overdue!';
    } else if (minutesDiff === 0) {
        timeMsg = 'Due now';
    } else if (minutesDiff < 60) {
        timeMsg = `Due in ${minutesDiff} min`;
    } else {
        timeMsg = 'Due soon';
    }
    
    const ReminderContent = () => (
        <div className="w-full">
            <div className="flex items-start gap-2 mb-1">
                <div className="p-1.5 bg-blue-100 rounded-lg flex-shrink-0">
                    <Clock className="w-4 h-4 text-blue-600" />
                </div>
                <h3 className="font-bold text-gray-900 text-sm">{taskTitle}</h3>
            </div>
            
            {taskDescription && (
                <div className="text-xs text-gray-600 mb-2 line-clamp-1">
                    {taskDescription}
                </div>
            )}
            
            <div className="flex items-center gap-2 justify-between">
                <div className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold ${
                    minutesDiff < 0 ? 'bg-red-100 text-red-800' : 'bg-amber-100 text-amber-800'
                }`}>
                    <Clock className="w-3 h-3" />
                    {timeMsg}
                </div>
                
                <button
                    onClick={() => {
                        toast.dismiss();
                    }}
                    className="flex items-center gap-1 px-2.5 py-1 bg-green-100 hover:bg-green-200 text-green-700 rounded text-xs font-medium transition-colors"
                >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    OK
                </button>
            </div>
        </div>
    );
    
    toast.info(<ReminderContent />, {
        position: 'top-right',
        autoClose: false,
        hideProgressBar: false,
        closeOnClick: true,
        closeButton: ({ closeToast }) => (
            <button 
                onClick={closeToast}
                className="p-1 hover:bg-white/20 rounded transition-colors"
            >
                <X className="w-4 h-4 text-gray-600" />
            </button>
        ),
        style: {
            backgroundColor: '#f8fafc',
            borderRadius: '8px',
            boxShadow: '0 10px 25px rgba(0, 0, 0, 0.15)',
            padding: '12px 16px',
        },
    });
};

// Alternative client-side reminder checker - checks task due dates locally
const checkClientSideReminders = () => {
    try {
        // Get tasks from window object (exposed by ContactEmailLogs)
        if (!window.allTasks || !Array.isArray(window.allTasks)) return;

        const now = new Date();
        
        window.allTasks.forEach((task) => {
            const taskId = task.TaskId || task.taskId || task.id;
            if (!taskId || notifiedTasks.has(taskId)) return;
            
            const dueDate = task.DueDate || task.dueDate;
            if (!dueDate) return;
            
            const dueDateObj = new Date(dueDate);
            const timeDiff = dueDateObj - now;
            const minutesDiff = Math.floor(timeDiff / (1000 * 60));
            
            // Show notification for tasks due in next 60 minutes and not completed
            const taskStatus = (task.Status || task.status || '').toLowerCase();
            if (minutesDiff >= -5 && minutesDiff <= 60 && taskStatus !== 'completed') {
                showTaskReminder(task, minutesDiff);
                notifiedTasks.add(taskId);
            }
        });
    } catch (error) {
        // Silently fail - this is a fallback system
    }
};

export const useTaskReminders = () => {
    useEffect(() => {
        // Check for due reminders every 30 seconds
        const interval = setInterval(async () => {
            try {
                // Try backend first (with silent error handling)
                const response = await apiClient.get('/TaskList/due-reminders');
                const reminders = response.data;

                reminders.forEach(async (task) => {
                    const advanceMinutes = task.reminderAdvanceMinutes ?? task.ReminderAdvanceMinutes;
                    const taskTitle = task.title || task.Title || 'Untitled Task';
                    const taskDescription = task.description || task.Description || '';
                    
                    const ReminderContent = () => (
                        <div className="w-full">
                            <div className="flex items-start gap-2 mb-1">
                                <div className="p-1.5 bg-blue-100 rounded-lg flex-shrink-0">
                                    <Clock className="w-4 h-4 text-blue-600" />
                                </div>
                                <h3 className="font-bold text-gray-900 text-sm">{taskTitle}</h3>
                            </div>
                            
                            {taskDescription && (
                                <div className="text-xs text-gray-600 mb-2 line-clamp-1">
                                    {taskDescription}
                                </div>
                            )}
                            
                            <div className="flex items-center gap-2 justify-between">
                                <div className="inline-flex items-center gap-1 bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full text-xs font-semibold">
                                    <Clock className="w-3 h-3" />
                                    {advanceMinutes && advanceMinutes !== 0 ? `${advanceMinutes} mins before` : 'Now'}
                                </div>
                                
                                <button
                                    onClick={async () => {
                                        try {
                                            await apiClient.patch(`/tasklist/${task.taskId || task.TaskId}`, { 
                                                isReminderSent: true 
                                            });
                                            toast.dismiss();
                                        } catch (error) {
                                            // Silent fail
                                        }
                                    }}
                                    className="flex items-center gap-1 px-2.5 py-1 bg-green-100 hover:bg-green-200 text-green-700 rounded text-xs font-medium transition-colors"
                                >
                                    <CheckCircle2 className="w-3.5 h-3.5" />
                                    Done
                                </button>
                            </div>
                        </div>
                    );
                    
                    toast.info(<ReminderContent />, {
                        position: 'top-right',
                        autoClose: false,
                        hideProgressBar: false,
                        closeOnClick: true,
                        closeButton: ({ closeToast }) => (
                            <button 
                                onClick={closeToast}
                                className="p-1 hover:bg-white/20 rounded transition-colors"
                            >
                                <X className="w-4 h-4 text-gray-600" />
                            </button>
                        ),
                        style: {
                            backgroundColor: '#f8fafc',
                            borderRadius: '8px',
                            boxShadow: '0 10px 25px rgba(0, 0, 0, 0.15)',
                            padding: '12px 16px',
                        },
                    });

                    try {
                        await apiClient.post(
                            `/tasklist/${task.taskId || task.TaskId}/mark-reminder-sent`
                        );
                    } catch (error) {
                        // Silent fail
                    }
                });
            } catch (error) {
                // Backend failed - fall back to client-side checking
                checkClientSideReminders();
            }
        }, 30000); // 30 seconds

        return () => clearInterval(interval);
    }, []);
};
