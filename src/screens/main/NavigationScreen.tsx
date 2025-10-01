import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  BackHandler,
  ActivityIndicator,
  Linking,
  Platform,
  ScrollView,
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import MapView, { Marker, Polyline, PROVIDER_GOOGLE, Region } from 'react-native-maps';
import firestoreService from '../../services/FirestoreService';
import Geolocation from 'react-native-geolocation-service';
import { PERMISSIONS, request, check, RESULTS } from 'react-native-permissions';
import locationService from '../../services/LocationService';
import Config from 'react-native-config';

const apiKey = Config.GOOGLE_PLACES_API_KEY;

// Directions Service
class DirectionsService {
  async getRouteDirections(origin, destination, mode = 'driving') {
    try {
      const originStr = `${origin.latitude},${origin.longitude}`;
      const destinationStr = `${destination.latitude},${destination.longitude}`;

      const url = `https://maps.googleapis.com/maps/api/directions/json?origin=${originStr}&destination=${destinationStr}&mode=${mode}&key=${apiKey}`;

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
      startLocation: {
        latitude: step.start_location.lat,
        longitude: step.start_location.lng
      },
      endLocation: {
        latitude: step.end_location.lat,
        longitude: step.end_location.lng
      }
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

const directionsService = new DirectionsService();

// Default coordinates for Dar es Salaam with reasonable zoom level
const DEFAULT_REGION = {
  latitude: -6.7924,
  longitude: 39.2083,
  latitudeDelta: 0.0922,
  longitudeDelta: 0.0421,
};

const NavigationScreen = ({ route, navigation }) => {
  const { deliveryId } = route.params;

  const [isLoading, setIsLoading] = useState(true);
  const [deliveryData, setDeliveryData] = useState<any>(null);
  const [driverLocation, setDriverLocation] = useState<{latitude: number, longitude: number} | null>(null);
  const [customerInfo, setCustomerInfo] = useState<any>(null);
  const [currentStep, setCurrentStep] = useState('accepted');
  const [eta, setEta] = useState('Calculating ETA...');
  const [routeCoordinates, setRouteCoordinates] = useState<{latitude: number, longitude: number}[]>([]);
  const [mapRegion, setMapRegion] = useState<Region>(DEFAULT_REGION);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [mapReady, setMapReady] = useState(false);
  const [lastStep, setLastStep] = useState('');
  const [shouldAnimateRegion, setShouldAnimateRegion] = useState(true);
  const [routeData, setRouteData] = useState<any>(null);
  const [currentInstructionIndex, setCurrentInstructionIndex] = useState(0);
  const [driverHeading, setDriverHeading] = useState(0);
  const [isFetchingRoute, setIsFetchingRoute] = useState(false);

  const unsubscribeDeliveryRef = useRef<() => void>();
  const watchId = useRef<number>();
  const mapRef = useRef<MapView>(null);

  // Helper function to extract coordinates from location object
  const getCoordinates = (location: any) => {
    if (!location) return null;

    // Handle Firestore GeoPoint
    if (typeof location.latitude === 'function') {
      return {
        latitude: location.latitude(),
        longitude: location.longitude()
      };
    }

    // Handle nested coordinates
    if (location.coordinates) {
      return location.coordinates;
    }

    // Handle direct coordinates
    if (location.latitude && location.longitude) {
      return {
        latitude: location.latitude,
        longitude: location.longitude
      };
    }

    return null;
  };

  const calculateZoomLevel = (region: Region) => {
    const angle = region.longitudeDelta;
    const zoom = Math.round(Math.log(360 / angle) / Math.LN2);
    return Math.min(zoom, 18);
  };

  const shouldAnimateForStepChange = (step: string) => {
    return (lastStep === 'arrived_pickup' && step === 'picked_up') ||
           (lastStep === 'arrived_dropoff' && step === 'delivered');
  };

  // Calculate the optimal map region to show both driver and destination
  const calculateMapRegion = useCallback((currentDriverLoc: {latitude: number, longitude: number} | null, currentDeliveryData: any): Region => {
    if (!currentDriverLoc || !currentDeliveryData) {
      return DEFAULT_REGION;
    }

    let destination;

    if (currentStep === 'accepted' || currentStep === 'arrived_pickup') {
      destination = getCoordinates(currentDeliveryData.pickupLocation);
    } else {
      destination = getCoordinates(currentDeliveryData.dropoffLocation);
    }

    if (!destination || !currentDriverLoc.latitude || !currentDriverLoc.longitude) {
      return DEFAULT_REGION;
    }

    // Combine all points to fit them on the map
    const allCoords = [currentDriverLoc, destination];

    let minLat = Infinity, maxLat = -Infinity;
    let minLon = Infinity, maxLon = -Infinity;

    allCoords.forEach(coord => {
      if (coord) {
        minLat = Math.min(minLat, coord.latitude);
        maxLat = Math.max(maxLat, coord.latitude);
        minLon = Math.min(minLon, coord.longitude);
        maxLon = Math.max(maxLon, coord.longitude);
      }
    });

    const midLat = (minLat + maxLat) / 2;
    const midLon = (minLon + maxLon) / 2;

    // Add some padding to the deltas to ensure both points are visible
    const latDelta = (maxLat - minLat) * 1.5;
    const lonDelta = (maxLon - minLon) * 1.5;

    // Ensure minimum deltas to prevent zooming too far in
    const minDelta = 0.01;
    return {
      latitude: midLat,
      longitude: midLon,
      latitudeDelta: Math.max(minDelta, latDelta),
      longitudeDelta: Math.max(minDelta, lonDelta),
    };
  }, [currentStep]);

  // Fetch route directions using Google Directions API
  const fetchRouteDirections = useCallback(async (startLocation: any, endLocation: any) => {
    if (!startLocation || !endLocation) return null;

    setIsFetchingRoute(true);
    try {
      const directions = await directionsService.getRouteDirections(startLocation, endLocation);
      setRouteData(directions);

      // Update route coordinates with actual road path
      setRouteCoordinates(directions.points);

      // Fit map to route bounds
      if (mapRef.current && directions.points.length > 0) {
        mapRef.current.fitToCoordinates(directions.points, {
          edgePadding: { top: 100, right: 100, bottom: 200, left: 100 },
          animated: true,
        });
      }

      return directions;
    } catch (error) {
      console.error('Error fetching directions:', error);
      // Fallback to straight line
      setRouteCoordinates([startLocation, endLocation]);
      return null;
    } finally {
      setIsFetchingRoute(false);
    }
  }, []);

  // Calculate remaining route based on current location
  const calculateRemainingRoute = (currentLocation: any, route: any) => {
    if (!route || !route.points) return route;

    // Find the closest point on the route to current location
    let closestIndex = 0;
    let minDistance = Infinity;

    route.points.forEach((point: any, index: number) => {
      const distance = locationService.calculateDistance(currentLocation, point);
      if (distance < minDistance) {
        minDistance = distance;
        closestIndex = index;
      }
    });

    // Return remaining points from current position
    return {
      ...route,
      points: route.points.slice(closestIndex),
      steps: route.steps.filter((step: any, index: number) => index >= closestIndex)
    };
  };

  // Enhanced ETA calculation with route data
  const updateETAWithRoute = (remainingRoute: any) => {
    if (remainingRoute && remainingRoute.duration) {
      setEta(`${remainingRoute.duration.text} (${remainingRoute.distance.text})`);
    }
  };

  // Update ETA calculation
  const updateETA = useCallback((currentDelivery: any, currentDriverLocation: {latitude: number, longitude: number} | null) => {
    if (!currentDriverLocation || !currentDelivery) {
      setEta('Calculating ETA...');
      return;
    }

    const destination = currentStep === 'accepted' || currentStep === 'arrived_pickup'
      ? getCoordinates(currentDelivery.pickupLocation)
      : getCoordinates(currentDelivery.dropoffLocation);

    if (destination) {
      const distance = locationService.calculateDistance(currentDriverLocation, destination);
      const averageSpeed = 30; // km/h
      const timeInMinutes = Math.round((distance / averageSpeed) * 60);
      setEta(`${timeInMinutes} min (${distance.toFixed(1)} km)`);
    } else {
      setEta('Destination not available');
    }
  }, [currentStep]);

  // Update current instruction based on driver location
  const updateCurrentInstruction = useCallback((currentLocation: any) => {
    if (!routeData || !routeData.steps || routeData.steps.length === 0) return;

    let closestStepIndex = 0;
    let minDistance = Infinity;

    routeData.steps.forEach((step: any, index: number) => {
      const distance = locationService.calculateDistance(currentLocation, step.startLocation);
      if (distance < minDistance) {
        minDistance = distance;
        closestStepIndex = index;
      }
    });

    setCurrentInstructionIndex(closestStepIndex);
  }, [routeData]);

  // Update map region when location or step changes
  useEffect(() => {
    if (driverLocation && deliveryData && mapReady) {
      const newRegion = calculateMapRegion(driverLocation, deliveryData);
      setMapRegion(newRegion);

      const shouldAnimate =
        lastStep === '' ||
        shouldAnimateRegion ||
        (currentStep !== lastStep && shouldAnimateForStepChange(currentStep));

      if (mapRef.current) {
        if (shouldAnimate) {
          mapRef.current.animateToRegion(newRegion, 500);
        } else {
          mapRef.current.setCamera({
            center: {
              latitude: newRegion.latitude,
              longitude: newRegion.longitude,
            },
            zoom: calculateZoomLevel(newRegion),
          }, { duration: 300 });
        }
      }
      setShouldAnimateRegion(false);
    }
  }, [driverLocation, currentStep, deliveryData, calculateMapRegion, mapReady, shouldAnimateRegion]);

  // Update route coordinates when location changes
  const updateRouteCoordinates = useCallback((currentLocation: {latitude: number, longitude: number}, currentDeliveryData: any) => {
    if (!currentDeliveryData) return;

    const destination = currentStep === 'accepted' || currentStep === 'arrived_pickup'
      ? getCoordinates(currentDeliveryData.pickupLocation)
      : getCoordinates(currentDeliveryData.dropoffLocation);

    if (destination) {
      // Use actual route data if available, otherwise fallback to straight line
      if (!routeData) {
        setRouteCoordinates([currentLocation, destination]);
      }
    } else {
      setRouteCoordinates([]);
    }
  }, [deliveryData, currentStep, routeData]);

  // Fetch delivery data and setup subscriptions
  useEffect(() => {
    if (!deliveryId) {
      Alert.alert('Error', 'Delivery ID is missing.');
      navigation.goBack();
      return;
    }

    const fetchAndSubscribeDelivery = async () => {
      setIsLoading(true);
      try {
        const initialDeliveryResult = await firestoreService.getDelivery(deliveryId);
        if (initialDeliveryResult.success && initialDeliveryResult.delivery) {
          const initialData = initialDeliveryResult.delivery;
          setDeliveryData(initialData);
          setCurrentStep(initialData.status || 'accepted');

          if (initialData.customerId) {
            const customerResult = await firestoreService.getUserProfile(initialData.customerId);
            if (customerResult.success) {
              setCustomerInfo(customerResult.userProfile);
            }
          }

          unsubscribeDeliveryRef.current = firestoreService.subscribeToDeliveryUpdates(
            deliveryId,
            (updatedDelivery) => {
              if (updatedDelivery) {
                setDeliveryData(updatedDelivery);
                setCurrentStep(updatedDelivery.status);
                updateETA(updatedDelivery, driverLocation);
              }
            }
          );

          await startLocationTracking(initialData.driverId);
          updateETA(initialData, driverLocation);
        } else {
          Alert.alert('Error', initialDeliveryResult.error || 'Failed to load delivery details.');
          navigation.goBack();
        }
      } catch (error) {
        console.error('Error fetching delivery:', error);
        Alert.alert('Error', 'An unexpected error occurred while loading delivery.');
        navigation.goBack();
      } finally {
        setIsLoading(false);
      }
    };

    fetchAndSubscribeDelivery();

    const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
      handleBackPress();
      return true;
    });

    return () => {
      if (unsubscribeDeliveryRef.current) {
        unsubscribeDeliveryRef.current();
      }
      if (watchId.current !== undefined) {
        Geolocation.clearWatch(watchId.current);
      }
      backHandler.remove();
    };
  }, [deliveryId, updateETA]);

  // Fetch route when step changes
  useEffect(() => {
    if (driverLocation && deliveryData) {
      const destination = currentStep === 'accepted' || currentStep === 'arrived_pickup'
        ? getCoordinates(deliveryData.pickupLocation)
        : getCoordinates(deliveryData.dropoffLocation);

      if (destination) {
        fetchRouteDirections(driverLocation, destination);
      }
    }
  }, [currentStep, driverLocation, deliveryData, fetchRouteDirections]);

  const handleBackPress = async () => {
    Alert.alert(
      'Cancel Delivery?',
      'Are you sure you want to cancel this delivery? This may affect your rating.',
      [
        { text: 'No, Continue', style: 'cancel' },
        {
          text: 'Yes, Cancel',
          style: 'destructive',
          onPress: async () => {
            const additionalData = deliveryData?.requestId ? { requestId: deliveryData.requestId } : {};
            await firestoreService.updateDeliveryStatus(deliveryId, 'cancelled', additionalData);
            navigation.goBack();
          },
        },
      ]
    );
  };

  const requestLocationPermission = async () => {
    try {
      const granted = await request(
        Platform.select({
          android: PERMISSIONS.ANDROID.ACCESS_FINE_LOCATION,
          ios: PERMISSIONS.IOS.LOCATION_WHEN_IN_USE,
        }),
      );
      return granted === 'granted';
    } catch (err) {
      console.warn('Location permission error:', err);
      return false;
    }
  };

  const startLocationTracking = async (driverId: string) => {
    try {
      const hasPermission = await requestLocationPermission();
      if (!hasPermission) {
        setLocationError('Location permission required');
        return false;
      }

      const position = await new Promise<Geolocation.GeoPosition>((resolve, reject) => {
        Geolocation.getCurrentPosition(
          resolve,
          (error) => {
            console.error('Initial position error:', error);
            reject(error);
          },
          { enableHighAccuracy: true, timeout: 15000, maximumAge: 10000 }
        );
      });

      const initialLocation = {
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
      };

      setDriverLocation(initialLocation);
      await firestoreService.updateDriverLocation(driverId, initialLocation);
      updateRouteCoordinates(initialLocation, deliveryData);
      setLocationError(null);

      watchId.current = Geolocation.watchPosition(
        (position) => {
          const newLocation = {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
          };

          // Update driver heading if available
          if (position.coords.heading !== null) {
            setDriverHeading(position.coords.heading);
          }

          setDriverLocation(newLocation);
          firestoreService.updateDriverLocation(driverId, newLocation);
          updateRouteCoordinates(newLocation, deliveryData);
          updateCurrentInstruction(newLocation);

          // Update ETA with actual route data
          if (routeData) {
            const remainingRoute = calculateRemainingRoute(newLocation, routeData);
            updateETAWithRoute(remainingRoute);
          } else {
            updateETA(deliveryData, newLocation);
          }
        },
        (error) => {
          console.error('Location tracking error:', error);
          setLocationError(error.message);
        },
        {
          enableHighAccuracy: true,
          distanceFilter: 10,
          interval: 5000,
          fastestInterval: 2000,
        }
      );

      return true;
    } catch (error) {
      console.error('Location error:', error);
      setLocationError('Could not get location');
      return false;
    }
  };

  const handleNextStep = async () => {
    if (locationError) {
      Alert.alert('Location Error', 'Please enable location services to proceed.');
      return;
    }

    setIsLoading(true);
    setLastStep(currentStep);
    setShouldAnimateRegion(true);

    let newStatus = '';
    let navigateToCompletion = false;

    switch (currentStep) {
      case 'accepted':
        newStatus = 'arrived_pickup';
        break;
      case 'arrived_pickup':
        newStatus = 'picked_up';
        break;
      case 'picked_up':
        newStatus = 'in_transit';
        break;
      case 'in_transit':
        newStatus = 'arrived_dropoff';
        break;
      case 'arrived_dropoff':
        newStatus = 'delivered';
        navigateToCompletion = true;
        break;
      default:
        break;
    }

    if (newStatus) {
      try {
        const additionalData = deliveryData?.requestId ? { requestId: deliveryData.requestId } : {};
        const result = await firestoreService.updateDeliveryStatus(deliveryId, newStatus, additionalData);

        if (!result.success) {
          Alert.alert('Error', result.error || 'Failed to update delivery status.');
        } else if (navigateToCompletion) {
          navigation.replace('DeliveryStatus', {
            deliveryId,
            request: {
              requestId: deliveryData.requestId,
              pickupAddress: deliveryData.pickupLocation?.address || 'N/A',
              dropoffAddress: deliveryData.dropoffLocation?.address || 'N/A',
              packageSize: deliveryData.packageDetails?.size || 'medium',
              distance: deliveryData.distance || route.params.request.distance || 'N/A',
              fare: deliveryData.fareDetails?.total || 0,
              paymentMethod: deliveryData.paymentMethod || 'M-Pesa (Paid)',
              phoneNumber: customerInfo?.phoneNumber || 'N/A',
            }
          });
        }
      } catch (error) {
        console.error('Error updating status:', error);
        Alert.alert('Error', 'Failed to update delivery status.');
      }
    }
    setIsLoading(false);
  };

  const getActionButtonText = () => {
    switch (currentStep) {
      case 'accepted': return 'Arrived at Pickup';
      case 'arrived_pickup': return 'Package Picked Up';
      case 'picked_up': return 'Start Delivery';
      case 'in_transit': return 'Arrived at Dropoff';
      case 'arrived_dropoff': return 'Complete Delivery';
      case 'delivered': return 'Delivery Completed';
      default: return 'Next Step';
    }
  };

  const getStepTitle = () => {
    switch (currentStep) {
      case 'accepted': return 'Navigating to Pickup';
      case 'arrived_pickup': return 'At Pickup Location';
      case 'picked_up': return 'En Route to Dropoff';
      case 'in_transit': return 'En Route to Dropoff';
      case 'arrived_dropoff': return 'At Dropoff Location';
      case 'delivered': return 'Delivery Complete';
      default: return 'Navigation';
    }
  };

  const getStepInstructions = () => {
    switch (currentStep) {
      case 'accepted': return 'Follow the route to the pickup location';
      case 'arrived_pickup': return 'Collect the package from the sender';
      case 'picked_up': return 'Proceed to the dropoff location';
      case 'in_transit': return 'Continue to the dropoff location';
      case 'arrived_dropoff': return 'Deliver the package to the recipient';
      case 'delivered': return 'Delivery successfully completed';
      default: return '';
    }
  };

  const formatPrice = (price: number) => {
    return `TZS ${price.toLocaleString()}`;
  };

  const handleCallCustomer = () => {
    if (customerInfo?.phoneNumber) {
      Linking.openURL(`tel:${customerInfo.phoneNumber}`);
    } else {
      Alert.alert('Error', 'Customer phone number not available.');
    }
  };

  const handleMessageCustomer = () => {
    if (customerInfo?.phoneNumber) {
      Linking.openURL(`sms:${customerInfo.phoneNumber}`);
    } else {
      Alert.alert('Error', 'Customer phone number not available.');
    }
  };

  const handleOpenExternalNavigation = () => {
    if (!deliveryData) return;

    const destination = currentStep === 'accepted' || currentStep === 'arrived_pickup'
      ? getCoordinates(deliveryData.pickupLocation)
      : getCoordinates(deliveryData.dropoffLocation);

    if (destination) {
      const label = currentStep === 'accepted' || currentStep === 'arrived_pickup'
        ? 'Pickup Location'
        : 'Dropoff Location';
      locationService.openExternalNavigation(destination, label);
    }
  };

  // Turn-by-turn instructions component
  const TurnByTurnInstructions = () => {
    if (!routeData || !routeData.steps || routeData.steps.length === 0 || currentInstructionIndex >= routeData.steps.length) {
      return null;
    }

    const currentStep = routeData.steps[currentInstructionIndex];

    return (
      <View style={styles.instructionsContainer}>
        <Text style={styles.instructionsTitle}>Next Instruction</Text>
        <Text style={styles.instructionText}>
          {currentStep?.instruction || 'Follow the route'}
        </Text>
        <Text style={styles.instructionDetail}>
          {currentStep?.distance} • {currentStep?.duration}
        </Text>
      </View>
    );
  };

  if (isLoading || !deliveryData) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#0066cc" />
        <Text style={styles.loadingText}>Loading delivery details...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Map View - Updated to match TrackingScreen.tsx */}
      <MapView
        ref={mapRef}
        provider={PROVIDER_GOOGLE}
        style={styles.map}
        region={mapRegion}
        onRegionChangeComplete={setMapRegion}
        mapType="standard"
        userInterfaceStyle="light"
        showsUserLocation={true}
        showsMyLocationButton={true}
        showsCompass={true}
        toolbarEnabled={true}
        onMapReady={() => setMapReady(true)}
        onLayout={() => setMapReady(true)}
      >
        {/* Pickup Marker */}
        {deliveryData.pickupLocation?.coordinates && (
          <Marker
            coordinate={getCoordinates(deliveryData.pickupLocation)}
            title="Pickup"
            description={deliveryData.pickupLocation.address}
          >
            <View style={[
              styles.markerContainer,
              { backgroundColor: (currentStep === 'accepted' || currentStep === 'arrived_pickup') ? '#0066cc' : '#ccc' }
            ]}>
              <Ionicons name="locate" size={16} color="#fff" />
            </View>
          </Marker>
        )}

