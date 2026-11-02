import { Route, Routes } from 'react-router-dom'
import { AppLayout } from '@/presentation/app/layout/AppLayout'
import { HomePage } from '@/presentation/features/home/HomePage'

export function App() {
  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route index element={<HomePage />} />
      </Route>
    </Routes>
  )
}
