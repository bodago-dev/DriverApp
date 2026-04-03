import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Alert
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import authService from '../../services/AuthService';
import firestoreService from '../../services/FirestoreService';
import { useTranslation } from 'react-i18next';

const DeliveryHistoryScreen = ({ navigation }) => {
  const { t } = useTranslation();
  const [deliveries, setDeliveries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [driverId, setDriverId] = useState(null);
  const [activeTab, setActiveTab] = useState('all'); // 'all', 'active', 'completed'

  useEffect(() => {
    const currentUser = authService.getCurrentUser();
    if (currentUser) {
      setDriverId(currentUser.uid);
    } else {
      setLoading(false);
      Alert.alert(t('common.error'), t('delivery.history_auth_error'));
    }
  }, [t]);

  const fetchDeliveries = async () => {
    try {
      setLoading(true);
      if (!driverId) return;

      const result = await firestoreService.getUserDeliveries(driverId, 'driver');

      if (result.success) {
        let fetchedDeliveries = result.deliveries;

        // Filter based on activeTab
        if (activeTab === 'active') {
          fetchedDeliveries = fetchedDeliveries.filter(delivery =>
            ['accepted', 'arrived_pickup', 'picked_up', 'in_transit', 'arrived_dropoff'].includes(delivery.status)
          );
        } else if (activeTab === 'completed') {
          fetchedDeliveries = fetchedDeliveries.filter(delivery => delivery.status === 'delivered');
        }

        // Sort by date (newest first)
        const sortedDeliveries = fetchedDeliveries.sort((a, b) => {
          const dateA = a.createdAt?.toDate()?.getTime() || 0;
          const dateB = b.createdAt?.toDate()?.getTime() || 0;
          return dateB - dateA;
        });

        setDeliveries(sortedDeliveries);
      }
    } catch (error) {
      console.error('Error fetching deliveries:', error);
      Alert.alert(t('common.error'), t('delivery.history_error'));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    if (driverId) {
      fetchDeliveries();
    }
  }, [driverId, activeTab]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchDeliveries();
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'delivered':
        return '#4caf50';
      case 'in_transit':
      case 'accepted':
      case 'arrived_pickup':
      case 'picked_up':
      case 'arrived_dropoff':
        return '#2196f3';
      case 'cancelled':
        return '#f44336';
      default:
        return '#ff9800';
    }
  };

  const getStatusText = (status) => {
    switch (status) {
      case 'delivered':
        return t('delivery.status_delivered');
      case 'in_transit':
        return t('delivery.status_in_transit');
      case 'accepted':
        return t('delivery.status_driver_assigned');
      case 'arrived_pickup':
        return t('delivery.status_at_pickup');
      case 'picked_up':
        return t('delivery.status_picked_up');
      case 'arrived_dropoff':
        return t('delivery.status_at_destination');
      case 'cancelled':
        return t('delivery.status_cancelled');
      default:
        return status.replace('_', ' ');
    }
  };

  const handleDeliveryPress = (item) => {
    const isActiveDelivery = [
      'accepted',
      'arrived_pickup',
      'picked_up',
      'in_transit',
      'arrived_dropoff'
    ].includes(item.status);

    if (isActiveDelivery) {
      // Navigate to NavigationScreen for active deliveries
      navigation.navigate('DeliveryTab', {
        screen: 'Navigation',
        params: {
          deliveryId: item.id,
          request: {
            pickupAddress: item.pickupLocation?.name || item.pickupLocation?.address || 'N/A',
            dropoffAddress: item.dropoffLocation?.name || item.dropoffLocation?.address || 'N/A',
            packageSize: item.packageDetails?.size || 'medium',
            distance: item.distance || 'N/A',
            fare: item.fareDetails?.total || 0,
            paymentMethod: item.paymentMethod || 'M-Pesa (Paid)',
            status: item.status
          }
        }
      });
    } else {
      // Navigate to DeliveryDetailsScreen for completed/cancelled deliveries
      navigation.navigate('DeliveryTab', {
        screen: 'DeliveryDetails',
        params: {
          deliveryId: item.id,
          request: {
            pickupAddress: item.pickupLocation?.name || item.pickupLocation?.address || 'N/A',
            dropoffAddress: item.dropoffLocation?.name || item.dropoffLocation?.address || 'N/A',
            packageSize: item.packageDetails?.size || 'medium',
            distance: item.distance || 'N/A',
            fare: item.fareDetails?.total || 0,
            paymentMethod: item.paymentMethod || 'M-Pesa (Paid)',
            status: item.status
          }
        }
      });
    }
  };

  const renderDeliveryItem = ({ item }) => (
    <TouchableOpacity
      style={styles.deliveryItem}
      onPress={() => handleDeliveryPress(item)}
    >
      <View style={styles.deliveryHeader}>
        <View style={styles.statusContainer}>
          <View
            style={[
              styles.statusIndicator,
              { backgroundColor: getStatusColor(item.status) }
            ]}
          />
          <Text style={styles.statusText}>{getStatusText(item.status)}</Text>
        </View>
        <Text style={styles.deliveryFare}>TZS {(item.fareDetails?.total || 0).toLocaleString()}</Text>
      </View>

      <View style={styles.routeContainer}>
        <View style={styles.locationRow}>
          <Ionicons name="locate" size={16} color="#0066cc" />
          <Text style={styles.locationText} numberOfLines={1}>
            {item.pickupLocation?.name || item.pickupLocation?.address || 'N/A'}
          </Text>
        </View>
        <View style={styles.routeDivider}>
          <View style={styles.routeDividerLine} />
        </View>
        <View style={styles.locationRow}>
          <Ionicons name="location" size={16} color="#ff6b6b" />
          <Text style={styles.locationText} numberOfLines={1}>
            {item.dropoffLocation?.name || item.dropoffLocation?.address || 'N/A'}
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
        <Text style={styles.loadingText}>{t('delivery.history_loading')}</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Tab Selector */}
      <View style={styles.tabContainer}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'all' && styles.activeTab]}
          onPress={() => setActiveTab('all')}>
          <Text style={[styles.tabText, activeTab === 'all' && styles.activeTabText]}>
            {t('delivery.tab_all')}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'active' && styles.activeTab]}
          onPress={() => setActiveTab('active')}>
          <Text style={[styles.tabText, activeTab === 'active' && styles.activeTabText]}>
            {t('delivery.tab_active')}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'completed' && styles.activeTab]}
          onPress={() => setActiveTab('completed')}>
          <Text style={[styles.tabText, activeTab === 'completed' && styles.activeTabText]}>
            {t('delivery.tab_completed')}
          </Text>
        </TouchableOpacity>
      </View>

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
            <Text style={styles.emptyText}>{t('delivery.no_deliveries_found')}</Text>
            <Text style={styles.emptySubtext}>
              {activeTab === 'all'
                ? t('delivery.history_empty_all')
                : activeTab === 'active'
                  ? t('delivery.history_empty_active')
                  : t('delivery.history_empty_completed')}
            </Text>
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
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    paddingHorizontal: 15,
    paddingTop: 15,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  tab: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    marginHorizontal: 5,
    borderRadius: 5,
  },
  activeTab: {
    backgroundColor: '#e6f2ff',
  },
  tabText: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
  activeTabText: {
    color: '#0066cc',
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
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'capitalize',
    color: '#000',
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