        {/* Dropoff Marker */}
        {deliveryData.dropoffLocation?.coordinates && (
          <Marker
            coordinate={getCoordinates(deliveryData.dropoffLocation)}
            title="Dropoff"
            description={deliveryData.dropoffLocation.address}
          >
            <View style={[
              styles.markerContainer,
              { backgroundColor: (currentStep === 'in_transit' || currentStep === 'arrived_dropoff') ? '#ff6b6b' : '#ccc' }
            ]}>
              <Ionicons name="location" size={16} color="#fff" />
            </View>
          </Marker>
        )}

        {/* Driver Marker with rotation */}
        {driverLocation && (
          <Marker
            coordinate={driverLocation}
            rotation={driverHeading || 0}
            anchor={{ x: 0.5, y: 0.5 }}
            title="You"
            description="Your current location"
          >
            <View style={styles.driverMarker}>
              <Ionicons
                name="car"
                size={20}
                color="#fff"
                style={{
                  transform: [{ rotate: `${driverHeading}deg` }]
                }}
              />
            </View>
          </Marker>
        )}

        {/* Actual Route Polyline */}
        {routeCoordinates.length > 0 && (
          <Polyline
            coordinates={routeCoordinates}
            strokeWidth={4}
            strokeColor="#0066cc"
            lineDashPattern={[1, 0]}
          />
        )}

