import type { Completion } from '../types/activity'
import { request } from './client'

export async function listCompletions(from: string, to: string): Promise<Completion[]> {
  const query = new URLSearchParams({ from, to })
  const result = await request<{ completions: Completion[] }>(
    `/api/activity/completions?${query.toString()}`,
  )
  return result.completions
}
