import { useId, useRef, useState, type KeyboardEvent } from 'react'
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useAuth, type AppRole } from '../../features/auth/AuthProvider'
import { Skeleton } from '../../shared/components'
import styles from './AppShell.module.css'

export interface NavigationItem { label: string; to: string; end?: boolean }

interface AppShellProps {
  role: AppRole
  home: string
  items: readonly NavigationItem[]
}

export function AppShell({ role, home, items }: AppShellProps) {
  const { user, profileLoading, logout } = useAuth()
  const navigate = useNavigate()
  const [menuOpen, setMenuOpen] = useState(false)
  const menuId = useId()
  const menuButton = useRef<HTMLButtonElement>(null)
  const main = useRef<HTMLElement>(null)

  function leave() {
    setMenuOpen(false)
    logout()
    navigate('/login', { replace: true })
  }

  function closeOnEscape(event: KeyboardEvent<HTMLElement>) {
    if (event.key === 'Escape') {
      setMenuOpen(false)
      menuButton.current?.focus()
    }
  }

  function links(onNavigate?: () => void) {
    return items.map(({ label, to, end }) => (
      <NavLink
        key={to}
        to={to}
        end={end}
        onClick={onNavigate}
        className={({ isActive }) => [styles.navLink, isActive ? styles.active : ''].filter(Boolean).join(' ')}
      >
        {label}
      </NavLink>
    ))
  }

  return (
    <div className={styles.shell}>
      <a className={styles.skipLink} href="#conteudo-principal">Pular para o conteúdo</a>
      <header className={styles.header}>
        <div className={styles.headerInner}>
          <Link className={styles.brand} to={home} aria-label="Ouvidoria MBFREIRE — início">
            <span className={styles.mark} aria-hidden="true">mb</span>
            <span className={styles.brandText}><strong>MB.FREIRE</strong><small>OUVIDORIA</small></span>
          </Link>

          <nav className={styles.desktopNav} aria-label={`Navegação ${role === 'CLIENT' ? 'do cliente' : 'administrativa'}`}>
            {links()}
          </nav>

          <div className={styles.desktopActions}>
            <div className={styles.profile} aria-label="Perfil autenticado">
              <small>{role === 'CLIENT' ? 'Cliente' : 'Administrador'}</small>
              {profileLoading || !user ? <Skeleton width="8rem" label="Carregando perfil" /> : <span className={styles.profileName} title={user.name}>{user.name}</span>}
            </div>
            <button type="button" className={styles.exitButton} onClick={leave}>Sair</button>
          </div>

          <button
            ref={menuButton}
            type="button"
            className={styles.menuButton}
            aria-expanded={menuOpen}
            aria-controls={menuId}
            onKeyDown={closeOnEscape}
            onClick={() => setMenuOpen((open) => !open)}
          >
            <span className={styles.menuIcon} aria-hidden="true">{menuOpen ? '×' : '☰'}</span>
            <span>Menu</span>
          </button>
        </div>
          <nav id={menuId} className={styles.mobileNav} hidden={!menuOpen} aria-label={`Navegação ${role === 'CLIENT' ? 'do cliente' : 'administrativa'}`} onKeyDown={closeOnEscape}>
            <div className={styles.mobileProfile}>
              <small>{role === 'CLIENT' ? 'Cliente' : 'Administrador'}</small>
              {profileLoading || !user ? <Skeleton width="8rem" label="Carregando perfil" /> : <strong>{user.name}</strong>}
            </div>
            {links(() => { setMenuOpen(false); main.current?.focus() })}
            <button type="button" className={styles.mobileExit} onClick={leave}>Sair</button>
          </nav>
      </header>
      <main ref={main} id="conteudo-principal" tabIndex={-1} className={styles.main}>
        <Outlet />
      </main>
    </div>
  )
}
