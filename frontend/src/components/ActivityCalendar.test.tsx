import { fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'

import { ActivityCalendar } from './ActivityCalendar'

describe('ActivityCalendar', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 8, 2, 12, 0, 0))
  })

  afterEach(() => vi.useRealTimers())

  test('renders twelve Monday-first weeks, future days, month labels, and fixed density', () => {
    const localOne = new Date(2026, 8, 1, 0, 30).toISOString()
    const localTwo = new Date(2026, 8, 1, 23, 30).toISOString()
    const completions = [
      { completedAt: new Date(2026, 7, 29, 12).toISOString() },
      ...Array.from({ length: 2 }, () => ({ completedAt: new Date(2026, 7, 30, 12).toISOString() })),
      ...Array.from({ length: 3 }, () => ({ completedAt: new Date(2026, 7, 31, 12).toISOString() })),
      { completedAt: localOne },
      { completedAt: localTwo },
      { completedAt: localTwo },
      { completedAt: localTwo },
    ]
    render(
      <ActivityCalendar completions={completions} />,
    )

    const calendar = screen.getByRole('grid', { name: /completion activity/i })
    expect(calendar.querySelectorAll('.activity-week')).toHaveLength(12)
    expect(calendar.querySelectorAll('.activity-week')).toSatisfy((weeks: NodeListOf<Element>) =>
      [...weeks].every((week) => week.querySelectorAll('.activity-day').length === 7),
    )
    expect(screen.getByText('Mon')).toBeInTheDocument()
    expect(screen.getByText('Sun')).toBeInTheDocument()
    expect(screen.getByText('Sep')).toBeInTheDocument()
    expect(screen.getByText('Less')).toBeInTheDocument()
    expect(screen.getByText('More')).toBeInTheDocument()
    expect(calendar.querySelector('[data-date="2026-08-29"]')).toHaveClass('activity-day--level-1')
    expect(calendar.querySelector('[data-date="2026-08-30"]')).toHaveClass('activity-day--level-2')
    expect(calendar.querySelector('[data-date="2026-08-31"]')).toHaveClass('activity-day--level-3')
    expect(calendar.querySelector('[data-date="2026-09-01"]')).toHaveClass('activity-day--level-4')
    expect(calendar.querySelector('[data-date="2026-09-02"]')).toHaveClass('activity-day--today')
    expect(calendar.querySelector('[data-date="2026-09-03"]')).toHaveClass(
      'activity-day--unavailable',
    )
    const currentWeek = calendar.querySelectorAll('.activity-week')[11]
    expect(currentWeek.querySelectorAll('.activity-day:not(.activity-day--unavailable)')).toHaveLength(3)
  })

  test('groups UTC timestamps onto the visual dates on either side of local midnight', () => {
    render(
      <ActivityCalendar
        completions={[
          { completedAt: new Date(2026, 7, 30, 23, 55).toISOString() },
          { completedAt: new Date(2026, 7, 31, 0, 5).toISOString() },
        ]}
      />,
    )
    const calendar = screen.getByRole('grid', { name: /completion activity/i })

    expect(calendar.querySelector('[data-date="2026-08-30"]')).toHaveClass('activity-day--level-1')
    expect(calendar.querySelector('[data-date="2026-08-31"]')).toHaveClass('activity-day--level-1')
  })

  test('supports pointer, touch, and grid-shaped keyboard inspection from one tab stop', async () => {
    render(<ActivityCalendar completions={[]} />)
    const calendar = screen.getByRole('grid', { name: /completion activity/i })
    const monday = calendar.querySelector('[data-date="2026-08-31"]') as HTMLElement

    fireEvent.mouseEnter(monday)
    expect(screen.getByRole('tooltip')).toHaveTextContent('Monday, August 31, 2026 · 0 completions')
    fireEvent.click(calendar.querySelector('[data-date="2026-09-01"]') as HTMLElement)
    expect(screen.getByRole('tooltip')).toHaveTextContent('Tuesday, September 1, 2026')

    calendar.focus()
    expect(calendar).toHaveFocus()
    expect(calendar.querySelectorAll('[tabindex]')).toHaveLength(0)
    fireEvent.keyDown(calendar, { key: 'ArrowUp' })
    expect(within(calendar).getByText('Monday, August 31, 2026 · 0 completions')).toHaveClass(
      'sr-only',
    )
    fireEvent.keyDown(calendar, { key: 'ArrowLeft' })
    expect(within(calendar).getByText('Monday, August 24, 2026 · 0 completions')).toHaveClass(
      'sr-only',
    )
    fireEvent.keyDown(calendar, { key: 'ArrowUp' })
    expect(within(calendar).getByText('Monday, August 24, 2026 · 0 completions')).toHaveClass(
      'sr-only',
    )
    fireEvent.keyDown(calendar, { key: 'ArrowDown' })
    expect(within(calendar).getByText('Tuesday, August 25, 2026 · 0 completions')).toHaveClass(
      'sr-only',
    )
    fireEvent.keyDown(calendar, { key: 'ArrowRight' })
    expect(within(calendar).getByText('Tuesday, September 1, 2026 · 0 completions')).toHaveClass(
      'sr-only',
    )

    fireEvent.click(calendar.querySelector('[data-date="2026-06-15"]') as HTMLElement)
    fireEvent.keyDown(calendar, { key: 'ArrowLeft' })
    fireEvent.keyDown(calendar, { key: 'ArrowUp' })
    expect(within(calendar).getByText('Monday, June 15, 2026 · 0 completions')).toHaveClass(
      'sr-only',
    )

    fireEvent.click(calendar.querySelector('[data-date="2026-09-02"]') as HTMLElement)
    fireEvent.keyDown(calendar, { key: 'ArrowRight' })
    fireEvent.keyDown(calendar, { key: 'ArrowDown' })
    expect(within(calendar).getByText('Wednesday, September 2, 2026 · 0 completions')).toHaveClass(
      'sr-only',
    )
  })
})
