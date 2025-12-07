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
import directionsService from '../../services/DirectionsService';
import Config from 'react-native-config';

const apiKey = Config.GOOGLE_PLACES_API_KEY;

// Default coordinates for Dar es Salaam with reasonable zoom level
const DEFAULT_REGION = {
  latitude: -6.7924,
  longitude: 39.2083,
  latitudeDelta: 0.0922,
  longitudeDelta: 0.0421,
};

const NavigationScreen = ({ route, navigation }) => {
  const { deliveryId, request: deliveryRequest } = route.params;

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
  const [routeData, setRouteData] = useState<any>(null);
  const [currentInstructionIndex, setCurrentInstructionIndex] = useState(0);
  const [driverHeading, setDriverHeading] = useState(0);
  const [isFetchingRoute, setIsFetchingRoute] = useState(false);
  const [isMapAnimating, setIsMapAnimating] = useState(false);

  const unsubscribeDeliveryRef = useRef<(() => void) | null>(null);
  const watchId = useRef<number | null>(null);
  const mapRef = useRef<MapView>(null);
  const lastRouteFetchRef = useRef<number>(0);
  const routeFetchCooldownRef = useRef<number>(30000); // 30 seconds cooldown
  const isMountedRef = useRef<boolean>(true);
  const locationUpdateTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const routeFetchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Initialize and cleanup
  useEffect(() => {
    isMountedRef.current = true;
    console.log('📍 NavigationScreen mounted with deliveryId:', deliveryId);

    return () => {
      console.log('📍 NavigationScreen unmounting');
      isMountedRef.current = false;

      // Cleanup all subscriptions and watchers
      if (unsubscribeDeliveryRef.current) {
        unsubscribeDeliveryRef.current();
        unsubscribeDeliveryRef.current = null;
      }

      if (watchId.current !== null) {
        Geolocation.clearWatch(watchId.current);
        watchId.current = null;
      }

      // Clear timeouts
      if (locationUpdateTimeoutRef.current) {
        clearTimeout(locationUpdateTimeoutRef.current);
      }
      if (routeFetchTimeoutRef.current) {
        clearTimeout(routeFetchTimeoutRef.current);
      }

      // Clear any timeouts or intervals
      setRouteCoordinates([]);
      setDriverLocation(null);
    };
  }, [deliveryId]);

  // Improved coordinate extraction function
  const getCoordinates = useCallback((location: any) => {
    if (!location) return null;

    try {
      // Handle Firestore GeoPoint (has latitude/longitude functions)
      if (location && typeof location.latitude === 'function' && typeof location.longitude === 'function') {
        return {
          latitude: location.latitude(),
          longitude: location.longitude()
        };
      }

      // Handle nested coordinates
      if (location.coordinates && location.coordinates.latitude && location.coordinates.longitude) {
        return {
          latitude: location.coordinates.latitude,
          longitude: location.coordinates.longitude
        };
      }

      // Handle direct coordinates
      if (location.latitude !== undefined && location.longitude !== undefined) {
        return {
          latitude: location.latitude,
          longitude: location.longitude
        };
      }

      return null;
    } catch (error) {
      console.error('Error extracting coordinates:', error, location);
      return null;
    }
  }, []);

  // Get pickup and dropoff coordinates with validation
  const pickupCoords = useMemo(() => {
    return getCoordinates(deliveryData?.pickupLocation);
  }, [deliveryData, getCoordinates]);

  const dropoffCoords = useMemo(() => {
    return getCoordinates(deliveryData?.dropoffLocation);
  }, [deliveryData, getCoordinates]);

  // Calculate the optimal map region
  const calculateMapRegion = useCallback((currentDriverLoc: {latitude: number, longitude: number} | null): Region => {
    if (!currentDriverLoc) {
      return DEFAULT_REGION;
    }

    let destination;
    if (currentStep === 'accepted' || currentStep === 'arrived_pickup') {
      destination = pickupCoords;
    } else {
      destination = dropoffCoords;
    }

    if (!destination) {
      return {
        ...currentDriverLoc,
        latitudeDelta: 0.05,
        longitudeDelta: 0.05,
      };
    }

    // Combine all points to fit them on the map
    const allCoords = [currentDriverLoc, destination].filter(coord => coord !== null);

    if (allCoords.length === 0) {
      return DEFAULT_REGION;
    }

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

    // Add padding to the deltas
    const latDelta = (maxLat - minLat) * 1.8;
    const lonDelta = (maxLon - minLon) * 1.8;

    // Ensure minimum deltas
    const minDelta = 0.02;
    return {
      latitude: midLat,
      longitude: midLon,
      latitudeDelta: Math.max(minDelta, latDelta),
      longitudeDelta: Math.max(minDelta, lonDelta),
    };
  }, [currentStep, pickupCoords, dropoffCoords]);

  // Improved fetch route directions with better cooldown and error handling
  const fetchRouteDirections = useCallback(async (startLocation: any, endLocation: any, forceRefresh: boolean = false) => {
    if (!startLocation || !endLocation || !isMountedRef.current) {
      return null;
    }

    const now = Date.now();
    if (!forceRefresh && now - lastRouteFetchRef.current < routeFetchCooldownRef.current) {
      console.log('🔄 Route fetch skipped - in cooldown period');
      return null;
    }

    // Cancel pending route fetch
    if (routeFetchTimeoutRef.current) {
      clearTimeout(routeFetchTimeoutRef.current);
    }

    setIsFetchingRoute(true);
    try {
      console.log('🔄 Fetching route directions...');
      const directions = await directionsService.getRouteDirections(startLocation, endLocation);

      if (directions && directions.points && directions.points.length > 0 && isMountedRef.current) {
        setRouteData(directions);
        setRouteCoordinates(directions.points);
        lastRouteFetchRef.current = now;

        // Fit map to route with delay to ensure map is ready
        setTimeout(() => {
          if (mapRef.current && isMountedRef.current) {
            mapRef.current.fitToCoordinates(directions.points, {
              edgePadding: { top: 100, right: 100, bottom: 200, left: 100 },
              animated: true,
            });
          }
        }, 500);

        return directions;
      } else if (isMountedRef.current) {
        console.log('⚠️ No route points found, using fallback');
        // Fallback to straight line
        setRouteCoordinates([startLocation, endLocation]);
        return null;
      }
    } catch (error) {
      console.error('❌ Error fetching directions:', error);
      // Fallback to straight line only if component is still mounted
      if (isMountedRef.current) {
        setRouteCoordinates([startLocation, endLocation]);
      }
      return null;
    } finally {
      if (isMountedRef.current) {
        setIsFetchingRoute(false);
      }
    }
  }, []);

  // Update ETA
  const updateETA = useCallback((currentDriverLocation: {latitude: number, longitude: number} | null) => {
    if (!currentDriverLocation || !isMountedRef.current) {
      setEta('Calculating ETA...');
      return;
    }

    const destination = currentStep === 'accepted' || currentStep === 'arrived_pickup'
      ? pickupCoords
      : dropoffCoords;

    if (destination && isMountedRef.current) {
      const etaResult = locationService.calculateETA(currentDriverLocation, destination);
      setEta(`${etaResult.formattedTime} (${etaResult.distance.toFixed(1)} km)`);
    } else if (isMountedRef.current) {
      setEta('Destination not available');
    }
  }, [currentStep, pickupCoords, dropoffCoords]);

  // Request location permission
  const requestLocationPermission = async () => {
    try {
      const permission = Platform.select({
        android: PERMISSIONS.ANDROID.ACCESS_FINE_LOCATION,
        ios: PERMISSIONS.IOS.LOCATION_WHEN_IN_USE,
      });

      if (!permission) {
        console.log('No permission defined for this platform');
        return false;
      }

      const result = await request(permission);
      return result === RESULTS.GRANTED;
    } catch (err) {
      console.warn('Location permission error:', err);
      return false;
    }
  };

  // Improved location tracking with better cleanup
  const startLocationTracking = async (driverId: string) => {
    if (!isMountedRef.current) return false;

    try {
      const hasPermission = await requestLocationPermission();
      if (!hasPermission) {
        setLocationError('Location permission required');
        return false;
      }

      const position = await new Promise<Geolocation.GeoPosition>((resolve, reject) => {
        Geolocation.getCurrentPosition(
          resolve,
          reject,
          { enableHighAccuracy: true, timeout: 15000, maximumAge: 10000 }
        );
      });

      if (!isMountedRef.current) return false;

      const initialLocation = {
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
      };

      setDriverLocation(initialLocation);
      await firestoreService.updateDriverLocation(driverId, initialLocation);
      setLocationError(null);

      // Set initial map region
      const initialRegion = calculateMapRegion(initialLocation);
      setMapRegion(initialRegion);

      // Start watching position with mount checks
      watchId.current = Geolocation.watchPosition(
        (position) => {
          if (!isMountedRef.current) return;

          const newLocation = {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
          };

          if (position.coords.heading !== null && isMountedRef.current) {
            setDriverHeading(position.coords.heading);
          }

          // Clear previous timeout
          if (locationUpdateTimeoutRef.current) {
            clearTimeout(locationUpdateTimeoutRef.current);
          }

          // Debounced location update
          locationUpdateTimeoutRef.current = setTimeout(() => {
            if (!isMountedRef.current) return;

            setDriverLocation(newLocation);
            firestoreService.updateDriverLocation(driverId, newLocation);
            updateETA(newLocation);

            // Update map region for significant location changes
            if (mapRef.current && mapReady && !isMapAnimating) {
              const newRegion = calculateMapRegion(newLocation);
              setMapRegion(newRegion);
            }
          }, 2000);
        },
        (error) => {
          if (!isMountedRef.current) return;
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
      if (!isMountedRef.current) return false;
      console.error('Location error:', error);
      setLocationError('Could not get location');
      return false;
    }
  };

  // Debug effect - throttled to avoid excessive logging
  useEffect(() => {
    const debugTimeout = setTimeout(() => {
      if (isMountedRef.current) {
        console.log('🔍 COORDINATE DEBUG:');
        console.log('🔍 Pickup Coordinates:', pickupCoords);
        console.log('🔍 Dropoff Coordinates:', dropoffCoords);
        console.log('🔍 Driver Location:', driverLocation);
        console.log('🔍 Route Coordinates count:', routeCoordinates.length);
        console.log('🔍 Map Ready:', mapReady);
        console.log('🔍 Current Step:', currentStep);
      }
    }, 1000);

    return () => clearTimeout(debugTimeout);
  }, [pickupCoords, dropoffCoords, driverLocation, routeCoordinates, mapReady, currentStep]);

  // Back handler
  useEffect(() => {
    const handleBackPress = () => {
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
      return true;
    };

    const backHandler = BackHandler.addEventListener('hardwareBackPress', handleBackPress);

    return () => {
      backHandler.remove();
    };
  }, [deliveryId, deliveryData, navigation]);

  // Main data fetching
  useEffect(() => {
    if (!deliveryId) {
      Alert.alert('Error', 'Delivery ID is missing.');
      navigation.goBack();
      return;
    }

    const initializeDelivery = async () => {
      if (!isMountedRef.current) return;

      setIsLoading(true);
      try {
        const initialDeliveryResult = await firestoreService.getDelivery(deliveryId);

        if (!isMountedRef.current) return;

        if (initialDeliveryResult.success && initialDeliveryResult.delivery) {
          const initialData = initialDeliveryResult.delivery;
          setDeliveryData(initialData);
          setCurrentStep(initialData.status || 'accepted');

          // Fetch customer info if needed
          if (initialData.customerId) {
            const customerResult = await firestoreService.getUserProfile(initialData.customerId);
            if (customerResult.success && isMountedRef.current) {
              setCustomerInfo(customerResult.userProfile);
            }
          }

          // Setup delivery updates subscription
          unsubscribeDeliveryRef.current = firestoreService.subscribeToDeliveryUpdates(
            deliveryId,
            (updatedDelivery) => {
              if (updatedDelivery && isMountedRef.current) {
                setDeliveryData(updatedDelivery);
                setCurrentStep(updatedDelivery.status);
                updateETA(driverLocation);
              }
            }
          );

          // Start location tracking
          await startLocationTracking(initialData.driverId);
          updateETA(driverLocation);
        } else {
          Alert.alert('Error', initialDeliveryResult.error || 'Failed to load delivery details.');
          navigation.goBack();
        }
      } catch (error) {
        console.error('Error fetching delivery:', error);
        if (isMountedRef.current) {
          Alert.alert('Error', 'An unexpected error occurred while loading delivery.');
          navigation.goBack();
        }
      } finally {
        if (isMountedRef.current) {
          setIsLoading(false);
        }
      }
    };

    initializeDelivery();
  }, [deliveryId]);

  // Improved route fetching with proper dependencies and conditions
  useEffect(() => {
    if (!driverLocation || !(pickupCoords || dropoffCoords) || !isMountedRef.current) {
      return;
    }

    const destination = currentStep === 'accepted' || currentStep === 'arrived_pickup'
      ? pickupCoords
      : dropoffCoords;

    if (destination) {
      // Debounce route fetching to prevent multiple rapid calls
      if (routeFetchTimeoutRef.current) {
        clearTimeout(routeFetchTimeoutRef.current);
      }

      routeFetchTimeoutRef.current = setTimeout(() => {
        if (isMountedRef.current) {
          fetchRouteDirections(driverLocation, destination, true);
        }
      }, 1000);
    }

    return () => {
      if (routeFetchTimeoutRef.current) {
        clearTimeout(routeFetchTimeoutRef.current);
      }
    };
  }, [currentStep, driverLocation, pickupCoords, dropoffCoords, fetchRouteDirections]);

  // Update map region when location or step changes
  useEffect(() => {
    if (driverLocation && mapReady && !isMapAnimating && isMountedRef.current) {
      const newRegion = calculateMapRegion(driverLocation);

      // Only update if region has significantly changed
      const regionChangedSignificantly =
        Math.abs(mapRegion.latitude - newRegion.latitude) > 0.001 ||
        Math.abs(mapRegion.longitude - newRegion.longitude) > 0.001;

      if (regionChangedSignificantly) {
        setIsMapAnimating(true);
        setMapRegion(newRegion);

        if (mapRef.current) {
          mapRef.current.animateToRegion(newRegion, 1000);
        }

        setTimeout(() => {
          if (isMountedRef.current) {
            setIsMapAnimating(false);
          }
        }, 1000);
      }
    }
  }, [driverLocation, currentStep, mapReady, isMapAnimating, calculateMapRegion, mapRegion]);

  const handleNextStep = async () => {
    if (locationError) {
      Alert.alert('Location Error', 'Please enable location services to proceed.');
      return;
    }

    if (!isMountedRef.current) return;

    setIsLoading(true);

    let newStatus = '';
    let navigateToCompletion = false;

    switch (currentStep) {
      case 'accepted':
        newStatus = 'arrived_pickup';
        break;
      case 'arrived_pickup':
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
        } else if (navigateToCompletion && isMountedRef.current) {
          navigation.replace('DeliveryStatus', {
            deliveryId,
            request: {
              requestId: deliveryData.requestId,
              pickupAddress: deliveryData.pickupLocation?.address || deliveryRequest?.pickupAddress || 'N/A',
              dropoffAddress: deliveryData.dropoffLocation?.address || deliveryRequest?.dropoffAddress || 'N/A',
              packageSize: deliveryData.packageDetails?.size || deliveryRequest?.packageSize || 'medium',
              distance: deliveryData.distance || deliveryRequest?.distance || 'N/A',
              fare: deliveryData.fareDetails?.total || deliveryRequest?.fare || 0,
              paymentMethod: deliveryData.paymentMethod || deliveryRequest?.paymentMethod || 'M-Pesa (Paid)',
              phoneNumber: customerInfo?.phoneNumber || 'N/A',
            }
          });
        }
      } catch (error) {
        console.error('Error updating status:', error);
        Alert.alert('Error', 'Failed to update delivery status.');
      }
    }

    if (isMountedRef.current) {
      setIsLoading(false);
    }
  };

  const getActionButtonText = () => {
    switch (currentStep) {
      case 'accepted': return 'Arrived at Pickup';
      case 'arrived_pickup': return 'Start Delivery';
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
    const destination = currentStep === 'accepted' || currentStep === 'arrived_pickup'
      ? pickupCoords
      : dropoffCoords;

    if (destination) {
      const label = currentStep === 'accepted' || currentStep === 'arrived_pickup'
        ? 'Pickup Location'
        : 'Dropoff Location';
      locationService.openExternalNavigation(destination, label);
    } else {
      Alert.alert('Error', 'Destination coordinates not available.');
    }
  };

  // Turn-by-turn instructions component
  const TurnByTurnInstructions = () => {
    if (!routeData || !routeData.steps || routeData.steps.length === 0) {
      return null;
    }

    const currentStep = routeData.steps[Math.min(currentInstructionIndex, routeData.steps.length - 1)];

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
      {/* Map View */}
      <MapView
        ref={mapRef}
        provider={PROVIDER_GOOGLE}
        style={styles.map}
        initialRegion={DEFAULT_REGION}
        showsUserLocation={true}
        showsMyLocationButton={true}
        showsCompass={true}
        onMapReady={() => {
          console.log('🗺️ Map fully ready');
          setMapReady(true);

          // Fit to coordinates after a brief delay to ensure map is fully rendered
          setTimeout(() => {
            if (driverLocation && (pickupCoords || dropoffCoords)) {
              const coordinatesToFit = [driverLocation];
              if (pickupCoords) coordinatesToFit.push(pickupCoords);
              if (dropoffCoords) coordinatesToFit.push(dropoffCoords);

              if (coordinatesToFit.length > 1) {
                console.log('🗺️ Fitting to coordinates:', coordinatesToFit);
                mapRef.current?.fitToCoordinates(coordinatesToFit, {
                  edgePadding: { top: 100, right: 100, bottom: 200, left: 100 },
                  animated: true,
                });
              }
            }
          }, 500);
        }}
        onLayout={() => {
          console.log('🖼️ Map layout completed');
          // Force a re-render of markers by updating state
          setMapReady(prev => {
            if (!prev) return true;
            return prev;
          });
        }}
      >
        {/* Always render markers - don't conditionally render based on mapReady */}
        {pickupCoords && (
          <Marker
            coordinate={pickupCoords}
            title="Pickup Location"
            description={deliveryData?.pickupLocation?.address || 'Pickup'}
          >
            <View style={styles.markerContainer}>
              <Ionicons name="locate" size={20} color="#FFFFFF" />
            </View>
          </Marker>
        )}

        {dropoffCoords && (
          <Marker
            coordinate={dropoffCoords}
            title="Dropoff Location"
            description={deliveryData?.dropoffLocation?.address || 'Dropoff'}
          >
            <View style={[styles.markerContainer, { backgroundColor: '#ff6b6b' }]}>
              <Ionicons name="location" size={20} color="#FFFFFF" />
            </View>
          </Marker>
        )}

        {driverLocation && (
          <Marker
            coordinate={driverLocation}
            title="Your Location"
          >
            <View style={styles.driverMarker}>
              <Ionicons name="navigate" size={16} color="#FFFFFF" />
            </View>
          </Marker>
        )}

        {/* Render polyline if we have valid coordinates */}
        {routeCoordinates.length > 1 && (
          <Polyline
            coordinates={routeCoordinates}
            strokeWidth={4}
            strokeColor="#0066cc"
          />
        )}

        {/* Fallback straight line if no route but have pickup/dropoff */}
        {!routeCoordinates.length && pickupCoords && dropoffCoords && (
          <Polyline
            coordinates={[pickupCoords, dropoffCoords]}
            strokeWidth={3}
            strokeColor="#999"
            strokeDasharray={[5, 5]}
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
                if (mapRef.current && driverLocation) {
                  mapRef.current.animateToRegion({
                    ...driverLocation,
                    latitudeDelta: 0.05,
                    longitudeDelta: 0.05,
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
                  <Text style={styles.addressText}>
                    {deliveryData.pickupLocation?.address || deliveryRequest?.pickupAddress || 'N/A'}
                  </Text>
                </>
              ) : (
                <>
                  <Text style={styles.addressLabel}>Dropoff Location</Text>
                  <Text style={styles.addressText}>
                    {deliveryData.dropoffLocation?.address || deliveryRequest?.dropoffAddress || 'N/A'}
                  </Text>
                </>
              )}
            </View>
          </View>

          <View style={styles.deliveryInfo}>
            <View style={styles.deliveryInfoItem}>
              <Text style={styles.deliveryInfoLabel}>Order ID</Text>
              <Text style={styles.deliveryInfoValue}>#{deliveryId.substring(0, 8)}</Text>
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
              <Text style={styles.deliveryInfoValue}>
                {formatPrice(deliveryData.fareDetails?.total || deliveryRequest?.fare || 0)}
              </Text>
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
            onPress={() => {
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
            }}
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

// ... styles remain the same ...

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
    flex: 1,
  },
  markerContainer: {
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
  driverMarker: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#4caf50',
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
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: '40%',
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
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
    backgroundColor: '#f8f9fa',
    padding: 15,
    borderRadius: 12,
    marginBottom: 15,
    borderLeftWidth: 3,
    borderLeftColor: '#0066cc',
  },
  instructionsTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 5,
  },
  instructionText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333',
    marginBottom: 5,
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
    backgroundColor: '#f0f0f0',
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 20,
  },
  navControlText: {
    marginLeft: 5,
    fontSize: 14,
    color: '#0066cc',
    fontWeight: '500',
  },
  addressContainer: {
    marginBottom: 15,
  },
  addressCard: {
    backgroundColor: '#f8f9fa',
    padding: 15,
    borderRadius: 12,
    borderLeftWidth: 3,
    borderLeftColor: '#0066cc',
  },
  addressLabel: {
    fontSize: 12,
    color: '#666',
    marginBottom: 5,
  },
  addressText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333',
  },
  deliveryInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 15,
    backgroundColor: '#f8f9fa',
    padding: 15,
    borderRadius: 12,
  },
  deliveryInfoItem: {
    alignItems: 'center',
  },
  deliveryInfoLabel: {
    fontSize: 12,
    color: '#666',
    marginBottom: 5,
  },
  deliveryInfoValue: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333',
  },
  contactContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 15,
  },
  contactButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f0f0f0',
    paddingVertical: 12,
    borderRadius: 10,
    marginHorizontal: 5,
  },
  contactButtonText: {
    marginLeft: 8,
    fontSize: 14,
    color: '#0066cc',
    fontWeight: '500',
  },
  cancelButton: {
    backgroundColor: '#ffebee',
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
    marginBottom: 10,
  },
  cancelButtonDisabled: {
    opacity: 0.5,
  },
  cancelButtonText: {
    fontSize: 14,
    color: '#d32f2f',
    fontWeight: '500',
  },
  actionButton: {
    position: 'absolute',
    bottom: 20,
    left: 20,
    right: 20,
    backgroundColor: '#0066cc',
    paddingVertical: 15,
    borderRadius: 12,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 5,
  },
  actionButtonDisabled: {
    backgroundColor: '#ccc',
  },
  actionButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#fff',
  },
});

export default NavigationScreen;