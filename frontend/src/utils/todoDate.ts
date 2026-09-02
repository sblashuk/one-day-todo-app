export type DueStatus = 'upcoming' | 'today' | 'overdue' | 'completed'

const fullFormatter = new Intl.DateTimeFormat(undefined, {
  dateStyle: 'medium',
  timeStyle: 'short',
})
const timeFormatter = new Intl.DateTimeFormat(undefined, { timeStyle: 'short' })

export function localDateTimeToIso(value: string): string | null {
  return value ? new Date(value).toISOString() : null
}

export function isoToLocalDateTime(value: string | null): string {
  if (!value) return ''
  const date = new Date(value)
  const pad = (part: number) => String(part).padStart(2, '0')
  return [
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`,
    `${pad(date.getHours())}:${pad(date.getMinutes())}`,
  ].join('T')
}

export function duePresentation(
  value: string,
  now: Date,
  completed: boolean,
): { label: string; status: DueStatus } {
  const due = new Date(value)
  if (completed) return { label: `Due · ${fullFormatter.format(due)}`, status: 'completed' }
  if (due.getTime() < now.getTime()) {
    return { label: `Overdue · ${fullFormatter.format(due)}`, status: 'overdue' }
  }
  if (
    due.getFullYear() === now.getFullYear() &&
    due.getMonth() === now.getMonth() &&
    due.getDate() === now.getDate()
  ) {
    return { label: `Today · ${timeFormatter.format(due)}`, status: 'today' }
  }
  return { label: `Due · ${fullFormatter.format(due)}`, status: 'upcoming' }
}
