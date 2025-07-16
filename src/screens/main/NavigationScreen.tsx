import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  BackHandler,
  ActivityIndicator,
  Linking,
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from 'react-native-maps';
import firestoreService from '../../services/FirestoreService';
// import * as Location from 'expo-location';

const NavigationScreen = ({ route, navigation }) => {
  const { deliveryId } = route.params;

  const [isLoading, setIsLoading] = useState(true);
  const [deliveryData, setDeliveryData] = useState(null);
  const [driverLocation, setDriverLocation] = useState(null);
  const [customerInfo, setCustomerInfo] = useState(null);
  const [currentStep, setCurrentStep] = useState(''); // 'to_pickup', 'arrived_pickup', 'to_dropoff', 'arrived_dropoff'
  const [eta, setEta] = useState('Calculating ETA...');

  const unsubscribeDeliveryRef = useRef(null);
  const unsubscribeLocationRef = useRef(null);
  const locationWatcherRef = useRef(null);

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
          setCurrentStep(initialData.status); // Set initial step based on delivery status

          // Fetch customer info
          if (initialData.customerId) {
            const customerResult = await firestoreService.getUserProfile(initialData.customerId);
            if (customerResult.success) {
              setCustomerInfo(customerResult.userProfile);
            }
          }

          // Subscribe to real-time delivery updates
          unsubscribeDeliveryRef.current = firestoreService.subscribeToDeliveryUpdates(deliveryId, (updatedDelivery) => {
            if (updatedDelivery) {
              setDeliveryData(updatedDelivery);
              setCurrentStep(updatedDelivery.status);
              // Update ETA based on actual location and destination
              // This would involve a more complex routing API call
            }
          });

          // Start driver location tracking
          startLocationTracking(initialData.driverId);

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

    // Handle back button to prevent accidental navigation away
    const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
      Alert.alert(
        'Cancel Delivery?',
        'Are you sure you want to cancel this delivery? This may affect your rating.',
        [
          {
            text: 'No, Continue',
            style: 'cancel',
            onPress: () => {},
          },
          {
            text: 'Yes, Cancel',
            style: 'destructive',
            onPress: async () => {
              await firestoreService.updateDeliveryStatus(deliveryId, 'cancelled');
              navigation.goBack();
              return true;
            },
          },
        ]
      );
      return true;
    });

    return () => {
      if (unsubscribeDeliveryRef.current) {
        unsubscribeDeliveryRef.current();
      }
      if (unsubscribeLocationRef.current) {
        unsubscribeLocationRef.current();
      }
      if (locationWatcherRef.current) {
        locationWatcherRef.current.remove();
      }
      backHandler.remove();
    };
  }, [deliveryId]);

  const startLocationTracking = async (driverId) => {
    let { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission Denied', 'Location access needed for navigation.');
      return;
    }

    locationWatcherRef.current = await Location.watchPositionAsync(
      {
        accuracy: Location.Accuracy.High,
        timeInterval: 5000, // Update every 5 seconds
        distanceInterval: 10, // Update every 10 meters
      },
      (loc) => {
        const newLocation = {
          latitude: loc.coords.latitude,
          longitude: loc.coords.longitude,
        };
        setDriverLocation(newLocation);
        firestoreService.updateDriverLocation(driverId, newLocation);
      }
    );
  };

  const handleNextStep = async () => {
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
      const result = await firestoreService.updateDeliveryStatus(deliveryId, newStatus);
      if (result.success) {
        if (navigateToCompletion) {
          navigation.replace('DeliveryStatus', { deliveryId });
        }
      } else {
        Alert.alert('Error', result.error || 'Failed to update delivery status.');
      }
    }
    setIsLoading(false);
  };

  const getActionButtonText = () => {
    switch (currentStep) {
      case 'accepted':
        return 'Arrived at Pickup';
      case 'arrived_pickup':
        return 'Package Picked Up';
      case 'picked_up':
        return 'Start Delivery';
      case 'in_transit':
        return 'Arrived at Dropoff';
      case 'arrived_dropoff':
        return 'Complete Delivery';
      case 'delivered':
        return 'Delivery Completed';
      default:
        return 'Next Step';
    }
  };

  const getStepTitle = () => {
    switch (currentStep) {
      case 'accepted':
        return 'Navigating to Pickup';
      case 'arrived_pickup':
        return 'At Pickup Location';
      case 'picked_up':
        return 'En Route to Dropoff';
      case 'in_transit':
        return 'En Route to Dropoff';
      case 'arrived_dropoff':
        return 'At Dropoff Location';
      case 'delivered':
        return 'Delivery Complete';
      default:
        return 'Navigation';
    }
  };

  const getStepInstructions = () => {
    switch (currentStep) {
      case 'accepted':
        return 'Follow the route to the pickup location';
      case 'arrived_pickup':
        return 'Collect the package from the sender';
      case 'picked_up':
        return 'Proceed to the dropoff location';
      case 'in_transit':
        return 'Continue to the dropoff location';
      case 'arrived_dropoff':
        return 'Deliver the package to the recipient';
      case 'delivered':
        return 'Delivery successfully completed.';
      default:
        return '';
    }
  };

  const getMapRegion = () => {
    if (!deliveryData || !driverLocation) return null;

    const pickupCoords = deliveryData.pickupLocation?.coordinates;
    const dropoffCoords = deliveryData.dropoffLocation?.coordinates;

    if (!pickupCoords || !dropoffCoords) return null;

    let targetCoords = null;
    if (currentStep === 'accepted' || currentStep === 'arrived_pickup') {
      targetCoords = pickupCoords;
    } else {
      targetCoords = dropoffCoords;
    }

    if (targetCoords && driverLocation) {
      const midLat = (driverLocation.latitude + targetCoords.latitude) / 2;
      const midLon = (driverLocation.longitude + targetCoords.longitude) / 2;
      const latDelta = Math.abs(driverLocation.latitude - targetCoords.latitude) * 1.5;
      const lonDelta = Math.abs(driverLocation.longitude - targetCoords.longitude) * 1.5;

      return {
        latitude: midLat,
        longitude: midLon,
        latitudeDelta: Math.max(0.02, latDelta),
        longitudeDelta: Math.max(0.02, lonDelta),
      };
    }
    return null;
  };

  const getVehicleIcon = (vehicleType) => {
    switch (vehicleType) {
      case 'boda':
        return 'motorcycle';
      case 'bajaji':
        return 'car';
      case 'guta':
        return 'truck';
      default:
        return 'car';
    }
  };

  const formatPrice = (price) => {
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

  if (isLoading || !deliveryData) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#0066cc" />
        <Text style={styles.loadingText}>Loading delivery details...</Text>
      </View>
    );
  }

  const pickupCoords = deliveryData.pickupLocation?.coordinates;
  const dropoffCoords = deliveryData.dropoffLocation?.coordinates;
  const mapCurrentRegion = getMapRegion();

  return (
    <View style={styles.container}>
      {/* Map View */}
      {mapCurrentRegion && (
        <MapView
          provider={PROVIDER_GOOGLE}
          style={styles.map}
          region={mapCurrentRegion}
        >
          {/* Driver Marker */}
          {driverLocation && (
            <Marker
              coordinate={driverLocation}
              title="You"
              description="Your current location"
            >
              <View style={[styles.markerContainer, { backgroundColor: '#0066cc' }]}>
                <Ionicons
                  name={getVehicleIcon(deliveryData.vehicleType)}
                  size={16}
                  color="#fff"
                />
              </View>
            </Marker>
          )}

          {/* Pickup Marker */}
          {pickupCoords && (
            <Marker
              coordinate={pickupCoords}
              title="Pickup"
              description={deliveryData.pickupLocation?.address}
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
          {dropoffCoords && (
            <Marker
              coordinate={dropoffCoords}
              title="Dropoff"
              description={deliveryData.dropoffLocation?.address}
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
          {driverLocation && pickupCoords && dropoffCoords && (
            <Polyline
              coordinates={[
                driverLocation,
                (currentStep === 'accepted' || currentStep === 'arrived_pickup') ? pickupCoords : dropoffCoords,
              ]}
              strokeWidth={3}
              strokeColor="#0066cc"
            />
          )}
        </MapView>
      )}

      {/* Navigation Panel */}
      <View style={styles.navigationPanel}>
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
              {deliveryData.packageSize === 'small' ? 'Small' :
               deliveryData.packageSize === 'medium' ? 'Medium' : 'Large'}
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