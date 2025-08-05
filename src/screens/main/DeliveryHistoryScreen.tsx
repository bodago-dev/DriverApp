import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import authService from '../../services/AuthService';
import firestoreService from '../../services/FirestoreService';

const DeliveryHistoryScreen = ({ navigation }) => {
  const [deliveries, setDeliveries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [driverId, setDriverId] = useState(null);

  useEffect(() => {
    const currentUser = authService.getCurrentUser();
    if (currentUser) {
      setDriverId(currentUser.uid);
    } else {
      setLoading(false);
    }
  }, []);

  const fetchDeliveries = async () => {
    try {
      setLoading(true);
      if (!driverId) return;

      const result = await firestoreService.getUserDeliveries(driverId, 'driver');

      if (result.success) {
        const sortedDeliveries = result.deliveries
          .sort((a, b) => {
            const dateA = a.createdAt?.toDate()?.getTime() || 0;
            const dateB = b.createdAt?.toDate()?.getTime() || 0;
            return dateB - dateA; // Newest first
          });

        setDeliveries(sortedDeliveries);
      }
    } catch (error) {
      console.error('Error fetching deliveries:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    if (driverId) {
      fetchDeliveries();
    }
  }, [driverId]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchDeliveries();
  };

  const renderDeliveryItem = ({ item }) => (
    <TouchableOpacity
      style={styles.deliveryItem}
      onPress={() => {
        navigation.navigate('DeliveryTab', {
          screen: 'DeliveryDetails',
          params: {
            deliveryId: item.id,
            request: {
              pickupAddress: item.pickupLocation?.address || 'N/A',
              dropoffAddress: item.dropoffLocation?.address || 'N/A',
              packageSize: item.packageDetails?.size || 'medium',
              distance: item.distance || 'N/A',
              fare: item.fareDetails?.total || 0,
              paymentMethod: item.paymentMethod || 'M-Pesa (Paid)',
              status: item.status
            }
          }
        });
      }}
    >
      <View style={styles.deliveryHeader}>
        <View style={styles.statusBadge}>
          <Text style={[styles.statusText,
            item.status === 'delivered' ? styles.deliveredStatus :
            item.status === 'cancelled' ? styles.cancelledStatus :
            styles.otherStatus
          ]}>
            {item.status.replace('_', ' ')}
          </Text>
        </View>
        <Text style={styles.deliveryFare}>TZS {(item.fareDetails?.total || 0).toLocaleString()}</Text>
      </View>

      <View style={styles.routeContainer}>
        <View style={styles.locationRow}>
          <Ionicons name="locate" size={16} color="#0066cc" />
          <Text style={styles.locationText} numberOfLines={1}>
            {item.pickupLocation?.address || 'N/A'}
          </Text>
        </View>
        <View style={styles.routeDivider}>
          <View style={styles.routeDividerLine} />
        </View>
        <View style={styles.locationRow}>
          <Ionicons name="location" size={16} color="#ff6b6b" />
          <Text style={styles.locationText} numberOfLines={1}>
            {item.dropoffLocation?.address || 'N/A'}
          </Text>
        </View>
      </View>

      <View style={styles.deliveryFooter}>
        <Text style={styles.deliveryId}>#{item.id.substring(0, 8)}</Text>
        <Text style={styles.deliveryDate}>
          {item.createdAt?.toDate().toLocaleDateString()} • {item.createdAt?.toDate().toLocaleTimeString() || 'N/A'}
        </Text>
      </View>
    </TouchableOpacity>
  );

  if (loading && !refreshing) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#0066cc" />
        <Text style={styles.loadingText}>Loading your deliveries...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={deliveries}
        renderItem={renderDeliveryItem}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.listContainer}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={['#0066cc']}
          />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="time-outline" size={48} color="#ccc" />
            <Text style={styles.emptyText}>No deliveries found</Text>
            <Text style={styles.emptySubtext}>Your delivery history will appear here</Text>
          </View>
        }
      />
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
  },
  loadingText: {
    marginTop: 15,
    fontSize: 16,
    color: '#666',
  },
  listContainer: {
    padding: 15,
  },
  deliveryItem: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 15,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  deliveryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    backgroundColor: '#f0f0f0',
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  deliveredStatus: {
    color: '#4caf50',
  },
  cancelledStatus: {
    color: '#f44336',
  },
  otherStatus: {
    color: '#ff9800',
  },
  deliveryFare: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#0066cc',
  },
  routeContainer: {
    marginBottom: 8,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 2,
  },
  locationText: {
    fontSize: 14,
    color: '#333',
    marginLeft: 8,
    flex: 1,
  },
  routeDivider: {
    paddingLeft: 8,
    height: 10,
  },
  routeDividerLine: {
    width: 1,
    height: '100%',
    backgroundColor: '#ddd',
    marginLeft: 8,
  },
  deliveryFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
  },
  deliveryId: {
    fontSize: 12,
    color: '#666',
  },
  deliveryDate: {
    fontSize: 12,
    color: '#666',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginTop: 20,
    marginBottom: 5,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
  },
});

export default DeliveryHistoryScreen;