import React, { useState, useEffect, useRef } from 'react'
import { useParams } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { googleMapsLoader } from '../../lib/googleMaps'
import { snapToRoad } from '../../services/logisticsService'

const Rastreio = () => {
  const { id } = useParams()
  const mapRef = useRef(null)
  
  const [google, setGoogle] = useState(null)
  const [map, setMap] = useState(null)
  const [marker, setMarker] = useState(null)
  const [directionsRenderer, setDirectionsRenderer] = useState(null)
  
  const [pedido, setPedido] = useState(null)
  const [motoboy, setMotoboy] = useState(null)
  const [loading, setLoading] = useState(true)
  const [eta, setEta] = useState(null)

  useEffect(() => {
    googleMapsLoader.load().then((g) => {
      setGoogle(g)
      const instance = new g.maps.Map(mapRef.current, {
        center: { lat: -23.55, lng: -46.63 },
        zoom: 15,
        disableDefaultUI: true,
        styles: [{ "featureType": "poi", "stylers": [{ "visibility": "off" }] }]
      })
      const renderer = new g.maps.DirectionsRenderer({
        map: instance,
        suppressMarkers: true,
        polylineOptions: { strokeColor: '#448aff', strokeWeight: 5, strokeOpacity: 0.7 }
      })
      setMap(instance)
      setDirectionsRenderer(renderer)
    })
  }, [])

  useEffect(() => {
    fetchData()
  }, [id])

  const fetchData = async () => {
    const { data: p } = await supabase.from('pedidos').select('*').eq('link_rastreio', id).single()
    if (p) {
      setPedido(p)
      if (p.motoboy_id) fetchMotoboy(p.motoboy_id)
      
      supabase.channel(`tracking_status:${id}`)
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'pedidos', filter: `link_rastreio=eq.${id}` }, (payload) => {
          setPedido(payload.new)
        })
        .subscribe()
    }
    setLoading(false)
  }

  const fetchMotoboy = async (motoboyId) => {
    const { data: m } = await supabase.from('usuarios').select('*').eq('id', motoboyId).single()
    if (m) setMotoboy(m)

    supabase.channel('universal_tracking')
      .on('broadcast', { event: 'location' }, async ({ payload }) => {
        if (payload.userId !== motoboyId) return
        const snapped = await snapToRoad(payload.lat, payload.lng)
        updateMarker(snapped, payload.heading)
      })
      .subscribe()
  }

  const updateMarker = (pos, heading) => {
    if (!google || !map) return
    if (marker) {
      marker.setPosition(pos)
    } else {
      const newMarker = new google.maps.Marker({
        position: pos,
        map,
        icon: {
          path: google.maps.SymbolPath.FORWARD_CLOSED_ARROW,
          scale: 5,
          fillColor: '#448aff',
          fillOpacity: 1,
          strokeWeight: 2,
          strokeColor: '#FFFFFF',
          rotation: heading || 0
        }
      })
      setMarker(newMarker)
    }
  }

  useEffect(() => {
    if (google && map && motoboy?.ultima_lat && !marker) {
      updateMarker({ lat: motoboy.ultima_lat, lng: motoboy.ultima_lng }, motoboy.heading || 0)
    }
  }, [google, map, motoboy, marker])

  useEffect(() => {
    if (google && map && directionsRenderer && motoboy?.ultima_lat && pedido?.lat) {
      const ds = new google.maps.DirectionsService()
      ds.route({
        origin: { lat: motoboy.ultima_lat, lng: motoboy.ultima_lng },
        destination: { lat: pedido.lat, lng: pedido.lng },
        travelMode: google.maps.TravelMode.DRIVING
      }, (res, status) => {
        if (status === 'OK') {
          directionsRenderer.setDirections(res)
          const duration = res.routes[0].legs[0].duration.text
          setEta(duration)
        }
      })
    }
  }, [google, map, motoboy, pedido, directionsRenderer])

  if (loading) return <div className="tracking-page"><p>Carregando mapa...</p></div>

  return (
    <div className="tracking-page animate-fade">
      <div className="mobile-header">
        <div className="logo-text">Universal<span>Delivery</span></div>
        <div className="status-badge">{pedido?.status === 'em_rota' ? '● Em Rota' : '🕒 Aguardando'}</div>
      </div>

      <div className="tracking-map map-container" style={{ height: '50vh' }}>
         <div ref={mapRef} style={{ height: '100%', width: '100%' }}></div>
      </div>

      <div className="tracking-info" style={{ padding: '24px', background: 'var(--bg-primary)', borderRadius: '24px 24px 0 0', marginTop: '-24px', zIndex: 10, position: 'relative' }}>
        <div className="tracking-eta" style={{ textAlign: 'center', marginBottom: '24px' }}>
          <div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>PREVISÃO DE ENTREGA</div>
          <div style={{ fontSize: '38px', fontWeight: 900, color: 'var(--accent-primary)' }}>
            {pedido?.status === 'entregue' ? '✅' : (eta || `${pedido?.tempo_estimado_min || '15'} min`)}
          </div>
        </div>

        <div className="card" style={{ padding: '20px' }}>
          <div style={{ fontWeight: 700 }}>
            {pedido?.status === 'em_rota' ? '🚚 O entregador está vindo!' : '🍕 Seu pedido está sendo preparado'}
          </div>
        </div>
      </div>
    </div>
  )
}

export default Rastreio
