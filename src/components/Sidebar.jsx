import React from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

const Sidebar = () => {
  const location = useLocation()
  const { signOut, profile } = useAuth()

  const navItems = [
    { path: '/admin', label: 'Dashboard', icon: '📊' },
    { path: '/admin/novo-pedido', label: 'Novo Pedido', icon: '➕' },
    { path: '/admin/motoboys', label: 'Motoboys', icon: '🏍️' },
    { path: '/admin/relatorios', label: 'Relatórios', icon: '📈' },
  ]

  return (
    <aside className="sidebar">
      <div className="logo">
        <div className="logo-icon">🏍️</div>
        <div className="logo-text">Universal<span>Delivery</span></div>
      </div>

      <nav className="nav-list">
        {navItems.map((item) => (
          <li key={item.path} className={`nav-item ${location.pathname === item.path ? 'active' : ''}`}>
            <Link to={item.path}>
              <span className="nav-icon">{item.icon}</span>
              {item.label}
            </Link>
          </li>
        ))}
        
        <div className="nav-spacer"></div>

        <li className="nav-item">
          <button onClick={signOut}>
            <span className="nav-icon">🚪</span>
            Sair
          </button>
        </li>
      </nav>

      <div style={{ marginTop: 'auto', padding: '10px 0', borderTop: '1px solid var(--border)' }}>
        <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Logado como:</div>
        <div style={{ fontWeight: 'bold', fontSize: '14px' }}>{profile?.nome}</div>
      </div>
    </aside>
  )
}

export default Sidebar
