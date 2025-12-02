import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Switch,
  Alert,
  RefreshControl,
  ActivityIndicator,
  Platform,
  Linking
} from 'react-native';
import Geolocation from 'react-native-geolocation-service';
import { PERMISSIONS, request, check, RESULTS } from 'react-native-permissions';
import Ionicons from 'react-native-vector-icons/Ionicons';
import firestoreService from '../../services/FirestoreService';
import authService from '../../services/AuthService';

const HomeScreen = ({ navigation }) => {
  const [isOnline, setIsOnline] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isLocationLoading, setIsLocationLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [stats, setStats] = useState({
    todayEarnings: 0,
    todayDeliveries: 0,
    weeklyEarnings: 0,
    rating: 0,
  });
  const [nearbyRequests, setNearbyRequests] = useState([]);
  const [driverId, setDriverId] = useState<string | null>(null);
  const [driverLocation, setDriverLocation] = useState<{latitude: number, longitude: number} | null>(null);
  const [activeDeliveries, setActiveDeliveries] = useState([]);
  const [driverVehicleType, setDriverVehicleType] = useState<string | null>(null);
  const [verificationStatus, setVerificationStatus] = useState('inactive');

  const unsubscribeRequestsRef = useRef<(() => void) | null>(null);
  const watchId = useRef<number | null>(null);

  // Initialize Geolocation
  useEffect(() => {
    Geolocation.setRNConfiguration({
      skipPermissionRequests: false,
      authorizationLevel: 'whenInUse',
    });
  }, []);

  useEffect(() => {
    const currentUser = authService.getCurrentUser();
    if (currentUser) {
      setDriverId(currentUser.uid);
    } else {
      setIsLoading(false);
      Alert.alert('Error', 'Driver not authenticated. Please log in.');
      navigation.navigate('AuthStack');
    }
  }, []);

  useEffect(() => {
    if (driverId) {
      fetchDriverData();
      fetchActiveDeliveries();
      checkOnlineStatus();
      checkVerificationStatus();
    }
  }, [driverId]);

  const checkVerificationStatus = async () => {
    try {
      const profileResult = await firestoreService.getUserProfile(driverId!);
      if (profileResult.success && profileResult.userProfile) {
        const status = profileResult.userProfile.verificationStatus || 'inactive';
        setVerificationStatus(status);

        // If profile is inactive, force offline status
        if (status !== 'active' && isOnline) {
          setIsOnline(false);
          stopLocationTracking();
          if (unsubscribeRequestsRef.current) {
            unsubscribeRequestsRef.current();
            unsubscribeRequestsRef.current = null;
          }
          setNearbyRequests([]);
        }
      }
    } catch (error) {
      console.error('Error checking verification status:', error);
    }
  };

  const fetchActiveDeliveries = async () => {
    try {
      const currentUser = authService.getCurrentUser();
      if (!currentUser) return;

      const result = await firestoreService.getUserDeliveries(currentUser.uid, 'driver');
      if (result.success) {
        const active = result.deliveries.filter(delivery =>
          ['accepted', 'arrived_pickup', 'picked_up', 'in_transit', 'arrived_dropoff'].includes(delivery.status)
        );
        setActiveDeliveries(active);
      }
    } catch (error) {
      console.error('Error fetching active deliveries:', error);
    }
  };

  const handleActiveDeliveryPress = (delivery) => {
    navigation.navigate('DeliveryTab', {
      screen: 'Navigation',
      params: {
        deliveryId: delivery.id,
        request: {
          pickupAddress: delivery.pickupLocation?.address || 'N/A',
          dropoffAddress: delivery.dropoffLocation?.address || 'N/A',
          packageSize: delivery.packageDetails?.size || 'medium',
          distance: delivery.distance || 'N/A',
          fare: delivery.fareDetails?.total || 0,
          paymentMethod: delivery.paymentMethod || 'M-Pesa (Paid)',
          status: delivery.status
        }
      }
    });
  };

  const checkOnlineStatus = async () => {
    const result = await firestoreService.getDriverLocation(driverId!);
    if (result.success && result.location && result.location.online) {
      setIsOnline(false);
    }
  };

  const fetchDriverData = async () => {
    setIsLoading(true);
    try {
      // Fetch driver profile first to get vehicle type, rating, and verification status
      const profileResult = await firestoreService.getUserProfile(driverId!);
      console.log('User profile result:', profileResult);

      let vehicleType = 'boda'; // Default fallback
      let verificationStatus = 'inactive';

      if (profileResult.success && profileResult.userProfile) {
        // Set the vehicle type from profile
        vehicleType = profileResult.userProfile.vehicleInfo?.vehicleType ||
                     profileResult.userProfile.vehicleType ||
                     'boda';

        console.log('Vehicle type from profile:', vehicleType);
        setDriverVehicleType(vehicleType);

        // Set verification status
        verificationStatus = profileResult.userProfile.verificationStatus || 'inactive';
        setVerificationStatus(verificationStatus);

        // Set rating from profile
        setStats(prev => ({
          ...prev,
          rating: profileResult.userProfile.rating || 0,
        }));
      } else {
        // If no profile found, use defaults
        setDriverVehicleType(vehicleType);
        setVerificationStatus(verificationStatus);
        console.log('Using default vehicle type:', vehicleType);
      }

      // Then fetch deliveries for earnings calculation
      const deliveriesResult = await firestoreService.getUserDeliveries(driverId!, 'driver');
      if (deliveriesResult.success) {
        const allDeliveries = deliveriesResult.deliveries;
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        let todayEarnings = 0;
        let todayDeliveries = 0;
        let weeklyEarnings = 0;

        allDeliveries.forEach(delivery => {
          const deliveryDate = delivery.createdAt?.toDate();
          if (deliveryDate) {
            if (deliveryDate.toDateString() === today.toDateString() && delivery.status === 'delivered') {
              todayEarnings += delivery.fareDetails?.total || 0;
              todayDeliveries++;
            }

            const oneWeekAgo = new Date(today);
            oneWeekAgo.setDate(today.getDate() - 7);
            if (deliveryDate >= oneWeekAgo && delivery.status === 'delivered') {
              weeklyEarnings += delivery.fareDetails?.total || 0;
            }
          }
        });

        setStats(prev => ({
          ...prev,
          todayEarnings,
          todayDeliveries,
          weeklyEarnings,
        }));
      }
    } catch (error) {
      console.error('Error fetching driver data:', error);
      Alert.alert('Error', 'Failed to fetch driver data.');
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  };

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

      const permissionStatus = await check(permission);
      console.log('Current permission status:', permissionStatus);

      if (permissionStatus === RESULTS.GRANTED) {
        return true;
      }

      const requestResult = await request(permission);
      console.log('Permission request result:', requestResult);

      if (requestResult === RESULTS.BLOCKED) {
        Alert.alert(
          'Permission Required',
          'Location permission is required to receive delivery requests. Please enable it in settings.',
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Open Settings', onPress: () => Linking.openSettings() }
          ]
        );
        return false;
      }

      return requestResult === RESULTS.GRANTED;
    } catch (err) {
      console.warn('Error checking/requesting location permission:', err);
      return false;
    }
  };

  const checkLocationServices = async () => {
    try {
      // For Android, check if location permission is granted as proxy for services being enabled
      if (Platform.OS === 'android') {
        const hasPermission = await check(PERMISSIONS.ANDROID.ACCESS_FINE_LOCATION);
        return hasPermission === RESULTS.GRANTED;
      }
      return true; // For iOS, assume services are enabled
    } catch (error) {
      console.warn('Location services check failed:', error);
      return true; // Fallback to true
    }
  };

  const getCurrentPosition = (): Promise<{latitude: number, longitude: number}> => {
    return new Promise((resolve, reject) => {
      Geolocation.getCurrentPosition(
        (position) => {
          if (!position?.coords) {
            reject(new Error('No coordinates received'));
            return;
          }
          resolve({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude
          });
        },
        (error) => {
          console.error('Location error:', error);
          reject(error);
        },
        {
          enableHighAccuracy: true,
          timeout: 15000,
          maximumAge: 10000
        }
      );
    });
  };

  const setupDeliverySubscription = (location: {latitude: number, longitude: number}, vehicleType: string | null) => {
    console.log('Setting up delivery subscription with location and vehicle filter:', location, vehicleType);

    // Clear any existing subscription
    if (unsubscribeRequestsRef.current) {
      unsubscribeRequestsRef.current();
      unsubscribeRequestsRef.current = null;
    }

    try {
      unsubscribeRequestsRef.current = firestoreService.subscribeToDeliveryRequests(
        {
          latitude: location.latitude,
          longitude: location.longitude
        },
        vehicleType,
        (requests) => {
          if (!Array.isArray(requests)) {
            console.warn('Invalid requests format:', requests);
            return;
          }
          setNearbyRequests(requests);
        },
        (error) => {
          console.error('Delivery request subscription error:', error);
          setLocationError('Failed to load delivery requests');
        }
      );
    } catch (error) {
      console.error('Error setting up subscription:', error);
      setLocationError('Failed to setup request subscription');
    }
  };

  const startLocationTracking = async () => {
    console.log('Starting location tracking...');
    try {
      setIsLocationLoading(true);
      setLocationError(null);

      // Verify location services
      const servicesEnabled = await checkLocationServices();
      if (!servicesEnabled) {
        Alert.alert(
          'Location Services Required',
          'Please enable location services to go online',
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Open Settings', onPress: () => Linking.openSettings() }
          ]
        );
        setIsOnline(false);
        return;
      }

      // Get initial location
      let initialLocation;
      try {
        initialLocation = await getCurrentPosition();
        console.log('Initial location obtained:', initialLocation);

        // Update state and wait for it to complete
        await new Promise<void>((resolve) => {
            setDriverLocation(initialLocation);
            // Use a small timeout to ensure state is updated
            setTimeout(resolve, 100);
        });

        await firestoreService.updateDriverLocation(driverId!, initialLocation);
      } catch (error) {
        console.warn('Error getting initial location:', error);
        // Use fallback location if needed
        initialLocation = {
          latitude: -6.7924, // Default Dar es Salaam coordinates
          longitude: 39.2083
        };
        await new Promise<void>((resolve) => {
            setDriverLocation(initialLocation);
            setTimeout(resolve, 100);
        });
        await firestoreService.updateDriverLocation(driverId!, initialLocation);
      }

      // Start watching position updates
      watchId.current = Geolocation.watchPosition(
        (position) => {
          if (!position?.coords) {
            console.warn('Position update without coordinates');
            return;
          }
          const newLocation = {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude
          };
          setDriverLocation(newLocation);
          firestoreService.updateDriverLocation(driverId!, newLocation);
        },
        (error) => {
          console.error('Watch position error:', error);
          setLocationError(error.message);
          setIsOnline(false);
        },
        {
          enableHighAccuracy: true,
          distanceFilter: 10,
          interval: 5000,
          fastestInterval: 2000
        }
      );

      // Now setup delivery request subscription with vehicle type filter
      setupDeliverySubscription(initialLocation, driverVehicleType);
    } catch (error) {
      console.error('Location tracking failed:', error);
      setLocationError(error.message || 'Failed to start tracking');
      setIsOnline(false);
    } finally {
      setIsLocationLoading(false);
    }
  };

  const stopLocationTracking = () => {
    if (watchId.current !== null) {
      Geolocation.clearWatch(watchId.current);
      watchId.current = null;
    }
  };

  const handleRefresh = () => {
    setRefreshing(true);
    fetchDriverData();
    fetchActiveDeliveries();
    checkVerificationStatus();
    if (isOnline && driverLocation) {
      setupDeliverySubscription(driverLocation, driverVehicleType);
    }
  };

  const handleToggleOnline = async () => {
    // Check verification status first
    if (verificationStatus !== 'active') {
      Alert.alert(
        'Account Not Activated',
        verificationStatus === 'suspended'
          ? 'Your account has been suspended. Please contact support for assistance.'
          : 'Your account is currently under verification. You will be able to go online once your documents are verified and account is activated. This usually takes 1-2 business days.',
        [{ text: 'OK' }]
      );
      return;
    }

    if (isLocationLoading) return;

    // Ensure we have a vehicle type before going online
    if (!driverVehicleType) {
      Alert.alert(
        'Vehicle Type Required',
        'Please complete your vehicle information in your profile before going online.',
        [
          {
            text: 'OK',
            onPress: () => navigation.navigate('ProfileTab', {
              screen: 'ProfileMain',
              params: { showVehicleForm: true }
            })
          }
        ]
      );
      return;
    }

    const newStatus = !isOnline;
    setIsOnline(newStatus);

    if (newStatus) {
      try {
        const hasPermission = await requestLocationPermission();
        if (!hasPermission) {
          setIsOnline(false);
          return;
        }

        await startLocationTracking();
        Alert.alert('You are now online', 'You will receive delivery requests in your area.');
      } catch (error) {
        console.error('Error going online:', error);
        setIsOnline(false);
        Alert.alert('Error', 'Could not start location tracking');
      }
    } else {
      stopLocationTracking();
      if (unsubscribeRequestsRef.current) {
        unsubscribeRequestsRef.current();
        unsubscribeRequestsRef.current = null;
      }
      setNearbyRequests([]);
      Alert.alert('You are now offline', 'You will not receive any delivery requests.');
    }
  };

  const handleRequestPress = (request: any) => {
    navigation.navigate('DeliveryRequest', {
      request: {
        id: request.id,
        pickupAddress: request.pickupLocation?.address || 'N/A',
        dropoffAddress: request.dropoffLocation?.address || 'N/A',
        packageSize: request.packageDetails?.size || 'medium',
        distance: request.distance?.toFixed(1) || 'N/A',
        fare: request.fareDetails?.total || 0,
        estimatedTime: request.estimatedTime || 'N/A',
        // Add any other necessary fields from the request
        ...request // Spread the rest of the request data
      }
    });
    console.log('Request data...', request);
  };

  const formatPrice = (price: number) => {
    return `TZS ${price.toLocaleString()}`;
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'accepted': return 'Driver Assigned';
      case 'arrived_pickup': return 'At Pickup';
      case 'picked_up': return 'Picked Up';
      case 'in_transit': return 'In Transit';
      case 'arrived_dropoff': return 'At Destination';
      default: return status.replace('_', ' ');
    }
  };

  const getVerificationStatusText = () => {
    switch (verificationStatus) {
      case 'active':
        return 'Account Activated';
      case 'inactive':
        return 'Under Verification';
      case 'suspended':
        return 'Account Suspended';
      default:
        return 'Status Unknown';
    }
  };

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#0066cc" />
        <Text style={styles.loadingText}>Loading driver data...</Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
      }>
      {locationError && (
        <View style={styles.errorBanner}>
          <Text style={styles.errorText}>{locationError}</Text>
          <TouchableOpacity onPress={() => setLocationError(null)}>
            <Ionicons name="close" size={20} color="#fff" />
          </TouchableOpacity>
        </View>
      )}

      {/* Verification Status Banner */}
      {verificationStatus !== 'active' && (
        <View style={[
          styles.statusContainer,
          verificationStatus === 'suspended' ? styles.suspendedBanner : styles.inactiveBanner
        ]}>
          <Ionicons
            name={verificationStatus === 'suspended' ? "alert-circle" : "time-outline"}
            size={20}
            color="#fff"
          />
          <Text style={styles.verificationBannerText}>
            {verificationStatus === 'suspended'
              ? 'Your account has been suspended. Please contact support.'
              : 'Your account is under verification. You will be notified once activated.'}
          </Text>
        </View>
      )}

      <View style={styles.statusContainer}>
        <View style={styles.statusContent}>
          <Text style={styles.statusText}>
            {isOnline ? 'You are online' : 'You are offline'}
          </Text>
          <Text style={styles.statusDescription}>
            {isOnline
              ? 'You are receiving delivery requests'
              : verificationStatus !== 'active'
                ? getVerificationStatusText()
                : 'Go online to receive delivery requests'}
          </Text>
        </View>
        <Switch
          trackColor={{ false: '#ccc', true: verificationStatus === 'active' ? '#4caf50' : '#ccc' }}
          thumbColor={isOnline ? '#fff' : '#f4f3f4'}
          ios_backgroundColor="#ccc"
          onValueChange={handleToggleOnline}
          value={isOnline}
          disabled={isLocationLoading || verificationStatus !== 'active'}
        />
      </View>

      {isLocationLoading && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color="#0066cc" />
          <Text style={styles.loadingText}>Getting your location...</Text>
        </View>
      )}

      {/* Vehicle Type Filter Indicator */}
      {isOnline && driverVehicleType && (
        <View style={styles.vehicleFilterContainer}>
          <Text style={styles.vehicleFilterText}>
            Showing requests for: {driverVehicleType}
          </Text>
        </View>
      )}

      {/* Active Deliveries Panel */}
      {activeDeliveries.length > 0 && (
        <View style={styles.activeDeliveriesContainer}>
          <Text style={styles.sectionTitle}>Active Deliveries</Text>
          {activeDeliveries.map((delivery) => (
            <TouchableOpacity
              key={delivery.id}
              style={styles.activeDeliveryCard}
              onPress={() => handleActiveDeliveryPress(delivery)}
            >
              <View style={styles.activeDeliveryHeader}>
                <Text style={styles.activeDeliveryStatus}>
                  {getStatusText(delivery.status)}
                </Text>
                <Text style={styles.activeDeliveryFare}>
                  {formatPrice(delivery.fareDetails?.total || 0)}
                </Text>
              </View>
              <View style={styles.activeDeliveryRoute}>
                <View style={styles.locationRow}>
                  <Ionicons name="locate" size={16} color="#0066cc" />
                  <Text style={styles.locationText} numberOfLines={1}>
                    {delivery.pickupLocation?.address || 'N/A'}
                  </Text>
                </View>
                <View style={styles.routeDivider}>
                  <View style={styles.routeDividerLine} />
                </View>
                <View style={styles.locationRow}>
                  <Ionicons name="location" size={16} color="#ff6b6b" />
                  <Text style={styles.locationText} numberOfLines={1}>
                    {delivery.dropoffLocation?.address || 'N/A'}
                  </Text>
                </View>
              </View>
            </TouchableOpacity>
          ))}
        </View>
      )}

      <View style={styles.statsContainer}>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{formatPrice(stats.todayEarnings)}</Text>
          <Text style={styles.statLabel}>Today's Earnings</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{stats.todayDeliveries}</Text>
          <Text style={styles.statLabel}>Deliveries</Text>
        </View>
        <View style={styles.statCard}>
          <View style={styles.ratingContainer}>
            <Text style={styles.statValue}>{stats.rating}</Text>
            <Ionicons name="star" size={16} color="#ffc107" />
          </View>
          <Text style={styles.statLabel}>Rating</Text>
        </View>
      </View>

      <TouchableOpacity
        style={styles.weeklySummary}
        onPress={() => navigation.navigate('EarningsTab')}>
        <View>
          <Text style={styles.weeklySummaryLabel}>This Week's Earnings</Text>
          <Text style={styles.weeklySummaryValue}>{formatPrice(stats.weeklyEarnings)}</Text>
        </View>
        <Ionicons name="chevron-forward" size={20} color="#666" />
      </TouchableOpacity>

      <View style={styles.requestsContainer}>
        <Text style={styles.sectionTitle}>
          {isOnline
            ? 'Nearby Requests'
            : verificationStatus !== 'active'
              ? getVerificationStatusText()
              : 'Go Online to See Requests'}
        </Text>

        {isOnline && nearbyRequests.length === 0 && !isLoading && (
          <View style={styles.emptyRequests}>
            <Ionicons name="search-outline" size={40} color="#ccc" />
            <Text style={styles.emptyRequestsText}>No nearby requests</Text>
            <Text style={styles.emptyRequestsSubtext}>
              Pull down to refresh or wait for new requests
            </Text>
          </View>
        )}

        {!isOnline && verificationStatus === 'active' && (
          <View style={styles.goOnlinePrompt}>
            <Ionicons name="wifi-outline" size={40} color="#ccc" />
            <Text style={styles.goOnlinePromptText}>Go online to see delivery requests</Text>
            <TouchableOpacity
              style={styles.goOnlineButton}
              onPress={handleToggleOnline}>
              <Text style={styles.goOnlineButtonText}>Go Online</Text>
            </TouchableOpacity>
          </View>
        )}

        {isOnline && nearbyRequests.map((request) => (
          <TouchableOpacity
            key={request.id}
            style={styles.requestCard}
            onPress={() => handleRequestPress(request)}>
            <View style={styles.requestHeader}>
              <View style={styles.requestDistance}>
                <Ionicons name="navigate-outline" size={16} color="#0066cc" />
                <Text style={styles.requestDistanceText}>
                  {request.distance ? `${request.distance.toFixed(1)} km` : 'N/A'} • {request.estimatedTime || 'N/A'}
                </Text>
              </View>
              <Text style={styles.requestFare}>{formatPrice(request.fareDetails.total || 0)}</Text>
            </View>

            <View style={styles.requestDetails}>
              <View style={styles.locationRow}>
                <View style={styles.locationIcon}>
                  <Ionicons name="locate" size={16} color="#0066cc" />
                </View>
                <Text style={styles.locationText} numberOfLines={1}>
                  {request.pickupLocation?.address || 'N/A'}
                </Text>
              </View>
              <View style={styles.routeDivider}>
                <View style={styles.routeDividerLine} />
              </View>
              <View style={styles.locationRow}>
                <View style={styles.locationIcon}>
                  <Ionicons name="location" size={16} color="#ff6b6b" />
                </View>
                <Text style={styles.locationText} numberOfLines={1}>
                  {request.dropoffLocation?.address || 'N/A'}
                </Text>
              </View>
            </View>

            <View style={styles.requestFooter}>
              <View style={styles.packageInfo}>
                <Ionicons name="cube-outline" size={16} color="#666" />
                <Text style={styles.packageInfoText}>
                  {request.packageDetails.size === 'small' ? 'Small' :
                   request.packageDetails.size === 'medium' ? 'Medium' : 'Large'} package
                </Text>
              </View>
              {request.vehicleType && (
                <View style={styles.vehicleInfo}>
                  <Ionicons name="car-outline" size={14} color="#666" />
                  <Text style={styles.vehicleInfoText}>{request.vehicleType}</Text>
                </View>
              )}
                <Text style={styles.viewButtonText}>View</Text>
            </View>
          </TouchableOpacity>
        ))}
      </View>
    </ScrollView>
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
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.8)',
    zIndex: 10,
  },
  errorBanner: {
    backgroundColor: '#f44336',
    padding: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  errorText: {
    color: '#fff',
    flex: 1,
  },
  verificationBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    marginHorizontal: 15,
    marginTop: 10,
    marginBottom: 10,
    borderRadius: 8,
  },
  inactiveBanner: {
    backgroundColor: '#ff9800',
  },
  suspendedBanner: {
    backgroundColor: '#f44336',
  },
  verificationBannerText: {
    marginLeft: 8,
    marginTop: 15,
    flex: 1,
    fontSize: 14,
    fontWeight: '500',
  },
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#fff',
    padding: 15,
    marginHorizontal: 15,
    marginBottom: 15,
    marginTop: 40,
    borderRadius: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  statusContent: {
    flex: 1,
  },
  statusText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  statusDescription: {
    fontSize: 13,
    color: '#666',
  },
  vehicleFilterContainer: {
    backgroundColor: '#e6f2ff',
    padding: 10,
    marginHorizontal: 15,
    marginBottom: 15,
    borderRadius: 8,
    alignItems: 'center',
  },
  vehicleFilterText: {
    color: '#0066cc',
    fontSize: 14,
    fontWeight: '500',
  },
  activeDeliveriesContainer: {
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 10,
    marginHorizontal: 15,
    marginBottom: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  activeDeliveryCard: {
    borderWidth: 1,
    borderColor: '#eee',
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
  },
  activeDeliveryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  activeDeliveryStatus: {
    fontSize: 14,
    fontWeight: '500',
    color: '#2196f3',
  },
  activeDeliveryFare: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#0066cc',
  },
  activeDeliveryRoute: {
    marginBottom: 8,
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginHorizontal: 15,
    marginBottom: 15,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 15,
    alignItems: 'center',
    marginHorizontal: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  statValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 5,
  },
  statLabel: {
    fontSize: 12,
    color: '#666',
  },
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  weeklySummary: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 15,
    marginHorizontal: 15,
    marginBottom: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  weeklySummaryLabel: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  weeklySummaryValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  requestsContainer: {
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 15,
    marginHorizontal: 15,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 15,
  },
  emptyRequests: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 30,
  },
  emptyRequestsText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#666',
    marginTop: 10,
    marginBottom: 5,
  },
  emptyRequestsSubtext: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
  },
  goOnlinePrompt: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#eee',
    borderStyle: 'dashed',
  },
  goOnlinePromptText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#666',
    marginTop: 15,
    marginBottom: 20,
    textAlign: 'center',
  },
  goOnlineButton: {
    backgroundColor: '#0066cc',
    borderRadius: 8,
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  goOnlineButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  requestCard: {
    borderWidth: 1,
    borderColor: '#eee',
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
  },
  requestHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  requestDistance: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  requestDistanceText: {
    fontSize: 14,
    color: '#666',
    marginLeft: 5,
  },
  requestFare: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#0066cc',
  },
  requestDetails: {
    marginBottom: 10,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 3,
  },
  locationIcon: {
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  locationText: {
    fontSize: 14,
    color: '#333',
    flex: 1,
  },
  routeDivider: {
    paddingLeft: 12,
    height: 10,
  },
  routeDividerLine: {
    width: 1,
    height: '100%',
    backgroundColor: '#ddd',
  },
  requestFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  packageInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  packageInfoText: {
    fontSize: 13,
    color: '#666',
    marginLeft: 6,
  },
  vehicleInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 10,
  },
  vehicleInfoText: {
    fontSize: 12,
    color: '#666',
    marginLeft: 4,
    fontStyle: 'italic',
  },
  viewButtonText: {
    fontSize: 12,
    color: '#0066cc',
    fontWeight: '500',
  },
});

export default HomeScreen;