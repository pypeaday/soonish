import { cn } from '../lib/utils'

interface TagBadgeProps {
  tag: string
  variant?: 'default' | 'autosub'
  onRemove?: () => void
}

// Common theater tags with friendly display names
const TAG_LABELS: Record<string, string> = {
  'all': 'All Events',
  'rehearsal': 'Rehearsals',
  'performance': 'Performances',
  'setup': 'Setup Crew',
  'strike': 'Strike',
  'costumes': 'Costumes',
  'props': 'Props',
  'lighting': 'Lighting',
  'sound': 'Sound',
  'backstage': 'Backstage',
  'front-of-house': 'Front of House',
  'concessions': 'Concessions',
}

export const TagBadge = ({ tag, variant = 'default', onRemove }: TagBadgeProps) => {
  // Strip autosub: prefix for display
  const displayTag = tag.replace(/^autosub:/, '')
  const label = TAG_LABELS[displayTag] || displayTag

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium',
        variant === 'autosub'
          ? 'bg-amber-100 text-amber-800'
          : 'bg-slate-100 text-slate-700'
      )}
    >
      {variant === 'autosub' && <span className="text-amber-500">⚡</span>}
      {label}
      {onRemove && (
        <button
          type="button"
          onClick={onRemove}
          className="ml-1 hover:text-red-600"
        >
          ×
        </button>
      )}
    </span>
  )
}

// Suggested tags for the theater context
export const SUGGESTED_TAGS = [
  { value: 'all', label: 'All Events', description: 'Get notified about everything' },
  { value: 'rehearsal', label: 'Rehearsals', description: 'Practice sessions' },
  { value: 'performance', label: 'Performances', description: 'Show nights' },
  { value: 'setup', label: 'Setup Crew', description: 'Building sets, hanging lights' },
  { value: 'strike', label: 'Strike', description: 'Post-show teardown' },
  { value: 'costumes', label: 'Costumes', description: 'Costume fittings and prep' },
  { value: 'props', label: 'Props', description: 'Props management' },
  { value: 'lighting', label: 'Lighting', description: 'Lighting crew calls' },
  { value: 'sound', label: 'Sound', description: 'Sound crew calls' },
  { value: 'backstage', label: 'Backstage', description: 'Backstage crew' },
  { value: 'front-of-house', label: 'Front of House', description: 'Ushers, ticket sales' },
  { value: 'concessions', label: 'Concessions', description: 'Snack bar volunteers' },
]
