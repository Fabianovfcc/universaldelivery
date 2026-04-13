import { useGeolocation as useGeoContext } from '../contexts/GeolocationContext'

export const useGeolocation = (pedidoId = null) => {
  const { position, error } = useGeoContext()
  
  // O pedidoId pode ser usado no futuro para logar posições específicas no GeolocationProvider
  // Por enquanto, apenas retornamos a posição global
  
  return { position, error }
}
