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
      checkOnlineStatus();
    }
  }, [driverId]);

  useEffect(() => {
    if (driverId && isOnline) {
      const startTracking = async () => {
        const hasPermission = await requestLocationPermission();
        if (!hasPermission) {
          setIsOnline(false);
          return;
        }
        await startLocationTracking();
      };
      startTracking();
    } else {
      stopLocationTracking();
      if (unsubscribeRequestsRef.current) {
        unsubscribeRequestsRef.current();
        unsubscribeRequestsRef.current = null;
      }
      setNearbyRequests([]);
    }

    if (driverId) {
      firestoreService.setDriverOnlineStatus(driverId, isOnline);
    }

    return () => {
      if (unsubscribeRequestsRef.current) {
        unsubscribeRequestsRef.current();
      }
      stopLocationTracking();
    };
  }, [driverId, isOnline]);

  const checkOnlineStatus = async () => {
    const result = await firestoreService.getDriverLocation(driverId!);
    if (result.success && result.location && result.location.online) {
      setIsOnline(false);
    }
  };

  const fetchDriverData = async () => {
    setIsLoading(true);
    try {
      const profileResult = await firestoreService.getUserProfile(driverId!);
      if (profileResult.success && profileResult.userProfile) {
        setStats(prev => ({
          ...prev,
          rating: profileResult.userProfile.rating || 0,
        }));
      }

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

      // Now setup delivery request subscription
      // Use the initialLocation directly since we know it's available
      setupDeliverySubscription(initialLocation);
    } catch (error) {
      console.error('Location tracking failed:', error);
      setLocationError(error.message || 'Failed to start tracking');
      setIsOnline(false);
    } finally {
      setIsLocationLoading(false);
    }
  };

  // Separate function for setting up the subscription
  const setupDeliverySubscription = (location: {latitude: number, longitude: number}) => {
    console.log('Setting up delivery subscription with location:', location);

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

  const stopLocationTracking = () => {
    if (watchId.current !== null) {
      Geolocation.clearWatch(watchId.current);
      watchId.current = null;
    }
  };

  const handleRefresh = () => {
    setRefreshing(true);
    fetchDriverData();
    if (isOnline && driverLocation) {
      subscribeToDeliveryRequests();
    }
  };

  const handleToggleOnline = async () => {
    if (isLocationLoading) return;

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

      <View style={styles.statusContainer}>
        <View style={styles.statusContent}>
          <Text style={styles.statusText}>
            {isOnline ? 'You are online' : 'You are offline'}
          </Text>
          <Text style={styles.statusDescription}>
            {isOnline
              ? 'You are receiving delivery requests'
              : 'Go online to receive delivery requests'}
          </Text>
        </View>
        <Switch
          trackColor={{ false: '#ccc', true: '#4caf50' }}
          thumbColor={isOnline ? '#fff' : '#f4f3f4'}
          ios_backgroundColor="#ccc"
          onValueChange={handleToggleOnline}
          value={isOnline}
          disabled={isLocationLoading}
        />
      </View>

      {isLocationLoading && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color="#0066cc" />
          <Text style={styles.loadingText}>Getting your location...</Text>
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
          {isOnline ? 'Nearby Requests' : 'Go Online to See Requests'}
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
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#fff',
    padding: 15,
    marginBottom: 15,
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
    margin: 15,
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
  viewButtonText: {
    fontSize: 12,
    color: '#0066cc',
    fontWeight: '500',
  },
});

export default HomeScreen;