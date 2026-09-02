export type ActivityWindow = {
  dates: Date[]
  from: string
  to: string
  today: Date
}

const WEEK_COUNT = 12
export const DAYS_PER_WEEK = 7

export function localDateKey(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function createActivityWindow(now = new Date()): ActivityWindow {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const firstDay = new Date(today)
  firstDay.setDate(today.getDate() - ((today.getDay() + 6) % 7) - (WEEK_COUNT - 1) * 7)
  const end = new Date(firstDay)
  end.setDate(firstDay.getDate() + WEEK_COUNT * DAYS_PER_WEEK)
  const dates = Array.from({ length: WEEK_COUNT * DAYS_PER_WEEK }, (_, index) => {
    const date = new Date(firstDay)
    date.setDate(firstDay.getDate() + index)
    return date
  })
  return { dates, from: firstDay.toISOString(), to: end.toISOString(), today }
}
