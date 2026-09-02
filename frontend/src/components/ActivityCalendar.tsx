import { useMemo, useState } from 'react'
import type { KeyboardEvent } from 'react'

import type { Completion } from '../types/activity'
import { createActivityWindow, DAYS_PER_WEEK, localDateKey } from '../utils/activityCalendar'
import type { ActivityWindow } from '../utils/activityCalendar'

type ActivityDay = {
  date: Date
  key: string
  count: number
  available: boolean
  today: boolean
}

function calendarDays(completions: Completion[], activityWindow: ActivityWindow) {

  const counts = new Map<string, number>()
  for (const completion of completions) {
    const key = localDateKey(new Date(completion.completedAt))
    counts.set(key, (counts.get(key) ?? 0) + 1)
  }

  return activityWindow.dates.map((date): ActivityDay => {
    const key = localDateKey(date)
    return {
      date,
      key,
      count: counts.get(key) ?? 0,
      available: date <= activityWindow.today,
      today: key === localDateKey(activityWindow.today),
    }
  })
}

function description(day: ActivityDay) {
  const date = new Intl.DateTimeFormat(undefined, {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(day.date)
  return `${date} · ${day.count} ${day.count === 1 ? 'completion' : 'completions'}`
}

function density(count: number) {
  return Math.min(count, 4)
}

export function ActivityCalendar({
  completions,
  activityWindow = createActivityWindow(),
}: {
  completions: Completion[]
  activityWindow?: ActivityWindow
}) {
  const days = useMemo(
    () => calendarDays(completions, activityWindow),
    [completions, activityWindow],
  )
  const initialIndex = days.reduce((latest, day, index) => (day.available ? index : latest), 0)
  const [activeIndex, setActiveIndex] = useState(initialIndex)
  const activeDay = days[activeIndex]

  function inspect(index: number) {
    if (days[index]?.available) setActiveIndex(index)
  }

  function move(event: KeyboardEvent<HTMLDivElement>) {
    const offsets: Record<string, number> = {
      ArrowLeft: -7,
      ArrowRight: 7,
      ArrowUp: -1,
      ArrowDown: 1,
    }
    const offset = offsets[event.key]
    if (offset === undefined) return
    event.preventDefault()
    const weekday = activeIndex % 7
    if ((event.key === 'ArrowUp' && weekday === 0) || (event.key === 'ArrowDown' && weekday === 6)) {
      return
    }
    inspect(Math.max(0, Math.min(days.length - 1, activeIndex + offset)))
  }

  const weeks = Array.from(
    { length: days.length / DAYS_PER_WEEK },
    (_, week) => days.slice(week * DAYS_PER_WEEK, (week + 1) * DAYS_PER_WEEK),
  )
  const monthLabels = weeks.map((week, index) => {
    const firstOfMonth = week.find((day) => day.date.getDate() === 1)
    if (index === 0 || firstOfMonth) {
      return new Intl.DateTimeFormat(undefined, { month: 'short' }).format(firstOfMonth?.date ?? week[0].date)
    }
    return ''
  })

  return (
    <div className="activity-calendar-wrap">
      <div className="activity-months" aria-hidden="true">
        {monthLabels.map((label, index) => (
          <span key={`${index}-${label}`}>{label}</span>
        ))}
      </div>
      <div className="activity-chart">
        <div className="activity-weekdays" aria-hidden="true">
          {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day) => (
            <span key={day}>{day}</span>
          ))}
        </div>
        <div
          className="activity-grid"
          role="grid"
          tabIndex={0}
          aria-label={`Completion activity. ${description(activeDay)}`}
          aria-activedescendant={`activity-${activeDay.key}`}
          onKeyDown={move}
        >
          {weeks.map((week, weekIndex) => (
            <div className="activity-week" role="presentation" key={week[0].key}>
              {week.map((day, dayIndex) => {
                const index = weekIndex * 7 + dayIndex
                return (
                  <div
                    id={`activity-${day.key}`}
                    key={day.key}
                    role="gridcell"
                    data-date={day.key}
                    aria-label={day.available ? description(day) : `${day.key}, unavailable`}
                    aria-selected={index === activeIndex}
                    className={`activity-day activity-day--level-${density(day.count)}${
                      day.available ? '' : ' activity-day--unavailable'
                    }${day.today ? ' activity-day--today' : ''}`}
                    onMouseEnter={() => inspect(index)}
                    onClick={() => inspect(index)}
                  />
                )
              })}
            </div>
          ))}
          <span className="sr-only" aria-live="polite">
            {description(activeDay)}
          </span>
        </div>
      </div>
      <div className="activity-calendar-footer">
        <div className="activity-tooltip" role="tooltip">
          {description(activeDay)}
        </div>
        <div className="activity-legend" aria-label="Completion density: Less to More">
          <span>Less</span>
          {[0, 1, 2, 3, 4].map((level) => (
            <span
              key={level}
              className={`activity-day activity-day--level-${level}`}
              aria-label={`${level === 4 ? '4 or more' : level} completions`}
            />
          ))}
          <span>More</span>
        </div>
      </div>
    </div>
  )
}
