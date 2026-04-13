import React, { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from './AuthContext'

const GeolocationContext = createContext({})

export const GeolocationProvider = ({ children }) => {
  const { profile } = useAuth()
  const [position, setPosition] = useState(null)
  const [error, setError] = useState(null)
  const [heading, setHeading] = useState(0)

  useEffect(() => {
    if (!profile || profile.role !== 'motoboy') return

    const channel = supabase.channel('universal_tracking')
    channel.subscribe()

    let lastBroadcast = 0
    let lastDbUpdate = 0
    const THROTTLE_BROADCAST = 1000  // 1 segundo
    const THROTTLE_DB = 15000        // 15 segundos

    const handleNewPosition = async (pos) => {
      const { latitude: lat, longitude: lng, heading: h } = pos.coords
      const now = Date.now()

      // CORRIGIDO: usar { lat, lng } consistentemente
      const newPos = { lat, lng }
      setPosition(newPos)
      setHeading(h || 0)

      // Broadcast realtime (alta frequência)
      if (now - lastBroadcast > THROTTLE_BROADCAST) {
        channel.send({
          type: 'broadcast',
          event: 'location',
          payload: { userId: profile.id, lat, lng, heading: h || 0 }
        })
        lastBroadcast = now
      }

      // Salvar no banco (baixa frequência)
      if (now - lastDbUpdate > THROTTLE_DB) {
        await supabase.from('usuarios').update({
          ultima_lat: lat,
          ultima_lng: lng,
          ultima_posicao_em: new Date().toISOString(),
          disponivel: true
        }).eq('id', profile.id)
        lastDbUpdate = now
      }
    }

    const handleError = (err) => {
      console.error('Erro GPS:', err)
      // Em desenvolvimento, simula posição (Foz do Iguaçu/PY como fallback)
      if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
        console.log('Dev: simulando posição GPS')
        handleNewPosition({
          coords: { latitude: -25.5135, longitude: -54.6174, heading: 90 }
        })
      } else {
        setError(err.message)
      }
    }

    const watchId = navigator.geolocation.watchPosition(
      handleNewPosition,
      handleError,
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    )

    return () => {
      navigator.geolocation.clearWatch(watchId)
      supabase.removeChannel(channel)
    }
  }, [profile])

  return (
    <GeolocationContext.Provider value={{ position, error, heading }}>
      {children}
    </GeolocationContext.Provider>
  )
}

export const useGeolocation = () => useContext(GeolocationContext)
