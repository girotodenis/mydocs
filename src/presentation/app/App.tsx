import { Route, Routes } from 'react-router-dom'
import { AppLayout } from '@/presentation/app/layout/AppLayout'
import { VaultPage } from '@/presentation/features/vault/VaultPage'
import { ViewerPage } from '@/presentation/features/viewer/ViewerPage'
import { EditorPage } from '@/presentation/features/editor/EditorPage'
import { RecebidosPage } from '@/presentation/features/recebidos/RecebidosPage'

export function App() {
  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route index element={<VaultPage />} />
        <Route path="item/:itemId" element={<ViewerPage />} />
        <Route path="editor" element={<EditorPage />} />
        <Route path="editor/:itemId" element={<EditorPage />} />
        <Route path="recebidos" element={<RecebidosPage />} />
      </Route>
    </Routes>
  )
}
