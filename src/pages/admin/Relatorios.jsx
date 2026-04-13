import React, { useState, useEffect } from 'react'
import Sidebar from '../../components/Sidebar'
import { supabase } from '../../lib/supabase'

const Relatorios = () => {
  const [pedidos, setPedidos] = useState([])
  const [motoboys, setMotoboys] = useState([])
  const [periodo, setPeriodo] = useState('hoje')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchData()
  }, [periodo])

  const getDataInicio = () => {
    const now = new Date()
    if (periodo === 'hoje') return new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString()
    if (periodo === 'semana') { const d = new Date(now); d.setDate(d.getDate() - 7); return d.toISOString() }
    if (periodo === 'mes') { const d = new Date(now); d.setMonth(d.getMonth() - 1); return d.toISOString() }
    return new Date(0).toISOString()
  }

  const fetchData = async () => {
    setLoading(true)
    const dataInicio = getDataInicio()

    const [pedidosRes, motobRes] = await Promise.all([
      supabase.from('pedidos').select('*').gte('criado_em', dataInicio).order('criado_em', { ascending: false }),
      supabase.from('usuarios').select('*').eq('role', 'motoboy').eq('ativo', true)
    ])

    if (pedidosRes.data) setPedidos(pedidosRes.data)
    if (motobRes.data) setMotoboys(motobRes.data)
    setLoading(false)
  }

  // Cálculos
  const entregues = pedidos.filter(p => p.status === 'entregue')
  const cancelados = pedidos.filter(p => p.status === 'cancelado')
  const valorTotal = entregues.reduce((sum, p) => sum + (p.valor_pedido || 0), 0)

  const temposMedios = entregues
    .filter(p => p.saiu_em && p.entregue_em)
    .map(p => (new Date(p.entregue_em) - new Date(p.saiu_em)) / 60000)

  const tempoMedio = temposMedios.length > 0 
    ? Math.round(temposMedios.reduce((a, b) => a + b, 0) / temposMedios.length) 
    : 0

  const tempoMaisRapido = temposMedios.length > 0 ? Math.round(Math.min(...temposMedios)) : 0

  const taxaAceitacao = pedidos.length > 0 
    ? Math.round(((pedidos.length - cancelados.length) / pedidos.length) * 100) 
    : 100

  // Métricas por motoboy
  const ranking = motoboys.map(m => {
    const entregas = entregues.filter(p => p.motoboy_id === m.id)
    const tempos = entregas
      .filter(p => p.saiu_em && p.entregue_em)
      .map(p => (new Date(p.entregue_em) - new Date(p.saiu_em)) / 60000)
    
    return {
      ...m,
      qtdEntregas: entregas.length,
      tempoMedio: tempos.length > 0 ? Math.round(tempos.reduce((a, b) => a + b, 0) / tempos.length) : 0,
      valorEntregue: entregas.reduce((sum, p) => sum + (p.valor_pedido || 0), 0)
    }
  }).sort((a, b) => b.qtdEntregas - a.qtdEntregas)

  // Entregas por hora
  const entregasPorHora = Array(24).fill(0)
  entregues.forEach(p => {
    const hora = new Date(p.criado_em).getHours()
    entregasPorHora[hora]++
  })
  const maxHora = Math.max(...entregasPorHora, 1)

  return (
    <div className="app-layout">
      <Sidebar />
      <main className="main-content">
        <header className="page-header">
          <div>
            <h1 className="page-title">📈 Relatórios</h1>
            <p className="page-subtitle">Métricas e desempenho da sua operação</p>
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            {['hoje', 'semana', 'mes'].map(p => (
              <button key={p} className={`btn ${periodo === p ? 'btn-primary' : 'btn-outline'}`} onClick={() => setPeriodo(p)}>
                {p === 'hoje' ? 'Hoje' : p === 'semana' ? '7 Dias' : '30 Dias'}
              </button>
            ))}
          </div>
        </header>

        {loading ? <p>Carregando...</p> : (
          <>
            {/* KPIs Principais */}
            <section className="stats-grid animate-fade">
              <div className="stat-card total">
                <div className="stat-label">Total de Entregas</div>
                <div className="stat-number">{entregues.length}</div>
              </div>
              <div className="stat-card active">
                <div className="stat-label">Tempo Médio</div>
                <div className="stat-number">{tempoMedio}<span style={{ fontSize: '14px', fontWeight: 400 }}> min</span></div>
              </div>
              <div className="stat-card done">
                <div className="stat-label">Valor Total</div>
                <div className="stat-number" style={{ fontSize: '24px' }}>R$ {valorTotal.toFixed(2)}</div>
              </div>
              <div className="stat-card pending">
                <div className="stat-label">Taxa Aceitação</div>
                <div className="stat-number">{taxaAceitacao}%</div>
              </div>
            </section>

            {/* KPIs Secundários */}
            <section className="stats-grid animate-fade" style={{ marginBottom: '24px' }}>
              <div className="stat-card" style={{ borderTop: '3px solid var(--accent-secondary)' }}>
                <div className="stat-label">Entrega Mais Rápida</div>
                <div className="stat-number" style={{ color: 'var(--accent-secondary)' }}>
                  {tempoMaisRapido}<span style={{ fontSize: '14px', fontWeight: 400 }}> min</span>
                </div>
              </div>
              <div className="stat-card" style={{ borderTop: '3px solid var(--danger)' }}>
                <div className="stat-label">Cancelamentos</div>
                <div className="stat-number" style={{ color: 'var(--danger)' }}>{cancelados.length}</div>
              </div>
              <div className="stat-card" style={{ borderTop: '3px solid var(--accent-primary)' }}>
                <div className="stat-label">Pedidos Totais</div>
                <div className="stat-number" style={{ color: 'var(--accent-primary)' }}>{pedidos.length}</div>
              </div>
            </section>

            {/* Gráfico de Entregas por Hora */}
            <section className="card animate-slide" style={{ marginBottom: '24px' }}>
              <h3 style={{ marginBottom: '16px', fontSize: '14px', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>
                ⏰ Entregas por Hora do Dia
              </h3>
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: '4px', height: '120px' }}>
                {entregasPorHora.map((count, hora) => (
                  <div key={hora} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
                    <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>{count > 0 ? count : ''}</span>
                    <div style={{
                      width: '100%',
                      height: `${Math.max((count / maxHora) * 100, 2)}px`,
                      background: count > 0 ? 'linear-gradient(to top, var(--accent-primary), var(--accent-secondary))' : 'var(--bg-secondary)',
                      borderRadius: '4px 4px 0 0',
                      transition: 'height 0.3s ease',
                      minHeight: '2px'
                    }}></div>
                    <span style={{ fontSize: '9px', color: 'var(--text-muted)' }}>{hora}h</span>
                  </div>
                ))}
              </div>
            </section>

            {/* Ranking de Motoboys */}
            <section className="animate-slide">
              <h2 className="section-title">🏆 Ranking dos Motoboys</h2>
              <div className="table-container">
                <table className="table">
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Motoboy</th>
                      <th>Entregas</th>
                      <th>Tempo Médio</th>
                      <th>Valor Entregue</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ranking.map((m, i) => (
                      <tr key={m.id}>
                        <td>
                          <span style={{ fontSize: '18px' }}>
                            {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}º`}
                          </span>
                        </td>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <div className="motoboy-avatar">{m.nome.charAt(0)}</div>
                            <strong>{m.nome}</strong>
                          </div>
                        </td>
                        <td><strong>{m.qtdEntregas}</strong></td>
                        <td>{m.tempoMedio > 0 ? `${m.tempoMedio} min` : '-'}</td>
                        <td style={{ color: 'var(--success)', fontWeight: 700 }}>R$ {m.valorEntregue.toFixed(2)}</td>
                        <td>
                          <span className={`badge ${m.disponivel ? 'badge-entregue' : 'badge-cancelado'}`}>
                            {m.disponivel ? 'Online' : 'Offline'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          </>
        )}
      </main>
    </div>
  )
}

export default Relatorios
