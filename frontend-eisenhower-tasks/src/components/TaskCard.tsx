import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useDrag } from 'react-dnd';
import { 
  Calendar, 
  CheckCircle, 
  Circle, 
  GripVertical, 
  Trash2,
  MoreVertical,
  Archive
} from 'lucide-react';
import { type Event } from '../lib/api';
import { 
  type EisenhowerContent,
  type EisenhowerTaskData,
  calculatePriorityScore,
  QUADRANTS
} from '../lib/eisenhower';
import clsx from 'clsx';

interface TaskCardProps {
  event: Event;
  eisenhowerData: EisenhowerContent;
  onUpdate: (taskId: number, updates: Partial<EisenhowerTaskData>) => void;
  onDelete: (taskId: number) => void;
}

export function TaskCard({ 
  event, 
  eisenhowerData, 
  onUpdate, 
  onDelete 
}: TaskCardProps) {
  const [showMenu, setShowMenu] = useState(false);
  const [isCompleting, setIsCompleting] = useState(false);

  const quadrant = QUADRANTS.find(q => q.id === eisenhowerData.data.quadrant)!;
  const { data } = eisenhowerData;
  const isCompleted = data.status === 'completed';

  // Format due date
  const formatDueDate = (endDate?: string) => {
    if (!endDate) return null;
    const due = new Date(endDate);
    const now = new Date();
    const isOverdue = due < now;
    
    return {
      text: due.toLocaleDateString('en-US', { 
        month: 'short', 
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      }),
      isOverdue
    };
  };

  const dueInfo = formatDueDate(event.end_date);

  const [{ isDragging }, drag] = useDrag({
    type: 'task',
    item: { event, eisenhowerData },
    collect: (monitor) => ({
      isDragging: !!monitor.isDragging(),
    }),
  });

  const handleComplete = async () => {
    if (isCompleted) return;
    setIsCompleting(true);
    try {
      onUpdate(event.id, { status: 'completed', completed_at: new Date().toISOString() });
    } finally {
      setIsCompleting(false);
    }
  };

  // Close menu when clicking outside
  useEffect(() => {
    if (!showMenu) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (!(e.target as Element).closest('.relative')) {
        setShowMenu(false);
      }
    };

    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, [showMenu]);

  return (
    <motion.div
      ref={(node) => {
        drag(node);
      }}
      layout
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
      whileHover={{ scale: 1.02 }}
      whileDrag={{ scale: 1.05, rotate: 5 }}
      className={clsx(
        'bg-white rounded-lg shadow-sm border-2 p-4 cursor-move transition-all',
        'hover:shadow-md hover:border-opacity-50',
        isDragging && 'opacity-50 shadow-lg',
        quadrant.borderColor,
        isCompleted && 'opacity-60'
      )}
    >
      {/* Task Header */}
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-start gap-2 flex-1">
          <GripVertical className="w-4 h-4 mt-0.5 text-gray-400" />
          <div className="flex-1 min-w-0">
            <h3 className={clsx(
              'font-medium text-gray-900 truncate',
              isCompleted && 'line-through text-gray-500'
            )}>
              {event.name}
            </h3>
            {event.description && (
              <p className="text-sm text-gray-600 mt-1 line-clamp-2">
                {event.description}
              </p>
            )}
          </div>
        </div>
        
        {/* Status and Menu */}
        <div className="flex items-center gap-1 ml-2">
          {/* Status indicator */}
          <button
            onClick={handleComplete}
            disabled={isCompleting}
            className={clsx(
              'p-1 rounded transition-colors',
              isCompleted ? 'text-green-600' : 'text-gray-400 hover:text-green-600',
              isCompleting && 'opacity-50'
            )}
          >
            {isCompleted ? (
              <CheckCircle className="w-5 h-5" />
            ) : (
              <Circle className="w-5 h-5" />
            )}
          </button>

          {/* Menu */}
          <div className="relative">
            <button
              onClick={() => setShowMenu(!showMenu)}
              className="p-1 rounded hover:bg-gray-100 transition-colors"
            >
              <MoreVertical className="w-4 h-4 text-gray-400" />
            </button>
            
            {showMenu && (
              <div className="absolute right-0 top-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-10 min-w-[150px]">
                <button
                  onClick={() => {
                    onUpdate(event.id, { status: 'archived' });
                    setShowMenu(false);
                  }}
                  className="w-full px-3 py-2 text-left text-sm hover:bg-gray-50 flex items-center gap-2"
                >
                  <Archive className="w-4 h-4" />
                  Archive
                </button>
                
                <hr className="my-1" />
                
                <button
                  onClick={() => {
                    onDelete(event.id);
                    setShowMenu(false);
                  }}
                  className="w-full px-3 py-2 text-left text-sm hover:bg-red-50 text-red-600 flex items-center gap-2"
                >
                  <Trash2 className="w-4 h-4" />
                  Delete
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Task Footer */}
      <div className="flex items-center justify-between mt-3 text-sm">
        {/* Priority Score */}
        <div className="flex items-center gap-2">
          <span className={clsx(
            'px-2 py-1 rounded text-xs font-medium',
            quadrant.bgColor,
            quadrant.textColor
          )}>
            Priority: {data.priority_score || calculatePriorityScore(data.quadrant)}
          </span>
          
          {data.estimated_duration && (
            <span className="text-gray-500">
              {data.estimated_duration}m
            </span>
          )}
        </div>

        {/* Due Date */}
        {dueInfo && (
          <div className={clsx(
            'flex items-center gap-1',
            dueInfo.isOverdue ? 'text-red-600 font-medium' : 'text-gray-500'
          )}>
            <Calendar className="w-4 h-4" />
            <span className="text-xs">{dueInfo.text}</span>
            {dueInfo.isOverdue && (
              <span className="text-xs font-medium">OVERDUE</span>
            )}
          </div>
        )}
      </div>
    </motion.div>
  );
}