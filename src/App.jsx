import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './contexts/AuthContext'
import Login from './pages/Login'
import AdminDashboard from './pages/admin/Dashboard'
import AdminNovoPedido from './pages/admin/NovoPedido'
import AdminMotoboys from './pages/admin/Motoboys'
import AdminRelatorios from './pages/admin/Relatorios'
import MotoboyHome from './pages/motoboy/Home'
import MotoboyEntrega from './pages/motoboy/Entrega'
import Rastreio from './pages/tracking/Rastreio'
import { GeolocationProvider } from './contexts/GeolocationContext'

// Componente para rotas protegidas
const ProtectedRoute = ({ children, role }) => {
  const { user, profile, loading } = useAuth()

  if (loading) return <div className="loading">Carregando...</div>
  if (!user) return <Navigate to="/login" />
  if (role && profile?.role !== role) return <Navigate to="/" />

  return children
}

function App() {
  const { profile } = useAuth()

  return (
    <GeolocationProvider>
      <Router>
        <Routes>
          {/* ... existing routes ... */}
          <Route path="/login" element={<Login />} />
          
          {/* Rota de Redirecionamento Inicial */}
          <Route path="/" element={
            loading ? null : 
            profile?.role === 'admin' ? <Navigate to="/admin" /> : 
            profile?.role === 'motoboy' ? <Navigate to="/motoboy" /> : 
            <Navigate to="/login" />
          } />

          {/* Rotas Admin */}
          <Route path="/admin" element={
            <ProtectedRoute role="admin">
              <AdminDashboard />
            </ProtectedRoute>
          } />
          <Route path="/admin/novo-pedido" element={
            <ProtectedRoute role="admin">
              <AdminNovoPedido />
            </ProtectedRoute>
          } />
          <Route path="/admin/motoboys" element={
            <ProtectedRoute role="admin">
              <AdminMotoboys />
            </ProtectedRoute>
          } />
          <Route path="/admin/relatorios" element={
            <ProtectedRoute role="admin">
              <AdminRelatorios />
            </ProtectedRoute>
          } />

          {/* Rotas Motoboy */}
          <Route path="/motoboy" element={
            <ProtectedRoute role="motoboy">
              <MotoboyHome />
            </ProtectedRoute>
          } />
          <Route path="/motoboy/entrega/:id" element={
            <ProtectedRoute role="motoboy">
              <MotoboyEntrega />
            </ProtectedRoute>
          } />

          {/* Rota Pública de Rastreio */}
          <Route path="/rastreio/:id" element={<Rastreio />} />
        </Routes>
      </Router>
    </GeolocationProvider>
  )
}

export default App
