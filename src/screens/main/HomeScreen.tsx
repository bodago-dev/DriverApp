import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  Switch,
  Alert,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import firestoreService from '../../services/FirestoreService';
import authService from '../../services/AuthService';
import * as Location from 'expo-location'; // Assuming expo-location is used for driver location

const HomeScreen = ({ navigation }) => {
  const [isOnline, setIsOnline] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [stats, setStats] = useState({
    todayEarnings: 0,
    todayDeliveries: 0,
    weeklyEarnings: 0,
    rating: 0,
  });
  const [nearbyRequests, setNearbyRequests] = useState([]);
  const [driverId, setDriverId] = useState(null);
  const [driverLocation, setDriverLocation] = useState(null);
  const unsubscribeRequestsRef = useRef(null);

  useEffect(() => {
    const currentUser = authService.getCurrentUser();
    if (currentUser) {
      setDriverId(currentUser.uid);
    } else {
      setIsLoading(false);
      Alert.alert('Error', 'Driver not authenticated. Please log in.');
      // Optionally navigate to login screen
      // navigation.navigate('AuthStack');
    }
  }, []);

  useEffect(() => {
    if (driverId) {
      fetchDriverData();
      // Initial check for online status from Firestore
      const checkOnlineStatus = async () => {
        const result = await firestoreService.getDriverLocation(driverId);
        if (result.success && result.location && result.location.online) {
          setIsOnline(true);
        }
      };
      checkOnlineStatus();
    }
  }, [driverId]);

  useEffect(() => {
    if (driverId && isOnline) {
      // Start location tracking and subscribe to requests when online
      startLocationTracking();
      subscribeToDeliveryRequests();
    } else {
      // Stop location tracking and unsubscribe when offline
      stopLocationTracking();
      if (unsubscribeRequestsRef.current) {
        unsubscribeRequestsRef.current();
        unsubscribeRequestsRef.current = null;
      }
      setNearbyRequests([]); // Clear requests when offline
    }

    // Update driver online status in Firestore
    if (driverId) {
      firestoreService.setDriverOnlineStatus(driverId, isOnline);
    }

    return () => {
      if (unsubscribeRequestsRef.current) {
        unsubscribeRequestsRef.current();
      }
    };
  }, [driverId, isOnline]);

  const fetchDriverData = async () => {
    setIsLoading(true);
    try {
      const profileResult = await firestoreService.getUserProfile(driverId);
      if (profileResult.success && profileResult.userProfile) {
        // Assuming stats like rating are part of the driver profile
        setStats(prev => ({
          ...prev,
          rating: profileResult.userProfile.rating || 0,
        }));
      }

      // Fetch deliveries for earnings and count
      const deliveriesResult = await firestoreService.getUserDeliveries(driverId, 'driver');
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
            // Today's earnings and deliveries
            if (deliveryDate.toDateString() === today.toDateString() && delivery.status === 'delivered') {
              todayEarnings += delivery.fareDetails?.total || 0;
              todayDeliveries++;
            }

            // Weekly earnings (simple last 7 days check)
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

  const startLocationTracking = async () => {
    let { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission Denied', 'Location access needed to receive requests.');
      setIsOnline(false);
      return;
    }

    // Start background location updates if needed, or just foreground for now
    Location.watchPositionAsync(
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

  const stopLocationTracking = () => {
    // In a real app, you'd stop the watchPositionAsync subscription
    // For simplicity, we'll just stop updating Firestore when offline
  };

  const subscribeToDeliveryRequests = () => {
    if (unsubscribeRequestsRef.current) {
      unsubscribeRequestsRef.current(); // Unsubscribe from previous listener
    }
    unsubscribeRequestsRef.current = firestoreService.subscribeToDeliveryRequests(
      driverLocation, // Pass current driver location for distance filtering
      (requests) => {
        setNearbyRequests(requests);
      }
    );
  };

  const handleRefresh = () => {
    setRefreshing(true);
    fetchDriverData();
    if (isOnline) {
      subscribeToDeliveryRequests(); // Re-subscribe to refresh requests
    }
  };

  const handleToggleOnline = () => {
    const newStatus = !isOnline;
    setIsOnline(newStatus);
    if (newStatus) {
      Alert.alert('You are now online', 'You will receive delivery requests in your area.');
    } else {
      Alert.alert('You are now offline', 'You will not receive any delivery requests.');
    }
  };

  const handleRequestPress = (request) => {
    navigation.navigate('DeliveryRequest', { request });
  };

  const formatPrice = (price) => {
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
      {/* Online Status Toggle */}
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
        />
      </View>

      {/* Today's Stats */}
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

      {/* Weekly Summary */}
      <TouchableOpacity
        style={styles.weeklySummary}
        onPress={() => navigation.navigate('EarningsTab')}>
        <View>
          <Text style={styles.weeklySummaryLabel}>This Week's Earnings</Text>
          <Text style={styles.weeklySummaryValue}>{formatPrice(stats.weeklyEarnings)}</Text>
        </View>
        <Ionicons name="chevron-forward" size={20} color="#666" />
      </TouchableOpacity>

      {/* Nearby Requests */}
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
              <Text style={styles.requestFare}>{formatPrice(request.fare || 0)}</Text>
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
                  {request.packageSize === 'small' ? 'Small' :
                   request.packageSize === 'medium' ? 'Medium' : 'Large'} package
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
  viewButton: {
    backgroundColor: '#e6f2ff',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 4,
  },
  viewButtonText: {
    fontSize: 12,
    color: '#0066cc',
    fontWeight: '500',
  },
});

export default HomeScreen;
