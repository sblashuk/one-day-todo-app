import { useTodos } from '../hooks/useTodos'
import type { User } from '../types/auth'
import { AccountMenu } from './AccountMenu'
import { AddTodoForm } from './AddTodoForm'
import { BrandHomeLink } from './BrandHomeLink'
import { TodoList } from './TodoList'

type TodoScreenProps = {
  user: User
  onNavigate: (path: string) => void
  onSignedOut: () => Promise<void>
}

export function TodoScreen({ user, onNavigate, onSignedOut }: TodoScreenProps) {
  const {
    todos,
    initialLoading,
    error: todoError,
    pending,
    validation,
    loadTodos,
    addTodo,
    toggleTodo,
    updateTodo,
    removeTodo,
  } = useTodos()
  function retry() {
    void loadTodos()
  }

  const activeCount = todos.filter((todo) => !todo.completed).length
  const completedCount = todos.length - activeCount
  const error = todoError

  return (
    <main className="app-shell todo-shell">
      <header className="topbar">
        <BrandHomeLink onNavigate={onNavigate} />
        <AccountMenu user={user} onNavigate={onNavigate} onSignedOut={onSignedOut} />
      </header>

      <section className="todo-page">
        <div className="todo-heading">
          <div>
            <p className="eyebrow">ONE CLEAR LIST</p>
            <h1 className="mt-2 font-display text-5xl font-semibold tracking-tight text-ink sm:text-6xl">
              Today
            </h1>
          </div>
          <div className="count-pill" aria-live="polite">
            <span>{activeCount} active</span>
            <span aria-hidden="true">·</span>
            <span>{completedCount} completed</span>
          </div>
        </div>

        <AddTodoForm
          pending={pending === 'add'}
          fieldErrors={validation?.key === 'add' ? validation.fields : undefined}
          onAdd={(input) => {
            return addTodo(input)
          }}
        />

        {error && (
          <div className="error-banner mt-5 flex items-center justify-between gap-4" role="alert">
            <span>{error}</span>
            <button className="font-bold underline" type="button" onClick={retry}>
              Retry
            </button>
          </div>
        )}

        <TodoList
          todos={todos}
          initialLoading={initialLoading}
          pending={pending}
          validation={validation}
          onToggle={(todo) => {
            return toggleTodo(todo)
          }}
          onUpdate={updateTodo}
          onRemove={(id) => {
            void removeTodo(id)
          }}
        />
      </section>
    </main>
  )
}
