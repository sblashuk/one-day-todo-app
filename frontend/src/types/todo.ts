export type Priority = 'low' | 'medium' | 'high'

export type Todo = {
  id: number
  title: string
  completed: boolean
  dueAt: string | null
  priority: Priority | null
  createdAt: string
  updatedAt: string
}

export type CreateTodoInput = {
  title: string
  dueAt?: string | null
  priority?: Priority | null
}

export type UpdateTodoInput = Partial<CreateTodoInput & Pick<Todo, 'completed'>>
