import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { 
  Plus, 
  Target, 
  Archive,
  RotateCcw
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { apiClient } from '../lib/api';
import { 
  type EisenhowerTaskData,
  parseEisenhowerContent,
  QUADRANTS
} from '../lib/eisenhower';
import { EisenhowerMatrix } from '../components/EisenhowerMatrix';
import { AppHeader } from '../components/AppHeader';
import { TaskForm } from '../components/TaskForm';
import type { TaskCreateRequest } from '../lib/eisenhower';
import clsx from 'clsx';

export function MatrixPage() {
  const queryClient = useQueryClient();
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [showArchived, setShowArchived] = useState(false);

  // Fetch Eisenhower tasks
  const { data: tasks = [], isLoading, error } = useQuery({
    queryKey: ['eisenhower-tasks'],
    queryFn: () => apiClient.getEisenhowerTasks(),
    refetchInterval: 30000, // Refresh every 30s
  });

  // Create task mutation
  const createMutation = useMutation({
    mutationFn: (data: TaskCreateRequest) => apiClient.createTask(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['eisenhower-tasks'] });
      setIsFormOpen(false);
    },
  });

  // Update task mutation
  const updateMutation = useMutation({
    mutationFn: ({ taskId, updates }: { taskId: number; updates: Partial<EisenhowerTaskData> }) => {
      if (updates.status === 'completed') {
        return apiClient.completeTask(taskId);
      }
      if (updates.status === 'archived') {
        return apiClient.archiveTask(taskId);
      }

      if (updates.quadrant) {
        return apiClient.updateTaskQuadrant(taskId, updates.quadrant);
      }

      return Promise.resolve(null);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['eisenhower-tasks'] });
    },
  });

  // Delete task mutation
  const deleteMutation = useMutation({
    mutationFn: apiClient.deleteEvent,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['eisenhower-tasks'] });
    },
  });

  const handleTaskUpdate = (taskId: number, updates: Partial<EisenhowerTaskData>) => {
    updateMutation.mutate({ taskId, updates });
  };

  const handleTaskCreate = (taskData: TaskCreateRequest) => {
    createMutation.mutate(taskData);
  };

  const handleTaskDelete = (taskId: number) => {
    if (confirm('Are you sure you want to delete this task?')) {
      deleteMutation.mutate(taskId);
    }
  };

  // Filter tasks based on view
  const filteredTasks = tasks.filter(task => {
    const eisenhowerData = parseEisenhowerContent(task.content);
    if (!eisenhowerData) return false;
    
    if (showArchived) {
      return eisenhowerData.data.status === 'archived';
    } else {
      return eisenhowerData.data.status !== 'archived';
    }
  });

  // Calculate statistics
  const stats = QUADRANTS.map(quadrant => {
    const quadrantTasks = filteredTasks.filter(task => {
      const eisenhowerData = parseEisenhowerContent(task.content);
      return eisenhowerData?.data.quadrant === quadrant.id;
    });
    
    const completed = quadrantTasks.filter(task => {
      const eisenhowerData = parseEisenhowerContent(task.content);
      return eisenhowerData?.data.status === 'completed';
    }).length;
    
    return {
      quadrant,
      total: quadrantTasks.length,
      completed,
      inProgress: quadrantTasks.filter(task => {
        const eisenhowerData = parseEisenhowerContent(task.content);
        return eisenhowerData?.data.status === 'in_progress';
      }).length,
    };
  });

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="text-red-600 mb-4">Failed to load tasks</div>
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-24">
      {/* Header */}
      <AppHeader>
        {/* Archived toggle */}
        <button
          onClick={() => setShowArchived(!showArchived)}
          className={clsx(
            'btn-ghost p-2 rounded-lg flex items-center gap-2',
            showArchived && 'bg-q4-100 text-q4-700'
          )}
        >
          <Archive className="w-5 h-5" />
          <span className="hidden sm:inline">
            {showArchived ? 'Active' : 'Archived'}
          </span>
        </button>

        {/* Refresh */}
        <button
          onClick={() => queryClient.invalidateQueries({ queryKey: ['eisenhower-tasks'] })}
          className="btn-ghost p-2 rounded-lg"
          disabled={isLoading}
        >
          <RotateCcw className={clsx('w-5 h-5', isLoading && 'animate-spin')} />
        </button>
      </AppHeader>

      {/* Stats Bar */}
      <div className="bg-surface-900/50 backdrop-blur border-b border-surface-800">
        <div className="max-w-7xl mx-auto px-4 py-3">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {stats.map(({ quadrant, total, completed, inProgress }) => (
              <div key={quadrant.id} className="text-center">
                <div className={clsx('font-semibold', quadrant.textColor)}>
                  {quadrant.name}
                </div>
                <div className="text-2xl font-bold text-white">{total}</div>
                <div className="text-xs text-surface-500">
                  {completed} completed
                  {inProgress > 0 && ` • ${inProgress} in progress`}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Main content */}
      <main className="max-w-7xl mx-auto px-4 py-6">
        {isLoading ? (
          <div className="text-center py-12">
            <div className="w-8 h-8 border-2 border-q2-500 border-t-transparent rounded-full animate-spin mx-auto" />
            <p className="mt-4 text-surface-400">Loading your tasks...</p>
          </div>
        ) : (
          <EisenhowerMatrix
            tasks={filteredTasks}
            onTaskUpdate={handleTaskUpdate}
            onTaskCreate={handleTaskCreate}
            onTaskDelete={handleTaskDelete}
          />
        )}

        {/* Empty state */}
        {!isLoading && filteredTasks.length === 0 && (
          <div className="text-center py-12">
            <Target className="w-16 h-16 mx-auto mb-4 text-surface-600" />
            <h3 className="text-xl font-semibold text-white mb-2">
              {showArchived ? 'No archived tasks' : 'Start with a brain dump'}
            </h3>
            <p className="text-surface-500 mb-6">
              {showArchived 
                ? 'Archived tasks will appear here'
                : 'Add everything on your mind. Then drag each task into the right quadrant.'
              }
            </p>
            {!showArchived && (
              <div className="max-w-2xl mx-auto text-left text-sm text-surface-400 mb-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="card p-4">
                    <div className="font-semibold text-white">Do First</div>
                    <div>Urgent + Important</div>
                  </div>
                  <div className="card p-4">
                    <div className="font-semibold text-white">Schedule</div>
                    <div>Not urgent + Important</div>
                  </div>
                  <div className="card p-4">
                    <div className="font-semibold text-white">Delegate</div>
                    <div>Urgent + Not important</div>
                  </div>
                  <div className="card p-4">
                    <div className="font-semibold text-white">Eliminate</div>
                    <div>Not urgent + Not important</div>
                  </div>
                </div>
              </div>
            )}
            {!showArchived && (
              <button
                onClick={() => setIsFormOpen(true)}
                className="btn btn-primary"
              >
                <Plus className="w-4 h-4" />
                Create Task
              </button>
            )}
            {!showArchived && (
              <div className="mt-4">
                <Link to="/guide" className="text-sm text-q2-400 hover:underline">
                  Read the Eisenhower guide
                </Link>
              </div>
            )}
          </div>
        )}
      </main>

      {/* FAB */}
      <motion.button
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={() => setIsFormOpen(true)}
        className="fixed bottom-6 right-6 w-14 h-14 bg-q2-500 text-white rounded-full shadow-lg shadow-q2-500/40 flex items-center justify-center z-40"
      >
        <Plus className="w-6 h-6" />
      </motion.button>

      {/* Task Form Modal */}
      <TaskForm
        isOpen={isFormOpen}
        onClose={() => {
          setIsFormOpen(false);
        }}
        onSubmit={handleTaskCreate}
      />
    </div>
  );
}