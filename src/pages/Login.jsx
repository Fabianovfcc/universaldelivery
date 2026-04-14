import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

const Login = () => {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isMotoboy, setIsMotoboy] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  
  const { signIn } = useAuth()
  const navigate = useNavigate()

    const { data, error: signInError } = await signIn(email, password)
    
    if (signInError) {
      setError(signInError.message || 'Email ou senha incorretos.')
      setLoading(false)
      return
    }

    // Se o login funcionou, vamos dar um pequeno tempo para o AuthContext carregar o perfil
    // Se o perfil não carregar, avisamos o usuário
    setTimeout(() => {
      navigate('/admin')
    }, 500)
  }


  const handleMotoboyLogin = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    const { error: signInError } = await signIn(email, password)

    if (signInError) {
      setError('Credenciais incorretas.')
      setLoading(false)
    } else {
      navigate('/motoboy')
    }
  }

  return (
    <div className="login-page">
      <div className="login-card animate-slide">
        <div className="login-logo">
          <div className="logo-icon">🏍️</div>
          <h1>Universal<span>Delivery</span></h1>
          <p>Sua central de logística premium</p>
        </div>

        <div className="login-tabs">
          <button 
            className={`login-tab ${!isMotoboy ? 'active' : ''}`}
            onClick={() => { setIsMotoboy(false); setError(''); }}
          >
            Administrador
          </button>
          <button 
            className={`login-tab ${isMotoboy ? 'active' : ''}`}
            onClick={() => { setIsMotoboy(true); setError(''); }}
          >
            Motoboy
          </button>
        </div>

        {error && <div className="login-error">{error}</div>}

        {!isMotoboy ? (
          <form onSubmit={handleAdminLogin}>
            <div className="form-group">
              <label className="form-label">Email</label>
              <input 
                id="admin-email"
                name="email"
                type="email" 
                className="form-input" 
                placeholder="seu@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div className="form-group">
              <label className="form-label">Senha</label>
              <input 
                type="password" 
                className="form-input" 
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            <button type="submit" className="btn btn-primary btn-full btn-lg" disabled={loading}>
              {loading ? 'Entrando...' : 'Entrar no Painel'}
            </button>
          </form>
        ) : (
          <form onSubmit={handleMotoboyLogin}>
            <div className="form-group">
              <label className="form-label">Email do Motoboy</label>
              <input 
                type="email" 
                className="form-input" 
                placeholder="motoboy@exemplo.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div className="form-group">
              <label className="form-label">Senha</label>
              <input 
                type="password" 
                className="form-input" 
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            <button 
              type="submit" 
              className="btn btn-primary btn-full btn-lg"
              disabled={loading}
            >
              {loading ? 'Validando...' : 'Acessar App'}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}

export default Login
