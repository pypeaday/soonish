import React from 'react';
import {
  AlertTriangle, Code, Calendar, Users, Brain,
  BarChart3, Film, ListChecks, Sparkles,
} from 'lucide-react';

export interface AppCard {
  id: string;
  name: string;
  description: string;
  icon: React.ReactNode;
  path: string;
  color: string;
  category: string;
  guidePath?: string;
}

export const APPS: AppCard[] = [
  {
    id: 'duty-pager',
    name: 'Duty Pager',
    description: 'PagerDuty-style incident management. Incidents, runbooks, on-call rotations, escalation.',
    icon: <AlertTriangle className="w-6 h-6" />,
    path: '/duty-pager',
    color: '#ef4444',
    category: 'IT & DevOps',
    guidePath: '/guide/apps/it-alerts',
  },
  {
    id: 'mission-control',
    name: 'Mission Control',
    description: 'Platform admin — users, channels, metrics, and health across every app on the instance.',
    icon: <BarChart3 className="w-6 h-6" />,
    path: '/mission-control',
    color: '#00d4ff',
    category: 'IT & DevOps',
  },
  {
    id: 'developer-user',
    name: 'Developer Dashboard',
    description: 'Single-user incident tracking with API tokens. For solo developers and side projects.',
    icon: <Code className="w-6 h-6" />,
    path: '/developer-user',
    color: '#7c3aed',
    category: 'IT & DevOps',
  },
  {
    id: 'event-planner',
    name: 'Event Planner',
    description: 'Facebook Events-style planning. Create public events, manage RSVPs, send updates.',
    icon: <Calendar className="w-6 h-6" />,
    path: '/event-planner',
    color: '#10b981',
    category: 'Events & Community',
    guidePath: '/guide/apps/events',
  },
  {
    id: 'volunteer-coordinator',
    name: 'Volunteer Coordinator',
    description: 'Role-based volunteer scheduling for churches, nonprofits, and community organizations.',
    icon: <Users className="w-6 h-6" />,
    path: '/volunteer-coordinator',
    color: '#f59e0b',
    category: 'Events & Community',
    guidePath: '/guide/apps/volunteer',
  },
  {
    id: 'stage-manager',
    name: 'Stage Manager',
    description: 'Theater production coordination. Parents auto-subscribe to rehearsals and performances.',
    icon: <Film className="w-6 h-6" />,
    path: '/stage-manager',
    color: '#ec4899',
    category: 'Events & Community',
    guidePath: '/guide/apps/theater',
  },
  {
    id: 'adhd-reminders',
    name: 'ADHD Reminders',
    description: 'Quick-add notes with time presets. Capture thoughts before they disappear.',
    icon: <Brain className="w-6 h-6" />,
    path: '/adhd-reminders',
    color: '#a78bfa',
    category: 'Personal & Productivity',
  },
  {
    id: 'tasks',
    name: 'Task Matrix',
    description: 'Eisenhower 2x2 — sort tasks by urgent and important, get reminded at the right moment.',
    icon: <ListChecks className="w-6 h-6" />,
    path: '/tasks',
    color: '#f97316',
    category: 'Personal & Productivity',
  },
  {
    id: 'mindful',
    name: 'Mindful',
    description: 'Visual timers and recurring reminders for daily life — appointments, habits, focus sessions.',
    icon: <Sparkles className="w-6 h-6" />,
    path: '/mindful',
    color: '#14b8a6',
    category: 'Personal & Productivity',
    guidePath: '/guide/apps/mind',
  },
];
