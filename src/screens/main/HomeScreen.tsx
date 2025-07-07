import React, { useState, useEffect } from 'react';
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
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';

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

  // Fetch driver data
  useEffect(() => {
    fetchDriverData();
  }, []);

  const fetchDriverData = () => {
    setIsLoading(true);
    
    // Simulate API call to fetch driver data
    setTimeout(() => {
      setStats({
        todayEarnings: 25000,
        todayDeliveries: 5,
        weeklyEarnings: 150000,
        rating: 4.8,
      });
      
      // Generate mock nearby requests if driver is online
      if (isOnline) {
        generateMockRequests();
      } else {
        setNearbyRequests([]);
      }
      
      setIsLoading(false);
      setRefreshing(false);
    }, 1500);
  };

  const generateMockRequests = () => {
    const mockRequests = [
      {
        id: 'REQ1001',
        pickupAddress: 'Mlimani City Mall',
        dropoffAddress: 'Kariakoo Market',
        distance: 5.2,
        estimatedTime: '15 min',
        packageSize: 'small',
        fare: 4500,
      },
      {
        id: 'REQ1002',
        pickupAddress: 'Julius Nyerere International Airport',
        dropoffAddress: 'Masaki Peninsula',
        distance: 12.8,
        estimatedTime: '35 min',
        packageSize: 'medium',
        fare: 9500,
      },
      {
        id: 'REQ1003',
        pickupAddress: 'University of Dar es Salaam',
        dropoffAddress: 'Mbezi Beach',
        distance: 8.5,
        estimatedTime: '25 min',
        packageSize: 'small',
        fare: 6500,
      },
    ];
    
    setNearbyRequests(mockRequests);
  };

  const handleRefresh = () => {
    setRefreshing(true);
    fetchDriverData();
  };

  const handleToggleOnline = () => {
    const newStatus = !isOnline;
    setIsOnline(newStatus);
    
    if (newStatus) {
      // If going online, generate mock requests
      generateMockRequests();
      Alert.alert('You are now online', 'You will receive delivery requests in your area.');
    } else {
      // If going offline, clear requests
      setNearbyRequests([]);
      Alert.alert('You are now offline', 'You will not receive any delivery requests.');
    }
  };

  const handleRequestPress = (request) => {
    navigation.navigate('DeliveryRequest', { request });
  };

  const formatPrice = (price) => {
    return `TZS ${price.toLocaleString()}`;
  };

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
                  {request.distance} km • {request.estimatedTime}
                </Text>
              </View>
              <Text style={styles.requestFare}>{formatPrice(request.fare)}</Text>
            </View>
            
            <View style={styles.requestDetails}>
              <View style={styles.locationRow}>
                <View style={styles.locationIcon}>
                  <Ionicons name="locate" size={16} color="#0066cc" />
                </View>
                <Text style={styles.locationText} numberOfLines={1}>
                  {request.pickupAddress}
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
                  {request.dropoffAddress}
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
