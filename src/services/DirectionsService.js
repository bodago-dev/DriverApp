import Config from 'react-native-config';

const GOOGLE_MAPS_API_KEY = Config.GOOGLE_PLACES_API_KEY;

class DirectionsService {
  constructor() {
    this.baseUrl = 'https://maps.googleapis.com/maps/api/directions/json';
  }

  async getRouteDirections(origin, destination, mode = 'driving') {
    try {
      // Validate inputs
      if (!origin || !destination) {
        throw new Error('Origin and destination are required');
      }

      if (!origin.latitude || !origin.longitude || !destination.latitude || !destination.longitude) {
        throw new Error('Invalid coordinates provided');
      }

      const originStr = `${origin.latitude},${origin.longitude}`;
      const destinationStr = `${destination.latitude},${destination.longitude}`;

      const url = `${this.baseUrl}?origin=${originStr}&destination=${destinationStr}&mode=${mode}&key=${GOOGLE_MAPS_API_KEY}`;

      console.log('Fetching directions from:', url);

      const response = await fetch(url);

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();

      if (data.status === 'OK') {
        return this.parseRouteData(data);
      } else {
        throw new Error(`Directions API error: ${data.status} - ${data.error_message || 'No additional info'}`);
      }
    } catch (error) {
      console.error('Error fetching directions:', error);
      throw error;
    }
  }

  parseRouteData(data) {
    try {
      if (!data.routes || data.routes.length === 0) {
        throw new Error('No routes found in response');
      }

      const route = data.routes[0];
      const leg = route.legs[0];

      if (!leg) {
        throw new Error('No route legs found');
      }

      // Decode polyline points
      const points = this.decodePolyline(route.overview_polyline.points);

      // Extract turn-by-turn instructions
      const steps = leg.steps.map(step => ({
        instruction: this.stripHTML(step.html_instructions),
        distance: step.distance?.text || 'N/A',
        duration: step.duration?.text || 'N/A',
        maneuver: step.maneuver || '',
        polyline: this.decodePolyline(step.polyline.points),
        startLocation: {
          latitude: step.start_location?.lat || 0,
          longitude: step.start_location?.lng || 0
        },
        endLocation: {
          latitude: step.end_location?.lat || 0,
          longitude: step.end_location?.lng || 0
        }
      }));

      return {
        distance: leg.distance || { text: 'N/A', value: 0 },
        duration: leg.duration || { text: 'N/A', value: 0 },
        points,
        steps,
        bounds: this.calculateBounds(points),
        summary: route.summary || 'Route',
        warnings: route.warnings || []
      };
    } catch (error) {
      console.error('Error parsing route data:', error);
      throw error;
    }
  }

  decodePolyline(encoded) {
    if (!encoded) {
      return [];
    }

    const points = [];
    let index = 0, len = encoded.length;
    let lat = 0, lng = 0;

    while (index < len) {
      let b, shift = 0, result = 0;

      do {
        b = encoded.charCodeAt(index++) - 63;
        result |= (b & 0x1f) << shift;
        shift += 5;
      } while (b >= 0x20);

      const dlat = ((result & 1) ? ~(result >> 1) : (result >> 1));
      lat += dlat;

      shift = 0;
      result = 0;

      do {
        b = encoded.charCodeAt(index++) - 63;
        result |= (b & 0x1f) << shift;
        shift += 5;
      } while (b >= 0x20);

      const dlng = ((result & 1) ? ~(result >> 1) : (result >> 1));
      lng += dlng;

      points.push({
        latitude: lat / 1e5,
        longitude: lng / 1e5
      });
    }

    return points;
  }

  stripHTML(html) {
    if (!html) return '';
    return html.replace(/<[^>]*>/g, '');
  }

  calculateBounds(points) {
    if (!points || points.length === 0) {
      return {
        minLat: 0,
        maxLat: 0,
        minLng: 0,
        maxLng: 0
      };
    }

    const lats = points.map(p => p.latitude);
    const lngs = points.map(p => p.longitude);

    return {
      minLat: Math.min(...lats),
      maxLat: Math.max(...lats),
      minLng: Math.min(...lngs),
      maxLng: Math.max(...lngs)
    };
  }

  // Additional utility method to get distance between two points
  calculateDirectDistance(point1, point2) {
    const R = 6371; // Earth's radius in kilometers
    const dLat = this.toRadians(point2.latitude - point1.latitude);
    const dLon = this.toRadians(point2.longitude - point1.longitude);

    const a =
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(this.toRadians(point1.latitude)) *
      Math.cos(this.toRadians(point2.latitude)) *
      Math.sin(dLon/2) * Math.sin(dLon/2);

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  }

  toRadians(degrees) {
    return degrees * (Math.PI / 180);
  }

  // Method to get alternative routes
  async getAlternativeRoutes(origin, destination, mode = 'driving', alternatives = true) {
    try {
      const originStr = `${origin.latitude},${origin.longitude}`;
      const destinationStr = `${destination.latitude},${destination.longitude}`;

      const url = `${this.baseUrl}?origin=${originStr}&destination=${destinationStr}&mode=${mode}&alternatives=${alternatives}&key=${GOOGLE_MAPS_API_KEY}`;

      const response = await fetch(url);
      const data = await response.json();

      if (data.status === 'OK') {
        return data.routes.map(route => this.parseRouteData({
          ...data,
          routes: [route]
        }));
      } else {
        throw new Error(`Directions API error: ${data.status}`);
      }
    } catch (error) {
      console.error('Error fetching alternative routes:', error);
      throw error;
    }
  }

  // Method to get route with waypoints
  async getRouteWithWaypoints(origin, destination, waypoints = [], mode = 'driving') {
    try {
      const originStr = `${origin.latitude},${origin.longitude}`;
      const destinationStr = `${destination.latitude},${destination.longitude}`;
      const waypointsStr = waypoints.map(wp => `${wp.latitude},${wp.longitude}`).join('|');

      const url = `${this.baseUrl}?origin=${originStr}&destination=${destinationStr}&waypoints=${waypointsStr}&mode=${mode}&key=${GOOGLE_MAPS_API_KEY}`;

      const response = await fetch(url);
      const data = await response.json();

      if (data.status === 'OK') {
        return this.parseRouteData(data);
      } else {
        throw new Error(`Directions API error: ${data.status}`);
      }
    } catch (error) {
      console.error('Error fetching route with waypoints:', error);
      throw error;
    }
  }
}

// Create and export singleton instance
const directionsService = new DirectionsService();
export default directionsService;