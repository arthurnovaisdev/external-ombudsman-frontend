import logoUrl from '../assets/mbfreire-logo.png'

export function BrandLogo({ className }: { className?: string }) {
  return <img src={logoUrl} alt="" aria-hidden="true" className={className} width={1254} height={1254} decoding="async" />
}
