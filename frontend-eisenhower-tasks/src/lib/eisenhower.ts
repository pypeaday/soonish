// Eisenhower Matrix Content Types and Utilities

export interface EisenhowerContent {
  type: 'eisenhower_task';
  version: '1.0';
  data: EisenhowerTaskData;
}

export interface EisenhowerTaskData {
  quadrant: 1 | 2 | 3 | 4;
  urgency: 'urgent' | 'not-urgent';
  importance: 'important' | 'not-important';
  status: 'pending' | 'in_progress' | 'completed' | 'archived';
  estimated_duration?: number; // minutes
  priority_score?: number; // 1-10, auto-calculated
  completed_at?: string; // ISO timestamp
  archived_at?: string; // ISO timestamp
  metadata?: {
    source: 'manual' | 'template' | 'ai_suggestion';
    last_moved_at?: string;
    times_moved?: number;
  };
}

export interface TaskCreateRequest {
  name: string;
  description?: string;
  end_date?: string; // due date
  eisenhower: EisenhowerTaskData;
}

export interface Quadrant {
  id: 1 | 2 | 3 | 4;
  name: string;
  description: string;
  color: string;
  bgColor: string;
  borderColor: string;
  textColor: string;
}

export const QUADRANTS: Quadrant[] = [
  {
    id: 1,
    name: 'Do First',
    description: 'Urgent & Important',
    color: 'q1',
    bgColor: 'bg-q1-50',
    borderColor: 'border-q1-500',
    textColor: 'text-q1-700',
  },
  {
    id: 2,
    name: 'Schedule',
    description: 'Not Urgent & Important',
    color: 'q2',
    bgColor: 'bg-q2-50',
    borderColor: 'border-q2-500',
    textColor: 'text-q2-700',
  },
  {
    id: 3,
    name: 'Delegate',
    description: 'Urgent & Not Important',
    color: 'q3',
    bgColor: 'bg-q3-50',
    borderColor: 'border-q3-500',
    textColor: 'text-q3-700',
  },
  {
    id: 4,
    name: 'Eliminate',
    description: 'Not Urgent & Not Important',
    color: 'q4',
    bgColor: 'bg-q4-50',
    borderColor: 'border-q4-500',
    textColor: 'text-q4-700',
  },
];

// Content parsing and creation utilities
export function parseEisenhowerContent(content?: string): EisenhowerContent | null {
  if (!content) return null;
  try {
    const parsed = JSON.parse(content);
    return parsed.type === 'eisenhower_task' ? parsed : null;
  } catch {
    return null;
  }
}

export function createEisenhowerContent(
  quadrant: 1 | 2 | 3 | 4,
  urgency: 'urgent' | 'not-urgent',
  importance: 'important' | 'not-important',
  source: 'manual' | 'template' | 'ai_suggestion' = 'manual'
): EisenhowerContent {
  return {
    type: 'eisenhower_task',
    version: '1.0',
    data: {
      quadrant,
      urgency,
      importance,
      status: 'pending',
      priority_score: calculatePriorityScore(quadrant),
      metadata: { source, times_moved: 0 },
    },
  };
}

export function calculatePriorityScore(quadrant: 1 | 2 | 3 | 4): number {
  const scores: Record<1 | 2 | 3 | 4, number> = { 1: 10, 2: 7, 3: 4, 4: 1 };
  return scores[quadrant];
}

export function updateQuadrantInContent(
  content: EisenhowerContent,
  newQuadrant: 1 | 2 | 3 | 4
): EisenhowerContent {
  return {
    ...content,
    data: {
      ...content.data,
      quadrant: newQuadrant,
      priority_score: calculatePriorityScore(newQuadrant),
      metadata: {
        ...content.data.metadata,
        source: content.data.metadata?.source ?? 'manual',
        last_moved_at: new Date().toISOString(),
        times_moved: (content.data.metadata?.times_moved || 0) + 1,
      },
    },
  };
}

export function completeTask(content: EisenhowerContent): EisenhowerContent {
  return {
    ...content,
    data: {
      ...content.data,
      status: 'completed',
      completed_at: new Date().toISOString(),
    },
  };
}

export function archiveTask(content: EisenhowerContent): EisenhowerContent {
  return {
    ...content,
    data: {
      ...content.data,
      status: 'archived',
      archived_at: new Date().toISOString(),
    },
  };
}

// Smart quadrant suggestions based on keywords
export function suggestQuadrant(title: string, description?: string): 1 | 2 | 3 | 4 {
  const text = `${title} ${description || ''}`.toLowerCase();
  
  // Urgent keywords
  const urgentKeywords = ['urgent', 'asap', 'immediately', 'emergency', 'critical', 'deadline', 'due', 'today', 'now'];
  
  // Important keywords  
  const importantKeywords = ['important', 'strategic', 'goal', 'plan', 'learn', 'exercise', 'health', 'relationship', 'growth'];
  
  // Not important keywords
  const notImportantKeywords = ['email', 'meeting', 'call', 'review', 'check', 'respond', 'reply', 'social', 'browse'];
  
  const isUrgent = urgentKeywords.some(keyword => text.includes(keyword));
  const isImportant = importantKeywords.some(keyword => text.includes(keyword));
  const isNotImportant = notImportantKeywords.some(keyword => text.includes(keyword));
  
  // Determine quadrant
  if (isUrgent && isImportant) return 1; // Do First
  if (!isUrgent && isImportant) return 2; // Schedule
  if (isUrgent && !isImportant && !isNotImportant) return 3; // Delegate
  if (isUrgent && !isImportant && isNotImportant) return 4; // Eliminate
  if (!isUrgent && !isImportant) return 4; // Eliminate
  
  // Default to Schedule if no clear indicators
  return 2;
}