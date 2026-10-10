import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useDrop } from 'react-dnd';
import { Plus, GripVertical } from 'lucide-react';
import { type Event } from '../lib/api';
import { 
  type EisenhowerContent,
  type EisenhowerTaskData,
  type Quadrant as QuadrantType,
  type TaskCreateRequest
} from '../lib/eisenhower';
import { TaskCard } from './TaskCard';
import { TaskForm } from './TaskForm';
import clsx from 'clsx';

interface QuadrantProps {
  quadrant: QuadrantType;
  tasks: { task: Event; eisenhowerData: EisenhowerContent }[];
  onTaskUpdate: (taskId: number, updates: Partial<EisenhowerTaskData>) => void;
  onTaskCreate: (taskData: TaskCreateRequest) => void;
  onTaskDelete: (taskId: number) => void;
}

interface DraggableTask {
  task: Event;
  eisenhowerData: EisenhowerContent;
}

export function Quadrant({ 
  quadrant, 
  tasks, 
  onTaskUpdate, 
  onTaskCreate, 
  onTaskDelete 
}: QuadrantProps) {
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);

  // Sort tasks by priority score and creation date
  const sortedTasks = [...tasks].sort((a, b) => {
    const aPriority = a.eisenhowerData.data.priority_score || 0;
    const bPriority = b.eisenhowerData.data.priority_score || 0;
    if (aPriority !== bPriority) {
      return bPriority - aPriority; // Higher priority first
    }
    return new Date(b.task.created_at).getTime() - new Date(a.task.created_at).getTime();
  });

  const [, drop] = useDrop({
    accept: 'task',
    drop: (item: DraggableTask) => {
      if (item.eisenhowerData.data.quadrant !== quadrant.id) {
        onTaskUpdate(item.task.id, { quadrant: quadrant.id });
      }
    },
    collect: (monitor) => ({
      isOver: !!monitor.isOver(),
    }),
  });



  // Limit display for performance
  const displayTasks = sortedTasks.slice(0, 50);
  const hasMoreTasks = sortedTasks.length > 50;

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className={clsx(
        'p-4 border-b-2 flex items-center justify-between',
        quadrant.borderColor
      )}>
        <div>
          <h2 className={clsx('font-bold text-lg', quadrant.textColor)}>
            {quadrant.name}
          </h2>
          <p className={clsx('text-sm opacity-75', quadrant.textColor)}>
            {quadrant.description}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className={clsx(
            'px-3 py-1 rounded-full text-sm font-medium',
            quadrant.bgColor,
            quadrant.textColor
          )}>
            {tasks.length}
          </span>
          <button
            onClick={() => setIsFormOpen(true)}
            className={clsx(
              'p-2 rounded-lg hover:bg-white/50 transition-colors',
              'focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-white',
              `focus:ring-${quadrant.color}-500`
            )}
          >
            <Plus className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Task List */}
      <div 
        ref={(node) => {
          drop(node);
          // Store for drag state
          if (node) {
            node.addEventListener('dragover', () => setIsDragOver(true));
            node.addEventListener('dragleave', () => setIsDragOver(false));
            node.addEventListener('drop', () => setIsDragOver(false));
          }
        }}
        className={clsx(
          'flex-1 p-4 overflow-y-auto',
          isDragOver && quadrant.bgColor
        )}
      >
        <AnimatePresence mode="popLayout">
          {sortedTasks.length === 0 ? (
            <motion.div
              key="empty"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="text-center py-12"
            >
              <GripVertical className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p className={clsx('text-sm', quadrant.textColor, 'opacity-75')}>
                No tasks yet. Add one to get started!
              </p>
            </motion.div>
          ) : (
            displayTasks.map(({ task, eisenhowerData }) => (
              <motion.div
                key={task.id}
                layout
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 10 }}
                className="mb-3"
              >
                <TaskCard
                  event={task}
                  eisenhowerData={eisenhowerData}
                  onUpdate={onTaskUpdate}
                  onDelete={onTaskDelete}
                />
              </motion.div>
            ))
          )}
        </AnimatePresence>

        {hasMoreTasks && (
          <div className={clsx(
            'text-center py-4 text-sm',
            quadrant.textColor,
            'opacity-75'
          )}>
            +{sortedTasks.length - 50} more tasks
          </div>
        )}
      </div>

      {/* Add Task Form */}
      <TaskForm
        isOpen={isFormOpen}
        onClose={() => setIsFormOpen(false)}
        onSubmit={onTaskCreate}
        defaultQuadrant={quadrant.id}
      />
    </div>
  );
}