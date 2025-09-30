// services/DirectionsService.js
import Config from 'react-native-config';

const GOOGLE_MAPS_API_KEY = Config.GOOGLE_MAPS_API_KEY;

class DirectionsService {
  async getRouteDirections(origin, destination, mode = 'driving') {
    try {
      const originStr = `${origin.latitude},${origin.longitude}`;
      const destinationStr = `${destination.latitude},${destination.longitude}`;

      const url = `https://maps.googleapis.com/maps/api/directions/json?origin=${originStr}&destination=${destinationStr}&mode=${mode}&key=${GOOGLE_MAPS_API_KEY}`;

      const response = await fetch(url);
      const data = await response.json();

      if (data.status === 'OK') {
        return this.parseRouteData(data);
      } else {
        throw new Error(`Directions API error: ${data.status}`);
      }
    } catch (error) {
      console.error('Error fetching directions:', error);
      throw error;
    }
  }

  parseRouteData(data) {
    const route = data.routes[0];
    const leg = route.legs[0];

    // Decode polyline points
    const points = this.decodePolyline(route.overview_polyline.points);

    // Extract turn-by-turn instructions
    const steps = leg.steps.map(step => ({
      instruction: this.stripHTML(step.html_instructions),
      distance: step.distance.text,
      duration: step.duration.text,
      maneuver: step.maneuver || '',
      polyline: this.decodePolyline(step.polyline.points),
      startLocation: step.start_location,
      endLocation: step.end_location
    }));

    return {
      distance: leg.distance,
      duration: leg.duration,
      points,
      steps,
      bounds: this.calculateBounds(points)
    };
  }

  decodePolyline(encoded) {
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
    return html.replace(/<[^>]*>/g, '');
  }

  calculateBounds(points) {
    const lats = points.map(p => p.latitude);
    const lngs = points.map(p => p.longitude);

    return {
      minLat: Math.min(...lats),
      maxLat: Math.max(...lats),
      minLng: Math.min(...lngs),
      maxLng: Math.max(...lngs)
    };
  }
}

export default new DirectionsService();