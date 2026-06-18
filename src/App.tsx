import { Route, Routes } from 'react-router'
import AppLayout from './components/AppLayout'
import ProtectedRoute from './components/ProtectedRoute'
import PublicOnlyRoute from './components/PublicOnlyRoute'
import AuthPage from './pages/AuthPage'
import Chats from './pages/Chats'
import General from './pages/General'
import Marketplace from './pages/Marketplace'
import Profile from './pages/Profile'
import UniversityWall from './pages/UniversityWall'

export default function App() {
  return (
    <Routes>
      <Route element={<PublicOnlyRoute />}>
        <Route path="/auth" element={<AuthPage />} />
      </Route>

      <Route element={<ProtectedRoute />}>
        <Route element={<AppLayout />}>
          <Route path="/" element={<General />} />
          <Route path="/muro-u" element={<UniversityWall />} />
          <Route path="/market" element={<Marketplace />} />
          <Route path="/chats" element={<Chats />} />
          <Route path="/perfil" element={<Profile />} />
        </Route>
      </Route>
    </Routes>
  )
}