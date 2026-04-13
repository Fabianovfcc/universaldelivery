import React, { useState, useEffect } from 'react'
import Sidebar from '../../components/Sidebar'
import MapaCentral from '../../components/MapaCentral'
import { supabase } from '../../lib/supabase'
import { optimizeDeliverySequence } from '../../services/logisticsService'

const Dashboard = () => {
  const [pedidos, setPedidos] = useState([])
  const [notificacoes, setNotificacoes] = useState([])
  const [stats, setStats] = useState({ pendentes: 0, em_rota: 0, entregues: 0 })
  const [loading, setLoading] = useState(true)
  const [showDespacho, setShowDespacho] = useState(null)
  const [motoboys, setMotoboys] = useState([])
  const [despachando, setDespachando] = useState(false)

  useEffect(() => {
    fetchPedidos()
    fetchNotificacoes()
    fetchMotoboys()

    const sub = supabase.channel('admin_dashboard')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'pedidos' }, () => fetchPedidos())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'notificacoes' }, () => fetchNotificacoes())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'usuarios' }, () => fetchMotoboys())
      .subscribe()

    return () => supabase.removeChannel(sub)
  }, [])

  const fetchPedidos = async () => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const { data } = await supabase
      .from('pedidos')
      .select('*')
      .gte('criado_em', today.toISOString())
      .order('sequencia', { ascending: true, nullsFirst: false })

    if (data) {
      setPedidos(data)
      setStats({
        pendentes: data.filter(p => p.status === 'pendente').length,
        em_rota: data.filter(p => p.status === 'em_rota' || p.status === 'atribuido').length,
        entregues: data.filter(p => p.status === 'entregue').length
      })
    }
    setLoading(false)
  }

  const fetchNotificacoes = async () => {
    const { data } = await supabase
      .from('notificacoes')
      .select('*')
      .eq('enviada', false)
      .order('criado_em', { ascending: false })
    if (data) setNotificacoes(data)
  }

  const fetchMotoboys = async () => {
    const { data } = await supabase
      .from('usuarios')
      .select('*')
      .eq('role', 'motoboy')
      .eq('ativo', true)
    if (data) setMotoboys(data)
  }

  const despacharPedido = async (pedidoId, motoboy) => {
    setDespachando(true)
    try {
      // 1. Atribuir pedido ao motoboy
      await supabase
        .from('pedidos')
        .update({ motoboy_id: motoboy.id, status: 'atribuido' })
        .eq('id', pedidoId)

      // 2. Buscar todos os pedidos ativos desse motoboy (incluindo o recém-atribuído)
      const { data: ativos } = await supabase
        .from('pedidos')
        .select('id, lat, lng')
        .eq('motoboy_id', motoboy.id)
        .in('status', ['atribuido', 'em_rota'])

      // 3. Otimizar sequência se tiver mais de 1 pedido e motoboy tiver posição
      if (ativos && ativos.length > 1 && motoboy.ultima_lat && motoboy.ultima_lng) {
        try {
          const origin = { lat: motoboy.ultima_lat, lng: motoboy.ultima_lng }
          const destinations = ativos
            .filter(a => a.lat && a.lng)
            .map(a => ({ lat: parseFloat(a.lat), lng: parseFloat(a.lng), id: a.id }))

          if (destinations.length > 1) {
            const optimizedIds = await optimizeDeliverySequence(origin, destinations)
            // Salvar sequência otimizada
            for (let i = 0; i < optimizedIds.length; i++) {
              await supabase
                .from('pedidos')
                .update({ sequencia: i + 1 })
                .eq('id', optimizedIds[i])
            }
          }
        } catch (optErr) {
          console.warn('Otimização falhou, usando ordem padrão:', optErr)
          // Se otimização falhar, apenas numera em ordem
          for (let i = 0; i < ativos.length; i++) {
            await supabase.from('pedidos').update({ sequencia: i + 1 }).eq('id', ativos[i].id)
          }
        }
      } else if (ativos && ativos.length === 1) {
        // Só 1 pedido — sequência = 1
        await supabase.from('pedidos').update({ sequencia: 1 }).eq('id', ativos[0].id)
      }

      setShowDespacho(null)
      fetchPedidos()
    } catch (err) {
      console.error('Erro ao despachar:', err)
      alert('Erro ao despachar pedido: ' + err.message)
    } finally {
      setDespachando(false)
    }
  }

  const enviarWhatsApp = async (notif) => {
    const telefone = notif.telefone_cliente.replace(/\D/g, '')
    const msg = encodeURIComponent(notif.mensagem)
    window.open(`https://wa.me/55${telefone}?text=${msg}`, '_blank')
    await supabase.from('notificacoes').update({ enviada: true }).eq('id', notif.id)
    fetchNotificacoes()
  }

  const getStatusBadge = (status) => {
    const labels = {
      pendente: 'Pendente', atribuido: 'Atribuído',
      em_rota: 'Em rota', entregue: 'Entregue', cancelado: 'Cancelado'
    }
    return (
      <span className={`badge badge-${status}`}>
        <span className="badge-dot"></span>{labels[status]}
      </span>
    )
  }

  return (
    <div className="app-layout">
      <Sidebar />
      <main className="main-content">
        <header className="page-header">
          <div>
            <h1 className="page-title">Painel Geral</h1>
            <p className="page-subtitle">Gestão de entregas com inteligência logística</p>
          </div>
          <a href="/admin/novo-pedido" className="btn btn-primary">🚀 Novo Pedido</a>
        </header>

        {/* Notificações WhatsApp */}
        {notificacoes.length > 0 && (
          <section className="animate-slide" style={{ marginBottom: '24px' }}>
            {notificacoes.map(n => (
              <div key={n.id} className="toast success" style={{ position: 'relative', marginBottom: '8px', width: '100%', animation: 'none' }}>
                <span style={{ flex: 1 }}>
                  📲 <strong>Motoboy chegou!</strong> Enviar aviso para {n.telefone_cliente}
                </span>
                <button className="btn btn-success" onClick={() => enviarWhatsApp(n)}>
                  Enviar WhatsApp
                </button>
              </div>
            ))}
          </section>
        )}

        {/* Stats */}
        <section className="stats-grid animate-fade">
          <div className="stat-card total">
            <div className="stat-label">Total de Hoje</div>
            <div className="stat-number">{pedidos.length}</div>
          </div>
          <div className="stat-card pending">
            <div className="stat-label">Pendentes</div>
            <div className="stat-number">{stats.pendentes}</div>
          </div>
          <div className="stat-card active">
            <div className="stat-label">Em Entrega</div>
            <div className="stat-number">{stats.em_rota}</div>
          </div>
          <div className="stat-card done">
            <div className="stat-label">Entregues</div>
            <div className="stat-number">{stats.entregues}</div>
          </div>
        </section>

        {/* Mapa ao Vivo */}
        <section style={{ marginBottom: '24px' }} className="animate-slide">
          <MapaCentral />
        </section>

        {/* Tabela de Pedidos */}
        <section className="animate-slide">
          <h2 className="section-title">📦 Pedidos do Dia</h2>
          <div className="table-container">
            <table className="table">
              <thead>
                <tr>
                  <th>Seq</th>
                  <th>Cliente</th>
                  <th>Endereço</th>
                  <th>Valor</th>
                  <th>Status</th>
                  <th>Hora</th>
                  <th>Ações</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan="7" style={{ textAlign: 'center' }}>Carregando...</td></tr>
                ) : pedidos.length === 0 ? (
                  <tr><td colSpan="7" style={{ textAlign: 'center' }}>Nenhum pedido hoje.</td></tr>
                ) : pedidos.map(p => (
                  <tr key={p.id}>
                    <td>
                      <span className="badge badge-outline" style={{ minWidth: '28px', justifyContent: 'center' }}>
                        {p.sequencia || '—'}
                      </span>
                    </td>
                    <td><strong>{p.cliente_nome}</strong></td>
                    <td style={{ maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {p.endereco_entrega}
                    </td>
                    <td style={{ fontWeight: 700, color: 'var(--success)' }}>
                      R$ {p.valor_pedido?.toFixed(2)}
                    </td>
                    <td>{getStatusBadge(p.status)}</td>
                    <td>{new Date(p.criado_em).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</td>
                    <td style={{ display: 'flex', gap: '6px' }}>
                      {p.status === 'pendente' && (
                        <button
                          className="btn btn-primary"
                          style={{ fontSize: '12px', padding: '4px 12px' }}
                          onClick={() => setShowDespacho(p)}
                        >
                          Despachar
                        </button>
                      )}
                      {p.link_rastreio && (
                        <button
                          className="btn btn-ghost"
                          style={{ fontSize: '12px' }}
                          onClick={() => navigator.clipboard.writeText(`${window.location.origin}/rastreio/${p.link_rastreio}`)}
                        >
                          📋 Link
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* Modal de Despacho */}
        {showDespacho && (
          <div className="modal-overlay" onClick={() => !despachando && setShowDespacho(null)}>
            <div className="modal" onClick={e => e.stopPropagation()}>
              <div className="modal-header">
                <h3 className="modal-title">Despachar para Motoboy</h3>
                <button className="btn btn-ghost" onClick={() => setShowDespacho(null)} disabled={despachando}>✕</button>
              </div>
              <p style={{ marginBottom: '16px', color: 'var(--text-secondary)' }}>
                Pedido de <strong>{showDespacho.cliente_nome}</strong> — R$ {showDespacho.valor_pedido?.toFixed(2)}
              </p>
              {despachando ? (
                <div style={{ textAlign: 'center', padding: '24px', color: 'var(--text-secondary)' }}>
                  ⚙️ Calculando rota otimizada...
                </div>
              ) : (
                <div className="motoboy-select-list">
                  {motoboys.filter(m => m.disponivel).length === 0 ? (
                    <p style={{ color: 'var(--text-muted)', textAlign: 'center' }}>
                      Nenhum motoboy disponível no momento.
                    </p>
                  ) : (
                    motoboys.filter(m => m.disponivel).map(m => (
                      <div
                        key={m.id}
                        className="motoboy-select-item"
                        onClick={() => despacharPedido(showDespacho.id, m)}
                      >
                        <div className="motoboy-avatar">{m.nome.charAt(0)}</div>
                        <div className="motoboy-info">
                          <div className="motoboy-info-name">{m.nome}</div>
                          <div className="motoboy-info-status">
                            {m.ultima_lat ? '📍 Posição conhecida' : '📡 Sem posição GPS'}
                          </div>
                        </div>
                        <div className="status-dot available"></div>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  )
}

export default Dashboard
