import React, { useState, useEffect, useRef, useCallback } from 'react';
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
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import MapView, { Marker, Polyline, PROVIDER_GOOGLE, Region } from 'react-native-maps';
import firestoreService from '../../services/FirestoreService';
import Geolocation from 'react-native-geolocation-service';
import { PERMISSIONS, request, check, RESULTS } from 'react-native-permissions';
import locationService from '../../services/LocationService';

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

  const unsubscribeDeliveryRef = useRef<() => void>();
  const watchId = useRef<number>();
  const mapRef = useRef<MapView>(null);

  // Calculate the optimal map region to show both driver and destination
  const calculateMapRegion = (): Region => {
    if (!driverLocation || !deliveryData) return DEFAULT_REGION;

    const destination = currentStep === 'accepted' || currentStep === 'arrived_pickup'
      ? deliveryData.pickupLocation?.coordinates
      : deliveryData.dropoffLocation?.coordinates;

    if (!destination) return DEFAULT_REGION;

    // Calculate midpoint between driver and destination
    const midLat = (driverLocation.latitude + destination.latitude) / 2;
    const midLon = (driverLocation.longitude + destination.longitude) / 2;

    // Calculate deltas to ensure both points are visible with padding
    const latDelta = Math.abs(driverLocation.latitude - destination.latitude) * 1.8;
    const lonDelta = Math.abs(driverLocation.longitude - destination.longitude) * 1.8;

    return {
      latitude: midLat,
      longitude: midLon,
      latitudeDelta: Math.max(0.05, Math.min(0.5, latDelta)),
      longitudeDelta: Math.max(0.05, Math.min(0.5, lonDelta)),
    };
  };

  // Update ETA calculation
  const updateETA = useCallback((currentDelivery: any, currentDriverLocation: {latitude: number, longitude: number} | null) => {
    if (!currentDriverLocation || !currentDelivery) {
      setEta('Calculating ETA...');
      return;
    }

    const destination = currentStep === 'accepted' || currentStep === 'arrived_pickup'
      ? currentDelivery.pickupLocation?.coordinates
      : currentDelivery.dropoffLocation?.coordinates;

    if (destination) {
      const distance = locationService.calculateDistance(currentDriverLocation, destination);
      const averageSpeed = 30; // km/h
      const timeInMinutes = Math.round((distance / averageSpeed) * 60);
      setEta(`${timeInMinutes} min (${distance.toFixed(1)} km)`);
    } else {
      setEta('Destination not available');
    }
  }, [currentStep]);

  // Update map region when location or step changes
  useEffect(() => {
    if (driverLocation && deliveryData) {
      const newRegion = calculateMapRegion();
      setMapRegion(newRegion);

      if (mapRef.current) {
        mapRef.current.animateToRegion(newRegion, 1000);
      }

      // Update ETA whenever map region changes
      updateETA(deliveryData, driverLocation);
    }
  }, [driverLocation, currentStep, deliveryData, updateETA]);

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
        // Initial fetch of delivery data
        const initialDeliveryResult = await firestoreService.getDelivery(deliveryId);
        if (initialDeliveryResult.success && initialDeliveryResult.delivery) {
          const initialData = initialDeliveryResult.delivery;
          setDeliveryData(initialData);
          setCurrentStep(initialData.status || 'accepted');

          // Fetch customer info
          if (initialData.customerId) {
            const customerResult = await firestoreService.getUserProfile(initialData.customerId);
            if (customerResult.success) {
              setCustomerInfo(customerResult.userProfile);
            }
          }

          // Subscribe to real-time delivery updates
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

          // Start driver location tracking
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

    // Handle back button
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
  }, [deliveryId]);

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
            await firestoreService.updateDeliveryStatus(deliveryId, 'cancelled');
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

      // Get initial position
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

      // Update state and wait for it to complete
      await new Promise<void>((resolve) => {
        setDriverLocation(initialLocation);
        setTimeout(resolve, 100);
      });

      await firestoreService.updateDriverLocation(driverId, initialLocation);
      setLocationError(null);

      // Watch for position updates
      watchId.current = Geolocation.watchPosition(
        (position) => {
          const newLocation = {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
          };
          setDriverLocation(newLocation);
          firestoreService.updateDriverLocation(driverId, newLocation);
          updateRouteCoordinates(newLocation);
          updateETA(deliveryData, newLocation);
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

  const updateRouteCoordinates = (currentLocation: {latitude: number, longitude: number}) => {
    if (!deliveryData) return;

    const destination = currentStep === 'accepted' || currentStep === 'arrived_pickup'
      ? deliveryData.pickupLocation?.coordinates
      : deliveryData.dropoffLocation?.coordinates;

    if (destination) {
      setRouteCoordinates([currentLocation, destination]);
    }
  };

  const handleNextStep = async () => {
    if (locationError) {
      Alert.alert('Location Error', 'Please enable location services to proceed.');
      return;
    }

    setIsLoading(true);
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
        const result = await firestoreService.updateDeliveryStatus(deliveryId, newStatus);
        if (!result.success) {
          Alert.alert('Error', result.error || 'Failed to update delivery status.');
        } else if (navigateToCompletion) {
          navigation.replace('DeliveryStatus', {
            deliveryId,
            request: {
              pickupAddress: deliveryData.pickupLocation?.address || 'N/A',
              dropoffAddress: deliveryData.dropoffLocation?.address || 'N/A',
              packageSize: deliveryData.packageDetails?.size || 'medium',
              distance: route.params.request.distance || 'N/A',
              fare: deliveryData.fareDetails?.total || 0,
              paymentMethod: deliveryData.paymentMethod || 'M-Pesa (Paid)',
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
      ? deliveryData.pickupLocation?.coordinates
      : deliveryData.dropoffLocation?.coordinates;

    if (destination) {
      const label = currentStep === 'accepted' || currentStep === 'arrived_pickup'
        ? 'Pickup Location'
        : 'Dropoff Location';
      locationService.openExternalNavigation(destination, label);
    }
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
        region={mapRegion}
        initialRegion={DEFAULT_REGION}
        showsUserLocation={true}
        followsUserLocation={false}
        showsMyLocationButton={true}
        showsCompass={true}
        toolbarEnabled={true}
      >
        {/* Pickup Marker */}
        {deliveryData.pickupLocation?.coordinates && (
          <Marker
            coordinate={deliveryData.pickupLocation.coordinates}
            title="Pickup"
            description={deliveryData.pickupLocation.address}
          >
            <View style={[
              styles.markerContainer,
              { backgroundColor: (currentStep === 'accepted' || currentStep === 'arrived_pickup') ? '#e6f2ff' : '#ccc' }
            ]}>
              <Ionicons
                name="locate"
                size={16}
                color={(currentStep === 'accepted' || currentStep === 'arrived_pickup') ? '#0066cc' : '#666'}
              />
            </View>
          </Marker>
        )}

        {/* Dropoff Marker */}
        {deliveryData.dropoffLocation?.coordinates && (
          <Marker
            coordinate={deliveryData.dropoffLocation.coordinates}
            title="Dropoff"
            description={deliveryData.dropoffLocation.address}
          >
            <View style={[
              styles.markerContainer,
              { backgroundColor: (currentStep === 'in_transit' || currentStep === 'arrived_dropoff') ? '#ffebee' : '#ccc' }
            ]}>
              <Ionicons
                name="location"
                size={16}
                color={(currentStep === 'in_transit' || currentStep === 'arrived_dropoff') ? '#ff6b6b' : '#666'}
              />
            </View>
          </Marker>
        )}

        {/* Route Line */}
        {routeCoordinates.length > 0 && (
          <Polyline
            coordinates={routeCoordinates}
            strokeWidth={3}
            strokeColor="#0066cc"
          />
        )}
      </MapView>

      {/* Navigation Panel */}
      <View style={styles.navigationPanel}>
        {locationError && (
          <View style={styles.errorBanner}>
            <Ionicons name="warning" size={20} color="#fff" />
            <Text style={styles.errorText}>{locationError}</Text>
          </View>
        )}

        <View style={styles.navigationHeader}>
          <Text style={styles.navigationTitle}>{getStepTitle()}</Text>
          <View style={styles.etaContainer}>
            <Ionicons name="time-outline" size={16} color="#0066cc" />
            <Text style={styles.etaText}>{eta}</Text>
          </View>
        </View>

        <Text style={styles.navigationInstructions}>{getStepInstructions()}</Text>

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

        <TouchableOpacity
          style={[styles.actionButton, isLoading && styles.actionButtonDisabled]}
          onPress={handleNextStep}
          disabled={isLoading || currentStep === 'delivered'}
        >
          <Text style={styles.actionButtonText}>
            {isLoading ? 'Processing...' : getActionButtonText()}
          </Text>
        </TouchableOpacity>

        <View style={styles.contactContainer}>
          <TouchableOpacity style={styles.contactButton} onPress={handleCallCustomer}>
            <Ionicons name="call" size={20} color="#0066cc" />
            <Text style={styles.contactButtonText}>Call Customer</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.contactButton} onPress={handleMessageCustomer}>
            <Ionicons name="chatbubble" size={20} color="#0066cc" />
            <Text style={styles.contactButtonText}>Message</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.contactButton} onPress={handleOpenExternalNavigation}>
            <Ionicons name="navigate" size={20} color="#0066cc" />
            <Text style={styles.contactButtonText}>External Nav</Text>
          </TouchableOpacity>
        </View>
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
  errorBanner: {
    backgroundColor: '#f44336',
    padding: 10,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 5,
    marginBottom: 10,
  },
  errorText: {
    color: '#fff',
    marginLeft: 5,
    fontSize: 14,
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
  navigationPanel: {
    flex: 1,
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    marginTop: -20,
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  navigationHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
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
  navigationInstructions: {
    fontSize: 14,
    color: '#666',
    marginBottom: 15,
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
  actionButton: {
    backgroundColor: '#0066cc',
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: 'center',
    marginBottom: 15,
  },
  actionButtonDisabled: {
    backgroundColor: '#99ccff',
  },
  actionButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  contactContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
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
});

export default NavigationScreen;