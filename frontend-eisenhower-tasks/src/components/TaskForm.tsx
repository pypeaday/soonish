import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Calendar, Clock } from 'lucide-react';
import { type TaskCreateRequest } from '../lib/eisenhower';
import { QUADRANTS, suggestQuadrant, calculatePriorityScore } from '../lib/eisenhower';
import clsx from 'clsx';

interface TaskFormProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (taskData: TaskCreateRequest) => void;
  defaultQuadrant?: 1 | 2 | 3 | 4;
  initialData?: Partial<TaskCreateRequest>;
}

export function TaskForm({ 
  isOpen, 
  onClose, 
  onSubmit, 
  defaultQuadrant = 2,
  initialData 
}: TaskFormProps) {
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    end_date: '',
    estimated_duration: '',
    quadrant: defaultQuadrant,
  });

  const [urgency, setUrgency] = useState<'urgent' | 'not-urgent'>('not-urgent');
  const [importance, setImportance] = useState<'important' | 'not-important'>('important');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Update form when initialData changes
  useEffect(() => {
    if (initialData) {
      setFormData(prev => ({
        ...prev,
        name: initialData.name || '',
        description: initialData.description || '',
        end_date: initialData.end_date || '',
        estimated_duration: initialData.eisenhower?.estimated_duration?.toString() || '',
        quadrant: initialData.eisenhower?.quadrant || defaultQuadrant,
      }));
      
      if (initialData.eisenhower) {
        setUrgency(initialData.eisenhower.urgency);
        setImportance(initialData.eisenhower.importance);
      }
    }
  }, [initialData, defaultQuadrant]);

  // Auto-suggest quadrant based on title/description
  useEffect(() => {
    if (!initialData && formData.name) {
      const suggestedQuadrant = suggestQuadrant(formData.name, formData.description);
      setFormData(prev => ({ ...prev, quadrant: suggestedQuadrant }));
      
      // Update urgency/importance based on quadrant
      if (suggestedQuadrant === 1) {
        setUrgency('urgent');
        setImportance('important');
      } else if (suggestedQuadrant === 2) {
        setUrgency('not-urgent');
        setImportance('important');
      } else if (suggestedQuadrant === 3) {
        setUrgency('urgent');
        setImportance('not-important');
      } else {
        setUrgency('not-urgent');
        setImportance('not-important');
      }
    }
  }, [formData.name, formData.description, initialData]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) return;

    setIsSubmitting(true);
    
    try {
      const taskData: TaskCreateRequest = {
        name: formData.name.trim(),
        description: formData.description.trim() || undefined,
        end_date: formData.end_date || undefined,
        eisenhower: {
          quadrant: formData.quadrant as 1 | 2 | 3 | 4,
          urgency,
          importance,
          status: 'pending',
          estimated_duration: formData.estimated_duration ? parseInt(formData.estimated_duration) : undefined,
          priority_score: calculatePriorityScore(formData.quadrant as 1 | 2 | 3 | 4),
          metadata: { source: 'manual' as const },
        },
      };

      onSubmit(taskData);
      
      // Reset form
      setFormData({
        name: '',
        description: '',
        end_date: '',
        estimated_duration: '',
        quadrant: defaultQuadrant,
      });
      setUrgency('not-urgent');
      setImportance('important');
      
      onClose();
    } finally {
      setIsSubmitting(false);
    }
  };

  useEffect(() => {
    const getQuadrantFromUrgencyImportance = () => {
      if (urgency === 'urgent' && importance === 'important') return 1;
      if (urgency === 'not-urgent' && importance === 'important') return 2;
      if (urgency === 'urgent' && importance === 'not-important') return 3;
      return 4;
    };

    const quadrant = getQuadrantFromUrgencyImportance();
    setFormData(prev => ({ ...prev, quadrant }));
  }, [urgency, importance]);

  const selectedQuadrant = QUADRANTS.find(q => q.id === formData.quadrant)!;

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className="bg-white rounded-xl shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b">
            <div>
              <h2 className="text-xl font-semibold text-gray-900">
                {initialData ? 'Edit Task' : 'Create Task'}
              </h2>
              <p className="text-sm text-gray-600 mt-1">
                Add to your Eisenhower matrix
              </p>
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="p-6 space-y-6">
            {/* Basic Info */}
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Task Name *
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="e.g., Finish quarterly report"
                  required
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Description
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  rows={3}
                  placeholder="Optional details about this task..."
                />
              </div>
            </div>

            {/* Eisenhower Classification */}
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-3">
                  Eisenhower Classification
                </label>
                
                <div className="grid grid-cols-2 gap-4">
                  {/* Urgency */}
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-2">
                      Urgency
                    </label>
                    <div className="space-y-2">
                      <label className="flex items-center">
                        <input
                          type="radio"
                          value="urgent"
                          checked={urgency === 'urgent'}
                          onChange={(e) => setUrgency(e.target.value as 'urgent')}
                          className="mr-2"
                        />
                        <span className="text-sm">Urgent</span>
                      </label>
                      <label className="flex items-center">
                        <input
                          type="radio"
                          value="not-urgent"
                          checked={urgency === 'not-urgent'}
                          onChange={(e) => setUrgency(e.target.value as 'not-urgent')}
                          className="mr-2"
                        />
                        <span className="text-sm">Not Urgent</span>
                      </label>
                    </div>
                  </div>

                  {/* Importance */}
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-2">
                      Importance
                    </label>
                    <div className="space-y-2">
                      <label className="flex items-center">
                        <input
                          type="radio"
                          value="important"
                          checked={importance === 'important'}
                          onChange={(e) => setImportance(e.target.value as 'important')}
                          className="mr-2"
                        />
                        <span className="text-sm">Important</span>
                      </label>
                      <label className="flex items-center">
                        <input
                          type="radio"
                          value="not-important"
                          checked={importance === 'not-important'}
                          onChange={(e) => setImportance(e.target.value as 'not-important')}
                          className="mr-2"
                        />
                        <span className="text-sm">Not Important</span>
                      </label>
                    </div>
                  </div>
                </div>

                {/* Quadrant Preview */}
                <div className={clsx(
                  'mt-3 p-3 rounded-lg border-2 text-center',
                  selectedQuadrant.bgColor,
                  selectedQuadrant.borderColor
                )}>
                  <div className={clsx('font-semibold', selectedQuadrant.textColor)}>
                    {selectedQuadrant.name}
                  </div>
                  <div className={clsx('text-sm opacity-75', selectedQuadrant.textColor)}>
                    {selectedQuadrant.description}
                  </div>
                </div>
              </div>
            </div>

            {/* Additional Options */}
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  <Calendar className="w-4 h-4 inline mr-1" />
                  Due Date
                </label>
                <input
                  type="datetime-local"
                  value={formData.end_date}
                  onChange={(e) => setFormData(prev => ({ ...prev, end_date: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  <Clock className="w-4 h-4 inline mr-1" />
                  Estimated Duration (minutes)
                </label>
                <input
                  type="number"
                  value={formData.estimated_duration}
                  onChange={(e) => setFormData(prev => ({ ...prev, estimated_duration: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="30"
                  min="1"
                />
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-3 pt-4">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={!formData.name.trim() || isSubmitting}
                className={clsx(
                  'flex-1 px-4 py-2 rounded-lg transition-colors',
                  'bg-blue-600 text-white hover:bg-blue-700 focus:ring-2 focus:ring-blue-500',
                  'disabled:opacity-50 disabled:cursor-not-allowed'
                )}
              >
                {isSubmitting ? 'Creating...' : (initialData ? 'Update Task' : 'Create Task')}
              </button>
            </div>
          </form>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}