import { Route, Routes } from 'react-router-dom'
import { FoundationPage } from '../../pages/FoundationPage'
import { NotFoundPage } from '../../pages/NotFoundPage'

export function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<FoundationPage />} />
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  )
}
