import { googleMapsLoader } from '../lib/googleMaps';

/**
 * Corrige uma posição GPS para a rua mais próxima usando a Roads API
 * @param {number} lat 
 * @param {number} lng 
 * @returns {Promise<{lat: number, lng: number}>}
 */
export const snapToRoad = async (lat, lng) => {
  const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
  const url = `https://roads.googleapis.com/v1/snapToRoads?path=${lat},${lng}&interpolate=true&key=${apiKey}`;

  try {
    const response = await fetch(url);
    const data = await response.json();

    if (data.snappedPoints && data.snappedPoints.length > 0) {
      const snapped = data.snappedPoints[0].location;
      return { lat: snapped.latitude, lng: snapped.longitude };
    }
    return { lat, lng };
  } catch (err) {
    console.error('Erro na Roads API:', err);
    return { lat, lng };
  }
};

/**
 * Otimiza a sequência de entregas usando o Google Directions Service (Max 25 paradas)
 * @param {{lat: number, lng: number}} origin 
 * @param {Array<{lat: number, lng: number, id: string}>} destinations 
 * @returns {Promise<Array<string>>} - Lista de IDs na ordem otimizada
 */
export const optimizeDeliverySequence = async (origin, destinations) => {
  if (destinations.length <= 1) return destinations.map(d => d.id);

  const google = await googleMapsLoader.load();
  const directionsService = new google.maps.DirectionsService();

  const waypoints = destinations.map(d => ({
    location: new google.maps.LatLng(d.lat, d.lng),
    stopover: true
  }));

  return new Promise((resolve, reject) => {
    directionsService.route(
      {
        origin: new google.maps.LatLng(origin.lat, origin.lng),
        destination: new google.maps.LatLng(destinations[destinations.length - 1].lat, destinations[destinations.length - 1].lng),
        waypoints: waypoints.slice(0, -1),
        optimizeWaypoints: true,
        travelMode: google.maps.TravelMode.DRIVING
      },
      (result, status) => {
        if (status === google.maps.DirectionsStatus.OK) {
          const order = result.routes[0].waypoint_order;
          // waypoint_order dá o índice dos waypoints intermediários
          const optimizedIds = [];
          order.forEach(idx => optimizedIds.push(destinations[idx].id));
          // Adicionar o último ponto que foi usado como destination
          optimizedIds.push(destinations[destinations.length - 1].id);
          resolve(optimizedIds);
        } else {
          reject('Falha na otimização: ' + status);
        }
      }
    );
  });
};
