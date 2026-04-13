import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { supabase } from '../../lib/supabase'
import { useGeolocation } from '../../hooks/useGeolocation'

const Home = () => {
  const { profile, signOut } = useAuth()
  const [disponivel, setDisponivel] = useState(profile?.disponivel || false)
  const [pedidosPendentes, setPedidosPendentes] = useState([])
  const [meusPedidos, setMeusPedidos] = useState([])
  const [loading, setLoading] = useState(true)
  const { error: gpsError } = useGeolocation()
  
  const navigate = useNavigate()

  useEffect(() => {
    if (!profile) return
    setDisponivel(profile.disponivel)
    fetchPedidos()

    // Realtime subscriptions
    const channel = supabase
      .channel('motoboy_updates')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'pedidos' }, () => {
        fetchPedidos()
      })
      .subscribe()

    return () => supabase.removeChannel(channel)
  }, [profile])

  const fetchPedidos = async () => {
    if (!profile) return
    setLoading(true)

    try {
      const hoje = new Date()
      hoje.setHours(0,0,0,0)
      
      // Pedidos pendentes (sem motoboy, apenas de hoje)
      const { data: pendentes } = await supabase
        .from('pedidos')
        .select('*')
        .eq('status', 'pendente')
        .gte('criado_em', hoje.toISOString())
        .order('criado_em', { ascending: false })

      // Meus pedidos (atribuídos ou em rota)
      const { data: meus } = await supabase
        .from('pedidos')
        .select('*')
        .eq('motoboy_id', profile.id)
        .in('status', ['atribuido', 'em_rota'])
        .order('criado_em', { ascending: false })

      if (pendentes) setPedidosPendentes(pendentes)
      if (meus) setMeusPedidos(meus)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const toggleDisponibilidade = async () => {
    const novoStatus = !disponivel
    setDisponivel(novoStatus)

    try {
      await supabase
        .from('usuarios')
        .update({ disponivel: novoStatus })
        .eq('id', profile.id)
    } catch (err) {
      alert('Erro ao atualizar status')
      setDisponivel(!novoStatus)
    }
  }

  const aceitarPedido = async (id) => {
    try {
      const { error } = await supabase
        .from('pedidos')
        .update({ 
          motoboy_id: profile.id, 
          status: 'atribuido' 
        })
        .eq('id', id)

      if (error) throw error
      fetchPedidos()
    } catch (err) {
      alert('Erro ao aceitar pedido: ' + err.message)
    }
  }

  return (
    <div className="motoboy-layout">
      <header className="motoboy-header">
        <div className="logo-text">Universal<span>Delivery</span></div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span className="motoboy-name">Olá, {profile?.nome.split(' ')[0]}</span>
          <button onClick={signOut} className="btn-ghost">Sair</button>
        </div>
      </header>

      <div className="motoboy-content animate-fade">
        <div className="toggle-container">
          <div className="toggle-info" style={{ flex: 1 }}>
            <div className="toggle-label">Meu Status</div>
            <div className={`toggle-status ${disponivel ? 'online' : ''}`}>
              {disponivel ? '● DISPONÍVEL' : '○ INDISPONÍVEL'}
            </div>
          </div>
          <label className="toggle">
            <input type="checkbox" checked={disponivel} onChange={toggleDisponibilidade} />
            <span className="toggle-slider"></span>
          </label>
        </div>

        {/* GPS Status Indicator */}
        <div style={{ 
          fontSize: '11px', 
          color: gpsError ? 'var(--danger)' : 'var(--success)', 
          marginBottom: '20px',
          display: 'flex',
          alignItems: 'center',
          gap: '6px'
        }}>
          <span style={{ 
            width: '8px', 
            height: '8px', 
            borderRadius: '50%', 
            background: gpsError ? 'var(--danger)' : 'var(--success)',
            boxShadow: gpsError ? 'none' : '0 0 8px var(--success)'
          }}></span>
          {gpsError ? `Erro GPS: ${gpsError}` : 'Rastreamento GPS Ativo'}
        </div>

        {meusPedidos.length > 0 && (
          <section style={{ marginBottom: '24px' }}>
            <h2 className="section-title">🏃 Minha Entrega Ativa</h2>
            {meusPedidos.map(p => (
              <div key={p.id} className="pedido-card animate-slide" onClick={() => navigate(`/motoboy/entrega/${p.id}`)}>
                <div className="pedido-header">
                  <span className="pedido-id">{p.ifood_id || 'PEDIDO'}</span>
                  <span className={`badge badge-${p.status}`}>
                    {p.status === 'atribuido' ? 'No restaurante' : 'Em rota'}
                  </span>
                </div>
                <div className="pedido-cliente">{p.cliente_nome}</div>
                <div className="pedido-endereco">📍 {p.endereco_entrega}</div>
                <div className="pedido-footer">
                  <span className="pedido-valor">R$ {p.valor_pedido?.toFixed(2)}</span>
                  <button className="btn btn-primary btn-sm">Abrir Navegação</button>
                </div>
              </div>
            ))}
          </section>
        )}

        <section>
          <h2 className="section-title">🔔 Pedidos Disponíveis ({pedidosPendentes.length})</h2>
          {!disponivel ? (
            <div className="empty-state">
              <div className="empty-state-icon">📴</div>
              <p className="empty-state-text">Fique "Disponível" para ver novos pedidos.</p>
            </div>
          ) : pedidosPendentes.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-icon">☕</div>
              <p className="empty-state-text">Nenhum pedido pendente agora. Aproveite o café!</p>
            </div>
          ) : (
            pedidosPendentes.map(p => (
              <div key={p.id} className="pedido-card animate-slide">
                <div className="pedido-header">
                   <span className="pedido-id">{p.ifood_id || 'PENDENTE'}</span>
                </div>
                <div className="pedido-cliente">{p.cliente_nome}</div>
                <div className="pedido-endereco">📍 {p.endereco_entrega}</div>
                <div className="pedido-itens">{p.itens || 'Itens não especificados'}</div>
                <div className="pedido-footer">
                  <span className="pedido-valor">R$ {p.valor_pedido?.toFixed(2)}</span>
                  <button onClick={() => aceitarPedido(p.id)} className="btn btn-success btn-sm">ACEITAR</button>
                </div>
              </div>
            ))
          )}
        </section>
      </div>
    </div>
  )
}

export default Home
