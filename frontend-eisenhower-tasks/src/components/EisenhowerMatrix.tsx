import { motion } from 'framer-motion';
import { DndProvider } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import clsx from 'clsx';
import { type Event } from '../lib/api';
import { 
  parseEisenhowerContent,
  QUADRANTS,
  type TaskCreateRequest,
  type EisenhowerTaskData,
  type EisenhowerContent
} from '../lib/eisenhower';
import { Quadrant } from './Quadrant';

interface EisenhowerMatrixProps {
  tasks: Event[];
  onTaskUpdate: (taskId: number, updates: Partial<EisenhowerTaskData>) => void;
  onTaskCreate: (taskData: TaskCreateRequest) => void;
  onTaskDelete: (taskId: number) => void;
}

export function EisenhowerMatrix({ 
  tasks, 
  onTaskUpdate, 
  onTaskCreate, 
  onTaskDelete 
}: EisenhowerMatrixProps) {
  // Group tasks by quadrant, excluding archived
  const tasksByQuadrant = tasks.reduce((acc, task) => {
    const eisenhowerData = parseEisenhowerContent(task.content);
    if (!eisenhowerData || eisenhowerData.data.status === 'archived') return acc;
    
    const quadrant = eisenhowerData.data.quadrant;
    if (!acc[quadrant]) acc[quadrant] = [];
    acc[quadrant].push({ task, eisenhowerData });
    return acc;
  }, {} as Record<number, { task: Event; eisenhowerData: EisenhowerContent }[]>);

  return (
    <DndProvider backend={HTML5Backend}>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 p-4 max-w-7xl mx-auto">
        {QUADRANTS.map((quadrant, index) => (
          <motion.div
            key={quadrant.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
            className={clsx(
              'rounded-xl border-2 min-h-[400px] flex flex-col',
              quadrant.bgColor,
              quadrant.borderColor
            )}
          >
            <Quadrant
              quadrant={quadrant}
              tasks={tasksByQuadrant[quadrant.id] || []}
              onTaskUpdate={onTaskUpdate}
              onTaskCreate={onTaskCreate}
              onTaskDelete={onTaskDelete}
            />
          </motion.div>
        ))}
      </div>
    </DndProvider>
  );
}