        {/* Fallback straight line if no route available */}
        {routeCoordinates.length === 0 && driverLocation && deliveryData.dropoffLocation?.coordinates && (
          <Polyline
            coordinates={[driverLocation, getCoordinates(deliveryData.dropoffLocation)]}
            strokeWidth={3}
            strokeColor="#0066cc"
            lineDashPattern={[2]}
          />
        )}
      </MapView>

      {/* Navigation Panel */}
      <View style={styles.navigationPanel}>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.navigationHeader}>
            <Text style={styles.navigationTitle}>{getStepTitle()}</Text>
            <View style={styles.etaContainer}>
              <Ionicons name="time-outline" size={16} color="#0066cc" />
              <Text style={styles.etaText}>{eta}</Text>
              {isFetchingRoute && (
                <ActivityIndicator size="small" color="#0066cc" style={styles.routeLoadingIndicator} />
              )}
            </View>
          </View>

          <Text style={styles.navigationInstructions}>{getStepInstructions()}</Text>

          {/* Turn-by-turn Instructions */}
          <TurnByTurnInstructions />

          {/* Navigation Controls */}
          <View style={styles.navigationControls}>
            <TouchableOpacity
              style={styles.navControlButton}
              onPress={handleOpenExternalNavigation}
            >
              <Ionicons name="navigate" size={20} color="#0066cc" />
              <Text style={styles.navControlText}>Open in Maps</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.navControlButton}
              onPress={() => {
                // Re-center map on driver
                if (mapRef.current && driverLocation) {
                  mapRef.current.animateToRegion({
                    ...mapRegion,
                    ...driverLocation
                  }, 500);
                }
              }}
            >
              <Ionicons name="locate" size={20} color="#0066cc" />
              <Text style={styles.navControlText}>My Location</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.addressContainer}>
            <View style={styles.addressCard}>
              {(currentStep === 'accepted' || currentStep === 'arrived_pickup') ? (
                <>
                  <Text style={styles.addressLabel}>Pickup Location</Text>
                  <Text style={styles.addressText}>{deliveryData.pickupLocation?.address || 'N/A'}</Text>
                </>
              ) : (
                <>
                  <Text style={styles.addressLabel}>Dropoff Location</Text>
                  <Text style={styles.addressText}>{deliveryData.dropoffLocation?.address || 'N/A'}</Text>
                </>
              )}
            </View>
          </View>

          <View style={styles.deliveryInfo}>
            <View style={styles.deliveryInfoItem}>
              <Text style={styles.deliveryInfoLabel}>Order ID</Text>
              <Text style={styles.deliveryInfoValue}>{deliveryId}</Text>
            </View>
            <View style={styles.deliveryInfoItem}>
              <Text style={styles.deliveryInfoLabel}>Package</Text>
              <Text style={styles.deliveryInfoValue}>
                {deliveryData.packageDetails?.size === 'small' ? 'Small' :
                 deliveryData.packageDetails?.size === 'medium' ? 'Medium' : 'Large'}
              </Text>
            </View>
            <View style={styles.deliveryInfoItem}>
              <Text style={styles.deliveryInfoLabel}>Fare</Text>
              <Text style={styles.deliveryInfoValue}>{formatPrice(deliveryData.fareDetails?.total || 0)}</Text>
            </View>
          </View>

          <View style={styles.contactContainer}>
            <TouchableOpacity style={styles.contactButton} onPress={handleCallCustomer}>
              <Ionicons name="call" size={20} color="#0066cc" />
              <Text style={styles.contactButtonText}>Call Customer</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.contactButton} onPress={handleMessageCustomer}>
              <Ionicons name="chatbubble" size={20} color="#0066cc" />
              <Text style={styles.contactButtonText}>Message</Text>
            </TouchableOpacity>
          </View>

          {/* Cancel Button */}
          <TouchableOpacity
            style={[styles.cancelButton, isLoading && styles.cancelButtonDisabled]}
            onPress={handleBackPress}
            disabled={isLoading}
          >
            <Text style={styles.cancelButtonText}>Cancel Delivery</Text>
          </TouchableOpacity>
        </ScrollView>

        {/* Fixed Action Button */}
        <TouchableOpacity
          style={[styles.actionButton, isLoading && styles.actionButtonDisabled]}
          onPress={handleNextStep}
          disabled={isLoading || currentStep === 'delivered'}
        >
          <Text style={styles.actionButtonText}>
            {isLoading ? 'Processing...' : getActionButtonText()}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  loadingText: {
    marginTop: 15,
    fontSize: 16,
    color: '#666',
  },
  map: {
    height: '60%',
  },
  markerContainer: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 2,
  },
  driverMarker: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#0066cc',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
    elevation: 5,
  },
  navigationPanel: {
    flex: 1,
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    marginTop: -20,
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 80,
  },
  scrollContent: {
    paddingBottom: 15,
  },
  navigationHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 5,
  },
  navigationTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  etaContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#e6f2ff',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 15,
  },
  etaText: {
    fontSize: 14,
    color: '#0066cc',
    fontWeight: '500',
    marginLeft: 5,
  },
  routeLoadingIndicator: {
    marginLeft: 5,
  },
  navigationInstructions: {
    fontSize: 14,
    color: '#666',
    marginBottom: 15,
  },
  instructionsContainer: {
    backgroundColor: '#e6f2ff',
    borderRadius: 8,
    padding: 12,
    marginBottom: 15,
    borderLeftWidth: 4,
    borderLeftColor: '#0066cc',
  },
  instructionsTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: '#0066cc',
    marginBottom: 4,
  },
  instructionText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333',
    marginBottom: 2,
  },
  instructionDetail: {
    fontSize: 12,
    color: '#666',
  },
  navigationControls: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 15,
  },
  navControlButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
    paddingHorizontal: 15,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ddd',
  },
  navControlText: {
    color: '#0066cc',
    fontSize: 14,
    fontWeight: '500',
    marginLeft: 8,
  },
  addressContainer: {
    marginBottom: 15,
  },
  addressCard: {
    backgroundColor: '#f9f9f9',
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: '#eee',
  },
  addressLabel: {
    fontSize: 12,
    color: '#666',
    marginBottom: 4,
  },
  addressText: {
    fontSize: 14,
    color: '#333',
    fontWeight: '500',
  },
  deliveryInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  deliveryInfoItem: {
    alignItems: 'center',
  },
  deliveryInfoLabel: {
    fontSize: 12,
    color: '#666',
    marginBottom: 4,
  },
  deliveryInfoValue: {
    fontSize: 14,
    color: '#333',
    fontWeight: '500',
  },
  contactContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 15,
  },
  contactButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#e6f2ff',
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 15,
    flex: 1,
    marginHorizontal: 5,
  },
  contactButtonText: {
    color: '#0066cc',
    fontSize: 14,
    fontWeight: '500',
    marginLeft: 8,
  },
  cancelButton: {
    backgroundColor: '#ffebee',
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 10,
    marginBottom: 15,
    borderWidth: 1,
    borderColor: '#ff6b6b',
  },
  cancelButtonDisabled: {
    backgroundColor: '#f5f5f5',
    borderColor: '#ccc',
  },
  cancelButtonText: {
    color: '#ff6b6b',
    fontSize: 16,
    fontWeight: '600',
  },
  actionButton: {
    position: 'absolute',
    bottom: 20,
    left: 20,
    right: 20,
    backgroundColor: '#0066cc',
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: 'center',
  },
  actionButtonDisabled: {
    backgroundColor: '#99ccff',
  },
  actionButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default NavigationScreen;