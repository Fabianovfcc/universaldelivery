import React, { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import { useGeolocation } from '../../hooks/useGeolocation'
import { googleMapsLoader } from '../../lib/googleMaps'

const Entrega = () => {
  const { id } = useParams()
  const { profile } = useAuth()
  const navigate = useNavigate()
  const { position } = useGeolocation()

  const mapRef = useRef(null)
  const [google, setGoogle] = useState(null)
  const [map, setMap] = useState(null)
  const [directionsRenderer, setDirectionsRenderer] = useState(null)
  const [pedido, setPedido] = useState(null)
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState(false)
  const [distancia, setDistancia] = useState(null)
  const [tempoEstimado, setTempoEstimado] = useState(null)
  const [notificando, setNotificando] = useState(false)
  const [routeError, setRouteError] = useState(null)

  const motoboyMarker = useRef(null)
  const destinationMarker = useRef(null)

  // 1. Carregar o pedido primeiro
  useEffect(() => {
    fetchPedido()
  }, [id])

  // 2. Inicializar o mapa somente APÓS o carregamento e quando o ref estiver pronto
  useEffect(() => {
    if (loading || !mapRef.current || map) return

    googleMapsLoader.load().then((g) => {
      setGoogle(g)
      const instance = new g.maps.Map(mapRef.current, {
        center: { lat: -25.5135, lng: -54.6174 },
        zoom: 15,
        disableDefaultUI: true,
        styles: [
          { elementType: 'geometry', stylers: [{ color: '#1d1d2b' }] },
          { elementType: 'labels.text.fill', stylers: [{ color: '#8ec3b9' }] },
          { elementType: 'labels.text.stroke', stylers: [{ color: '#1d1d2b' }] },
          { featureType: 'poi', stylers: [{ visibility: 'off' }] },
          { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#2c2c44' }] },
          { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#0e0e1a' }] }
        ]
      })
      const renderer = new g.maps.DirectionsRenderer({
        map: instance,
        suppressMarkers: true,
        polylineOptions: { strokeColor: '#6c5ce7', strokeWeight: 6, strokeOpacity: 0.85 }
      })
      setMap(instance)
      setDirectionsRenderer(renderer)
    })
  }, [loading]) // Depende do loading para garantir que o DOM já tenha o mapRef

  // 3. Atualizar marcadores e rota
  useEffect(() => {
    if (google && map && directionsRenderer && position && pedido?.lat && pedido?.lng) {
      const dest = { lat: parseFloat(pedido.lat), lng: parseFloat(pedido.lng) }
      const orig = { lat: position.lat, lng: position.lng }

      if (motoboyMarker.current) {
        motoboyMarker.current.setPosition(orig)
      } else {
        motoboyMarker.current = new google.maps.Marker({
          position: orig,
          map,
          icon: {
            path: google.maps.SymbolPath.FORWARD_CLOSED_ARROW,
            scale: 5,
            fillColor: '#6c5ce7',
            fillOpacity: 1,
            strokeWeight: 2,
            strokeColor: '#FFFFFF',
          }
        })
      }

      if (!destinationMarker.current) {
        destinationMarker.current = new google.maps.Marker({
          position: dest,
          map,
          label: { text: "🏁", fontSize: "20px" }
        })
      }

      const ds = new google.maps.DirectionsService()
      ds.route(
        {
          origin: orig,
          destination: dest,
          travelMode: google.maps.TravelMode.DRIVING
        },
        (result, status) => {
          if (status === 'OK') {
            directionsRenderer.setDirections(result)
            const leg = result.routes[0].legs[0]
            setDistancia(leg.distance.text)
            setTempoEstimado(leg.duration.text)
            setRouteError(null)
          } else {
            console.error('Directions error:', status)
            setRouteError(`Rota indisponível: ${status}`)
          }
        }
      )
    }
  }, [google, map, directionsRenderer, position, pedido])

  const fetchPedido = async () => {
    const { data } = await supabase.from('pedidos').select('*').eq('id', id).single()
    if (data) setPedido(data)
    setLoading(false)
  }

  const sairParaEntrega = async () => {
    setActionLoading(true)
    await supabase.from('pedidos').update({ status: 'em_rota', saiu_em: new Date().toISOString() }).eq('id', id)
    await fetchPedido()
    setActionLoading(false)
  }

  const finalizarEntrega = async () => {
    setActionLoading(true)
    try {
      await supabase.from('pedidos').update({ status: 'entregue', entregue_em: new Date().toISOString() }).eq('id', id)
      const { data: proximo } = await supabase.from('pedidos')
        .select('id').eq('motoboy_id', profile.id).in('status', ['atribuido', 'em_rota'])
        .order('sequencia', { ascending: true }).limit(1).maybeSingle()
      if (proximo) navigate(`/motoboy/entrega/${proximo.id}`)
      else navigate('/motoboy')
    } catch (err) {
      navigate('/motoboy')
    } finally {
      setActionLoading(false)
    }
  }

  const notificarCliente = async () => {
    if (!pedido?.cliente_telefone) return alert('Sem telefone cadastrado.')
    setNotificando(true)
    try {
      await supabase.from('pedidos').update({ cliente_notificado: true, cliente_notificado_em: new Date().toISOString() }).eq('id', id)
      await supabase.from('notificacoes').insert([{
        tipo: 'chegada_cliente', pedido_id: id, motoboy_id: profile.id,
        mensagem: `Olá ${pedido.cliente_nome}! Seu entregador chegou.`,
        telefone_cliente: pedido.cliente_telefone, lida: false, enviada: false
      }])
      alert('✅ Notificação enviada!')
    } catch (err) {
      alert('Erro: ' + err.message)
    } finally {
      setNotificando(false)
    }
  }

  if (loading) return (
    <div className="motoboy-layout">
      <div className="motoboy-content" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh' }}>
        <p style={{ color: 'var(--text-muted)' }}>Sincronizando satélites...</p>
      </div>
    </div>
  )

  return (
    <div className="motoboy-layout animate-fade">
      <header className="motoboy-header">
        <button className="btn btn-ghost" onClick={() => navigate('/motoboy')}>← Lista</button>
        <span className="motoboy-name">{pedido?.sequencia ? `Parada #${pedido.sequencia}` : 'Entrega'}</span>
      </header>

      <div className="motoboy-content">
        <div className="progress-bar" style={{ marginBottom: '16px' }}>
          {['atribuido', 'em_rota', 'entregue'].map((s, i) => (
            <div key={s} className={`progress-step ${pedido?.status === s ? 'active' : ''}`}>
              <div className="progress-dot">{i + 1}</div>
            </div>
          ))}
        </div>

        <div className="card animate-fade" style={{ marginBottom: '16px' }}>
          <div style={{ fontSize: '18px', fontWeight: 700 }}>{pedido?.cliente_nome}</div>
          <div className="pedido-endereco">📍 {pedido?.endereco_entrega}</div>
          
          {(distancia || tempoEstimado) && (
            <div style={{ display: 'flex', gap: '24px', marginTop: '16px', paddingTop: '16px', borderTop: '1px solid var(--border)' }}>
              <div>
                <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>CHEGADA EM</div>
                <div style={{ fontSize: '22px', fontWeight: 900, color: 'var(--accent-secondary)' }}>{tempoEstimado || '--'}</div>
              </div>
              <div>
                <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>DISTÂNCIA</div>
                <div style={{ fontSize: '22px', fontWeight: 900 }}>{distancia || '--'}</div>
              </div>
            </div>
          )}
          {routeError && <p style={{ color: 'var(--danger)', fontSize: '11px', marginTop: '8px' }}>⚠️ {routeError}</p>}
        </div>

        <div className="map-container" style={{ height: '340px', borderRadius: '24px', overflow: 'hidden', marginBottom: '16px', border: '1px solid var(--border)', position: 'relative' }}>
          <div ref={mapRef} style={{ height: '100%', width: '100%', position: 'absolute', top: 0, left: 0 }}></div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {pedido?.status === 'atribuido' ? (
            <button className="btn btn-primary btn-lg btn-full" onClick={sairParaEntrega} disabled={actionLoading}>🚀 SAIR PARA ENTREGA</button>
          ) : (
            <>
              <button className="btn btn-success btn-lg btn-full" onClick={finalizarEntrega} disabled={actionLoading}>✅ CONFIRMAR ENTREGA</button>
              <button className="btn btn-outline btn-lg btn-full" onClick={notificarCliente} disabled={notificando || pedido?.cliente_notificado}>
                {pedido?.cliente_notificado ? '✅ Cliente Notificado' : '📲 AVISAR CLIENTE'}
              </button>
            </>
          )}
          <a href={`https://www.google.com/maps/dir/?api=1&destination=${pedido?.lat},${pedido?.lng}`} target="_blank" rel="noreferrer" className="btn btn-ghost btn-lg btn-full">🔊 Navegação por Voz</a>
        </div>
      </div>
    </div>
  )
}

export default Entrega
