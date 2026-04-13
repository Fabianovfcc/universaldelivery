import React, { useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import { googleMapsLoader } from '../lib/googleMaps'
import { snapToRoad } from '../services/logisticsService'

const MapaCentral = () => {
  const mapRef = useRef(null)
  const [google, setGoogle] = useState(null)
  const [map, setMap] = useState(null)
  const markersRef = useRef({})
  const [motoboys, setMotoboys] = useState([])
  const [pedidosAtivos, setPedidosAtivos] = useState({})

  // Carregar Google Maps API
  useEffect(() => {
    googleMapsLoader.load().then((g) => {
      setGoogle(g)
      const instance = new g.maps.Map(mapRef.current, {
        center: { lat: -23.55, lng: -46.63 },
        zoom: 13,
        styles: [
          { "featureType": "all", "elementType": "labels.text.fill", "stylers": [{ "color": "#7c93a3" }] },
          { "featureType": "water", "elementType": "geometry", "stylers": [{ "color": "#c9d2d4" }] }
        ]
      })
      setMap(instance)
    })
  }, [])

  useEffect(() => {
    fetchMotoboys()
    fetchPedidosAtivos()

    // 1. Escutar mudanças no banco
    const channelDB = supabase
      .channel('mapa_admin_db')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'usuarios' }, () => fetchMotoboys())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'pedidos' }, () => fetchPedidosAtivos())
      .subscribe()

    // 2. Escutar atualizações via BROADCAST
    const channelTracking = supabase
      .channel('universal_tracking')
      .on('broadcast', { event: 'location' }, async ({ payload }) => {
        if (!google || !map) return
        const snappedPos = await snapToRoad(payload.lat, payload.lng)
        updateMarker(payload.userId, snappedPos, payload.heading)
      })
      .subscribe()

    return () => {
      supabase.removeChannel(channelDB)
      supabase.removeChannel(channelTracking)
    }
  }, [google, map])

  const fetchMotoboys = async () => {
    const { data } = await supabase.from('usuarios').select('*').eq('role', 'motoboy').eq('ativo', true)
    if (data) setMotoboys(data)
  }

  const fetchPedidosAtivos = async () => {
    const { data } = await supabase.from('pedidos').select('*').in('status', ['atribuido', 'em_rota'])
    if (data) {
      const pMap = {}
      data.forEach(p => { if (p.motoboy_id) pMap[p.motoboy_id] = p })
      setPedidosAtivos(pMap)
    }
  }

  const updateMarker = (id, position, heading) => {
    const marker = markersRef.current[id]
    if (marker) {
      marker.setPosition(position)
      if (heading !== undefined) {
        const icon = marker.getIcon()
        if (icon) {
          icon.rotation = heading
          marker.setIcon(icon)
        }
      }
    }
  }

  useEffect(() => {
    if (!map || !google || motoboys.length === 0) return

    // Centralizar mapa nas posições dos motoboys (Polimento)
    const validMotoboys = motoboys.filter(m => m.ultima_lat && m.ultima_lng)
    if (validMotoboys.length > 0) {
      const avgLat = validMotoboys.reduce((sum, m) => sum + m.ultima_lat, 0) / validMotoboys.length
      const avgLng = validMotoboys.reduce((sum, m) => sum + m.ultima_lng, 0) / validMotoboys.length
      map.setCenter({ lat: avgLat, lng: avgLng })
    }

    motoboys.forEach(m => {
      if (!m.ultima_lat || !m.ultima_lng) return
      if (markersRef.current[m.id]) return

      const status = !m.disponivel ? 'indisponivel' : pedidosAtivos[m.id] ? 'em_entrega' : 'disponivel'
      const colors = { disponivel: '#00e676', em_entrega: '#448aff', indisponivel: '#ff5252' }

      const marker = new google.maps.Marker({
        position: { lat: m.ultima_lat, lng: m.ultima_lng },
        map,
        title: m.nome,
        icon: {
          path: 'M23.5,17h-5V7.1c0-2.8-2.2-5-5-5h-7c-2.8,0-5,2.2-5,5V17h-5c-0.3,0-0.5,0.2-0.5,0.5v1c0,0.3,0.2,0.5,0.5,0.5h5v2.5 c0,2.8,2.2,5,5,5h7c2.8,0,5-2.2,5-5V19h5c0.3,0,0.5-0.2,0.5-0.5v-1C24,17.2,23.8,17,23.5,17z',
          fillColor: colors[status],
          fillOpacity: 1,
          strokeWeight: 2,
          strokeColor: '#FFFFFF',
          scale: 1.2,
          anchor: new google.maps.Point(12, 12)
        }
      })
      markersRef.current[m.id] = marker
    })
  }, [motoboys, map, google, pedidosAtivos])

  return (
    <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
      <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h3 style={{ fontSize: '14px', fontWeight: 700 }}>🗺️ Centro de Operações (Google Maps)</h3>
        <div style={{ display: 'flex', gap: '12px', fontSize: '11px', fontWeight: 600 }}>
          <span style={{ color: '#00e676' }}>● Ativo</span>
          <span style={{ color: '#448aff' }}>● Rota</span>
          <span style={{ color: '#ff5252' }}>● Off</span>
        </div>
      </div>
      <div ref={mapRef} style={{ height: '450px', width: '100%' }}></div>
    </div>
  )
}

export default MapaCentral
