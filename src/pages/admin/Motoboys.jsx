import React, { useState, useEffect } from 'react'
import Sidebar from '../../components/Sidebar'
import { supabase } from '../../lib/supabase'

const Motoboys = () => {
  const [motoboys, setMotoboys] = useState([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [formData, setFormData] = useState({
    nome: '',
    telefone: '',
    pin: '',
    email: '',
    id: null // Para edição
  })

  useEffect(() => {
    fetchMotoboys()
  }, [])

  const fetchMotoboys = async () => {
    try {
      const { data, error } = await supabase
        .from('usuarios')
        .select('*')
        .eq('role', 'motoboy')
      
      if (data) setMotoboys(data)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const handleCreate = async (e) => {
    e.preventDefault()
    setLoading(true)

    try {
      if (formData.id) {
        // EDIÇÃO
        const { error } = await supabase
          .from('usuarios')
          .update({
            nome: formData.nome,
            telefone: formData.telefone,
            pin: formData.pin,
            email: formData.email
          })
          .eq('id', formData.id)

        if (error) throw error
        alert('✅ Motoboy atualizado com sucesso!')
      } else {
        // CRIAÇÃO
        const { error } = await supabase
          .from('usuarios')
          .insert([{
            nome: formData.nome,
            telefone: formData.telefone,
            pin: formData.pin,
            email: formData.email,
            role: 'motoboy',
            ativo: true,
            disponivel: false
          }])

        if (error) throw error
        alert('✅ Dados do motoboy salvos! IMPORTANTE: Agora você deve criar o usuário no menu Authentication do Supabase com este mesmo email.')
      }
      
      setShowModal(false)
      fetchMotoboys()
      setFormData({ nome: '', telefone: '', pin: '', email: '', id: null })
    } catch (err) {
      alert(`Erro: ${err.message}`)
    } finally {
      setLoading(false)
    }
  }

  const handleEdit = (m) => {
    setFormData({
      id: m.id,
      nome: m.nome,
      telefone: m.telefone,
      pin: m.pin,
      email: m.email
    })
    setShowModal(true)
  }

  return (
    <div className="app-layout">
      <Sidebar />
      <main className="main-content">
        <header className="page-header">
          <div>
            <h1 className="page-title">Gestão de Motoboys</h1>
            <p className="page-subtitle">Gerencie sua equipe de 5 motos</p>
          </div>
          <button className="btn btn-primary" onClick={() => setShowModal(true)}>
            ➕ Adicionar Motoboy
          </button>
        </header>

        <section className="stats-grid animate-fade">
          <div className="stat-card total">
            <div className="stat-label">Total de Motos</div>
            <div className="stat-number">{motoboys.length}</div>
          </div>
          <div className="stat-card done">
            <div className="stat-label">Disponíveis</div>
            <div className="stat-number">{motoboys.filter(m => m.disponivel).length}</div>
          </div>
          <div className="stat-card pending">
            <div className="stat-label">Indisponíveis</div>
            <div className="stat-number">{motoboys.filter(m => !m.disponivel).length}</div>
          </div>
        </section>

        <section className="animate-slide">
          <div className="table-container">
            <table className="table">
              <thead>
                <tr>
                  <th>Motoboy</th>
                  <th>Telefone</th>
                  <th>PIN</th>
                  <th>Status</th>
                  <th>Última Posição</th>
                  <th>Ações</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan="6" style={{ textAlign: 'center' }}>Carregando...</td></tr>
                ) : motoboys.length === 0 ? (
                  <tr><td colSpan="6" style={{ textAlign: 'center' }}>Nenhum motoboy cadastrado.</td></tr>
                ) : (
                  motoboys.map(m => (
                    <tr key={m.id}>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <div className="motoboy-avatar">{m.nome.charAt(0)}</div>
                          {m.nome}
                        </div>
                      </td>
                      <td>{m.telefone}</td>
                      <td><code>{m.pin}</code></td>
                      <td>
                        <span className={`badge ${m.disponivel ? 'badge-entregue' : 'badge-cancelado'}`}>
                          {m.disponivel ? 'Disponível' : 'Indisponível'}
                        </span>
                      </td>
                      <td>{m.ultima_posicao_em ? new Date(m.ultima_posicao_em).toLocaleTimeString() : 'N/A'}</td>
                      <td>
                        <button 
                          className="btn btn-outline btn-sm"
                          onClick={() => handleEdit(m)}
                        >
                          Editar
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>

        {showModal && (
          <div className="modal-overlay">
            <div className="modal">
              <div className="modal-header">
                <h3 className="modal-title">{formData.id ? 'Editar Motoboy' : 'Novo Motoboy'}</h3>
                <button className="btn-ghost" onClick={() => { setShowModal(false); setFormData({ nome: '', telefone: '', pin: '', email: '', id: null }); }}>✕</button>
              </div>
              <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '16px' }}>
                Nota: No Supabase, você precisa criar o usuário no menu Authentication primeiro.
              </p>
              <form onSubmit={handleCreate}>
                 <div className="form-group">
                  <label className="form-label">Nome Completo</label>
                  <input className="form-input" required value={formData.nome} onChange={e => setFormData({...formData, nome: e.target.value})} />
                </div>
                <div className="form-group">
                  <label className="form-label">Email cadastrado no Supabase</label>
                  <input type="email" className="form-input" required value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} />
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">PIN (4 dígitos)</label>
                    <input className="form-input" maxLength="4" required value={formData.pin} onChange={e => setFormData({...formData, pin: e.target.value})} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Telefone</label>
                    <input className="form-input" value={formData.telefone} onChange={e => setFormData({...formData, telefone: e.target.value})} />
                  </div>
                </div>
                <button type="submit" className="btn btn-primary btn-full">Salvar Dados</button>
              </form>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}

export default Motoboys
