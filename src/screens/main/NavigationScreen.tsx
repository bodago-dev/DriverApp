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
  Dimensions,
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import MapView, { Marker, Polyline, PROVIDER_GOOGLE, Region } from 'react-native-maps';
import firestoreService from '../../services/FirestoreService';
import Geolocation from 'react-native-geolocation-service';
import { PERMISSIONS, request, check, RESULTS } from 'react-native-permissions';
import locationService from '../../services/LocationService';
import directionsService from '../../services/DirectionsService';
import Config from 'react-native-config';

const { width, height } = Dimensions.get('window');
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

        // Fit map to show entire path
        if (mapRef.current && isMountedRef.current) {
          const coordinatesToFit = [startLocation, endLocation, ...directions.points];
          mapRef.current.fitToCoordinates(coordinatesToFit, {
            edgePadding: { top: 100, right: 100, bottom: 300, left: 100 },
            animated: true,
          });
        }

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
        setLocationError('Location permission denied');
        return false;
      }

      // Get initial location
      Geolocation.getCurrentPosition(
        (position) => {
          if (!isMountedRef.current) return;
          const { latitude, longitude, heading } = position.coords;
          const newLoc = { latitude, longitude };
          setDriverLocation(newLoc);
          setDriverHeading(heading || 0);
          updateETA(newLoc);
          
          // Initial map fit
          const destination = currentStep === 'accepted' || currentStep === 'arrived_pickup' ? pickupCoords : dropoffCoords;
          if (destination) {
            fetchRouteDirections(newLoc, destination, true);
          }
        },
        (error) => {
          console.error('Error getting initial location:', error);
          setLocationError(error.message);
        },
        { enableHighAccuracy: true, timeout: 15000, maximumAge: 10000 }
      );

      // Watch location
      watchId.current = Geolocation.watchPosition(
        (position) => {
          if (!isMountedRef.current) return;
          const { latitude, longitude, heading } = position.coords;
          const newLoc = { latitude, longitude };
          
          setDriverLocation(newLoc);
          setDriverHeading(heading || 0);
          updateETA(newLoc);

          // Update Firestore
          firestoreService.updateDriverLocation(driverId, {
            latitude,
            longitude,
            heading: heading || 0,
            updatedAt: new Date()
          });
          
          // Update instruction index based on proximity to steps
          if (routeData && routeData.steps) {
            const nextStepIndex = findNextInstructionIndex(newLoc, routeData.steps);
            if (nextStepIndex !== currentInstructionIndex) {
              setCurrentInstructionIndex(nextStepIndex);
            }
          }
        },
        (error) => {
          console.error('Location watch error:', error);
          if (isMountedRef.current) {
            setLocationError(error.message);
          }
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
      console.error('Error starting location tracking:', error);
      return false;
    }
  };

  const findNextInstructionIndex = (currentLoc, steps) => {
    // Simple logic to find the closest step that is ahead of us
    // In a real app, this would be more complex
    return currentInstructionIndex;
  };

  // Fetch delivery data and customer info
  useEffect(() => {
    const fetchData = async () => {
      if (!deliveryId || !isMountedRef.current) return;

      setIsLoading(true);
      try {
        // Get initial delivery data
        const result = await firestoreService.getDelivery(deliveryId);
        if (result.success && result.delivery && isMountedRef.current) {
          setDeliveryData(result.delivery);
          setCurrentStep(result.delivery.status);

          // Get customer info
          if (result.delivery.customerId) {
            const customerResult = await firestoreService.getUserProfile(result.delivery.customerId);
            if (customerResult.success && isMountedRef.current) {
              setCustomerInfo(customerResult.userProfile);
            }
          }

          // Start location tracking
          const driverId = result.delivery.driverId;
          if (driverId) {
            await startLocationTracking(driverId);
          }
        } else if (isMountedRef.current) {
          Alert.alert('Error', 'Failed to load delivery details');
          navigation.goBack();
        }

        // Subscribe to delivery updates
        unsubscribeDeliveryRef.current = firestoreService.subscribeToDeliveryUpdates(
          deliveryId,
          (updatedDelivery) => {
            if (updatedDelivery && isMountedRef.current) {
              // Check if the delivery was cancelled by the customer
              if (updatedDelivery.status === 'cancelled' && deliveryData?.status !== 'cancelled') {
                Alert.alert(
                  'Delivery Cancelled',
                  'This delivery has been cancelled by the customer.',
                  [{ text: 'OK', onPress: () => navigation.goBack() }]
                );
              }
              setDeliveryData(updatedDelivery);
              setCurrentStep(updatedDelivery.status);
            }
          }
        );
      } catch (error) {
        console.error('Error fetching data:', error);
      } finally {
        if (isMountedRef.current) {
          setIsLoading(false);
        }
      }
    };

    fetchData();
  }, [deliveryId]);

  // Update route when step changes
  useEffect(() => {
    if (!driverLocation || !isMountedRef.current) return;

    const destination = currentStep === 'accepted' || currentStep === 'arrived_pickup'
      ? pickupCoords
      : dropoffCoords;

    if (destination) {
      fetchRouteDirections(driverLocation, destination, true);
    }
  }, [currentStep, pickupCoords, dropoffCoords]);

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
        navigateToCompletion = true;
        break;
      case 'arrived_dropoff':
        navigateToCompletion = true;
        break;
      case 'delivered':
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
          // Navigate to DeliveryStatusScreen when arriving at dropoff
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
              packageDetails: deliveryData.packageDetails,
            }
          });
        }
      } catch (error) {
        console.error('Error updating status:', error);
        Alert.alert('Error', 'Failed to update delivery status.');
      }
    } else if (navigateToCompletion && isMountedRef.current) {
      // Already at dropoff, just navigate
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
          packageDetails: deliveryData.packageDetails,
        }
      });
    }

      if (isMountedRef.current) {
        setIsLoading(false);
      }
    };

  const getActionButtonText = () => {
    switch (currentStep) {
      case 'accepted': return 'Arrived at Pickup';
      case 'arrived_pickup': return 'Start Delivery';
      case 'in_transit': return 'Arrived at Dropoff'; // ← Changed text
      case 'arrived_dropoff': return 'At Dropoff'; // ← Keep this for consistency
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

    return (
      <View style={styles.instructionsContainer}>
        <Text style={styles.instructionsTitle}>Navigation Steps</Text>
        <ScrollView style={{ maxHeight: 150 }}>
          {routeData.steps.map((step, index) => (
            <View key={index} style={[
              styles.stepItem,
              index === currentInstructionIndex && styles.activeStepItem
            ]}>
              <Ionicons
                name={index === currentInstructionIndex ? "arrow-forward-circle" : "ellipse-outline"}
                size={18}
                color={index === currentInstructionIndex ? "#0066cc" : "#999"}
              />
              <View style={styles.stepTextContainer}>
                <Text style={[
                  styles.stepInstruction,
                  index === currentInstructionIndex && styles.activeStepText
                ]}>
                  {step.instruction}
                </Text>
                <Text style={styles.stepDetail}>{step.distance} • {step.duration}</Text>
              </View>
            </View>
          ))}
        </ScrollView>
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

          // Initial fit
          if (driverLocation) {
            const destination = currentStep === 'accepted' || currentStep === 'arrived_pickup' ? pickupCoords : dropoffCoords;
            if (destination) {
              const coordinatesToFit = [driverLocation, destination];
              mapRef.current?.fitToCoordinates(coordinatesToFit, {
                edgePadding: { top: 100, right: 100, bottom: 300, left: 100 },
                animated: true,
              });
            }
          }
        }}
      >
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
            rotation={driverHeading}
            anchor={{ x: 0.5, y: 0.5 }}
            title="Your Location"
          >
            <View style={styles.driverMarker}>
              <Ionicons name="navigate" size={16} color="#FFFFFF" />
            </View>
          </Marker>
        )}

        {routeCoordinates.length > 1 && (
          <Polyline
            coordinates={routeCoordinates}
            strokeWidth={4}
            strokeColor="#0066cc"
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
                    latitudeDelta: 0.01,
                    longitudeDelta: 0.01,
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
                    {deliveryData.pickupLocation?.name || deliveryData.pickupLocation?.address || deliveryRequest?.pickupAddress || 'N/A'}
                  </Text>
                </>
              ) : (
                <>
                  <Text style={styles.addressLabel}>Dropoff Location</Text>
                  <Text style={styles.addressText}>
                    {deliveryData.dropoffLocation?.name || deliveryData.dropoffLocation?.address || deliveryRequest?.dropoffAddress || 'N/A'}
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

          {/* Cancel Button or Special Instructions */}
          {['accepted', 'arrived_pickup'].includes(currentStep) ? (
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
          ) : (
            <View style={styles.specialInstructionsContainer}>
              <Text style={styles.specialInstructionsTitle}>Special Instructions</Text>
              <Text style={styles.specialInstructionsText}>
                {deliveryData.packageDetails?.specialInstructions || 'No special instructions provided.'}
              </Text>
            </View>
          )}
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
    height: '45%',
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 80,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 5,
    elevation: 10,
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
    marginBottom: 10,
  },
  stepItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 12,
    paddingRight: 10,
  },
  activeStepItem: {
    backgroundColor: '#e6f2ff',
    padding: 8,
    borderRadius: 8,
    marginLeft: -8,
    marginRight: 2,
  },
  stepTextContainer: {
    marginLeft: 10,
    flex: 1,
  },
  stepInstruction: {
    fontSize: 14,
    color: '#444',
    lineHeight: 18,
  },
  activeStepText: {
    fontWeight: '600',
    color: '#0066cc',
  },
  stepDetail: {
    fontSize: 11,
    color: '#888',
    marginTop: 2,
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
    backgroundColor: '#f9f9f9',
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#eee',
  },
  addressLabel: {
    fontSize: 12,
    color: '#999',
    marginBottom: 2,
  },
  addressText: {
    fontSize: 14,
    color: '#333',
    fontWeight: '500',
  },
  deliveryInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: '#f9f9f9',
    padding: 12,
    borderRadius: 10,
    marginBottom: 15,
  },
  deliveryInfoItem: {
    alignItems: 'center',
    flex: 1,
  },
  deliveryInfoLabel: {
    fontSize: 11,
    color: '#999',
    marginBottom: 2,
  },
  deliveryInfoValue: {
    fontSize: 13,
    color: '#333',
    fontWeight: '600',
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
    paddingVertical: 10,
    borderRadius: 10,
    flex: 0.48,
  },
  contactButtonText: {
    marginLeft: 8,
    fontSize: 14,
    color: '#0066cc',
    fontWeight: '500',
  },
  cancelButton: {
    paddingVertical: 12,
    alignItems: 'center',
    marginBottom: 10,
  },
  cancelButtonText: {
    color: '#f44336',
    fontSize: 14,
    fontWeight: '500',
  },
  cancelButtonDisabled: {
    opacity: 0.5,
  },
  specialInstructionsContainer: {
    backgroundColor: '#fff9e6',
    padding: 15,
    borderRadius: 12,
    marginBottom: 15,
    borderLeftWidth: 3,
    borderLeftColor: '#ffc107',
  },
  specialInstructionsTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#856404',
    marginBottom: 5,
  },
  specialInstructionsText: {
    fontSize: 14,
    color: '#856404',
    fontStyle: 'italic',
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
  actionButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  actionButtonDisabled: {
    backgroundColor: '#ccc',
  },
});

export default NavigationScreen;
