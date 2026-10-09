import { Route, Routes } from 'react-router-dom'
import { FoundationPage } from '../../pages/FoundationPage'
import { NotFoundPage } from '../../pages/NotFoundPage'
import { DesignSystemPage } from '../../pages/DesignSystemPage'

export function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<FoundationPage />} />
      {import.meta.env.DEV && <Route path="/design-system" element={<DesignSystemPage />} />}
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  )
}
