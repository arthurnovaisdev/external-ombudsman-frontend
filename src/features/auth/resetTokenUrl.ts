// Captura o segredo na inicialização, antes de qualquer renderização ou navegação.
// Ele permanece somente na memória do fluxo de redefinição.
export function captureResetTokenFromUrl(browser: Pick<Window, 'location' | 'history'>): string | null {
  if (browser.location.pathname !== '/reset-password') return null
  const token = new URLSearchParams(browser.location.search).get('token')
  browser.history.replaceState(browser.history.state, '', browser.location.pathname)
  return token
}
