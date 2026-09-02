export type User = {
  id: number
  email: string
}

export type Session = {
  user: User | null
  csrfToken: string
}
