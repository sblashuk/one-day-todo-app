type BrandHomeLinkProps = {
  onNavigate: (path: string) => void
}

export function BrandHomeLink({ onNavigate }: BrandHomeLinkProps) {
  return (
    <a
      className="brand-lockup brand-home"
      href="/"
      onClick={(event) => {
        if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
        event.preventDefault()
        if (window.location.pathname !== '/') onNavigate('/')
      }}
    >
      <span className="brand-dot" aria-hidden="true" />
      <span>DAYLIST</span>
    </a>
  )
}
