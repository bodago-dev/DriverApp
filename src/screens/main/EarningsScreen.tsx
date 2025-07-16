import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  Alert,
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import firestoreService from '../../services/FirestoreService';
import authService from '../../services/AuthService';

const EarningsScreen = ({ navigation }) => {
  const [isLoading, setIsLoading] = useState(true);
  const [selectedPeriod, setSelectedPeriod] = useState('today');
  const [earningsData, setEarningsData] = useState({
    today: {
      total: 0,
      deliveries: 0,
      tips: 0,
      hours: 0,
    },
    week: {
      total: 0,
      deliveries: 0,
      tips: 0,
      hours: 0,
    },
    month: {
      total: 0,
      deliveries: 0,
      tips: 0,
      hours: 0,
    },
  });
  const [recentDeliveries, setRecentDeliveries] = useState([]);
  const [driverId, setDriverId] = useState(null);

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
      fetchEarningsData();
    }
  }, [driverId]);

  const fetchEarningsData = async () => {
    setIsLoading(true);
    try {
      const deliveriesResult = await firestoreService.getUserDeliveries(driverId, 'driver');
      if (deliveriesResult.success) {
        const allDeliveries = deliveriesResult.deliveries.filter(d => d.status === 'delivered');

        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const startOfWeek = new Date(today);
        startOfWeek.setDate(today.getDate() - today.getDay()); // Sunday as start of week
        startOfWeek.setHours(0, 0, 0, 0);

        const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
        startOfMonth.setHours(0, 0, 0, 0);

        let todayTotal = 0;
        let todayDeliveriesCount = 0;
        let todayTips = 0;
        let todayHours = 0; // This would require more complex tracking

        let weekTotal = 0;
        let weekDeliveriesCount = 0;
        let weekTips = 0;
        let weekHours = 0;

        let monthTotal = 0;
        let monthDeliveriesCount = 0;
        let monthTips = 0;
        let monthHours = 0;

        const sortedDeliveries = allDeliveries.sort((a, b) => b.createdAt.toDate().getTime() - a.createdAt.toDate().getTime());

        sortedDeliveries.forEach(delivery => {
          const deliveryDate = delivery.createdAt?.toDate();
          const fare = delivery.fareDetails?.total || 0;
          const tip = delivery.fareDetails?.tip || 0;

          if (deliveryDate) {
            // Today
            if (deliveryDate.toDateString() === today.toDateString()) {
              todayTotal += fare;
              todayDeliveriesCount++;
              todayTips += tip;
            }

            // This Week
            if (deliveryDate >= startOfWeek) {
              weekTotal += fare;
              weekDeliveriesCount++;
              weekTips += tip;
            }

            // This Month
            if (deliveryDate >= startOfMonth) {
              monthTotal += fare;
              monthDeliveriesCount++;
              monthTips += tip;
            }
          }
        });

        setEarningsData({
          today: { total: todayTotal, deliveries: todayDeliveriesCount, tips: todayTips, hours: todayHours },
          week: { total: weekTotal, deliveries: weekDeliveriesCount, tips: weekTips, hours: weekHours },
          month: { total: monthTotal, deliveries: monthDeliveriesCount, tips: monthTips, hours: monthHours },
        });
        setRecentDeliveries(sortedDeliveries.slice(0, 10)); // Show top 10 recent deliveries

      } else {
        Alert.alert('Error', deliveriesResult.error || 'Failed to fetch deliveries');
      }
    } catch (error) {
      console.error('Error fetching earnings data:', error);
      Alert.alert('Error', 'An unexpected error occurred while fetching earnings data.');
    } finally {
      setIsLoading(false);
    }
  };

  const formatPrice = (price) => {
    return `TZS ${price.toLocaleString()}`;
  };

  const getCurrentPeriodData = () => {
    return earningsData[selectedPeriod];
  };

  const renderDeliveryItem = ({ item }) => (
    <TouchableOpacity
      style={styles.deliveryItem}
      onPress={() => navigation.navigate('DeliveryDetails', { deliveryId: item.id })}>
      <View style={styles.deliveryItemHeader}>
        <Text style={styles.deliveryItemId}>{item.id}</Text>
        <Text style={styles.deliveryItemAmount}>{formatPrice(item.fareDetails?.total || 0)}</Text>
      </View>

      <View style={styles.deliveryItemDetails}>
        <View style={styles.locationRow}>
          <View style={styles.locationIcon}>
            <Ionicons name="locate" size={14} color="#0066cc" />
          </View>
          <Text style={styles.locationText} numberOfLines={1}>
            {item.pickupLocation?.address || 'N/A'}
          </Text>
        </View>
        <View style={styles.routeDivider}>
          <View style={styles.routeDividerLine} />
        </View>
        <View style={styles.locationRow}>
          <View style={styles.locationIcon}>
            <Ionicons name="location" size={14} color="#ff6b6b" />
          </View>
          <Text style={styles.locationText} numberOfLines={1}>
            {item.dropoffLocation?.address || 'N/A'}
          </Text>
        </View>
      </View>

      <Text style={styles.deliveryItemTime}>{item.createdAt?.toDate().toLocaleDateString()} • {item.createdAt?.toDate().toLocaleTimeString()}</Text>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      {/* Period Selector */}
      <View style={styles.periodSelector}>
        <TouchableOpacity
          style={[styles.periodTab, selectedPeriod === 'today' && styles.activePeriodTab]}
          onPress={() => setSelectedPeriod('today')}>
          <Text
            style={[
              styles.periodTabText,
              selectedPeriod === 'today' && styles.activePeriodTabText
            ]}>
            Today
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.periodTab, selectedPeriod === 'week' && styles.activePeriodTab]}
          onPress={() => setSelectedPeriod('week')}>
          <Text
            style={[
              styles.periodTabText,
              selectedPeriod === 'week' && styles.activePeriodTabText
            ]}>
            This Week
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.periodTab, selectedPeriod === 'month' && styles.activePeriodTab]}
          onPress={() => setSelectedPeriod('month')}>
          <Text
            style={[
              styles.periodTabText,
              selectedPeriod === 'month' && styles.activePeriodTabText
            ]}>
            This Month
          </Text>
        </TouchableOpacity>
      </View>

      {/* Earnings Summary */}
      <View style={styles.earningsSummary}>
        <Text style={styles.totalEarningsLabel}>Total Earnings</Text>
        <Text style={styles.totalEarningsValue}>
          {formatPrice(getCurrentPeriodData().total)}
        </Text>

        <View style={styles.earningsStats}>
          <View style={styles.statItem}>
            <Ionicons name="cube-outline" size={20} color="#0066cc" />
            <Text style={styles.statValue}>{getCurrentPeriodData().deliveries}</Text>
            <Text style={styles.statLabel}>Deliveries</Text>
          </View>
          <View style={styles.statItem}>
            <Ionicons name="cash-outline" size={20} color="#4caf50" />
            <Text style={styles.statValue}>{formatPrice(getCurrentPeriodData().tips)}</Text>
            <Text style={styles.statLabel}>Tips</Text>
          </View>
          <View style={styles.statItem}>
            <Ionicons name="time-outline" size={20} color="#ff9800" />
            <Text style={styles.statValue}>{getCurrentPeriodData().hours} hrs</Text>
            <Text style={styles.statLabel}>Online Time</Text>
          </View>
        </View>
      </View>

      {/* Recent Deliveries */}
      <View style={styles.recentDeliveriesContainer}>
        <Text style={styles.sectionTitle}>Recent Deliveries</Text>

        {isLoading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#0066cc" />
            <Text style={styles.loadingText}>Loading deliveries...</Text>
          </View>
        ) : recentDeliveries.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Ionicons name="cube-outline" size={60} color="#ccc" />
            <Text style={styles.emptyText}>No deliveries found</Text>
            <Text style={styles.emptySubtext}>You haven't completed any deliveries yet.</Text>
          </View>
        ) : (
          <FlatList
            data={recentDeliveries}
            renderItem={renderDeliveryItem}
            keyExtractor={item => item.id}
            contentContainerStyle={styles.deliveriesList}
          />
        )}
      </View>

      {/* Cashout Button */}
      <TouchableOpacity style={styles.cashoutButton}>
        <Ionicons name="wallet-outline" size={20} color="#fff" />
        <Text style={styles.cashoutButtonText}>Cash Out</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  periodSelector: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    paddingHorizontal: 15,
    paddingTop: 15,
    paddingBottom: 10,
  },
  periodTab: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    marginHorizontal: 5,
    borderRadius: 5,
  },
  activePeriodTab: {
    backgroundColor: '#e6f2ff',
  },
  periodTabText: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
  activePeriodTabText: {
    color: '#0066cc',
  },
  earningsSummary: {
    backgroundColor: '#fff',
    padding: 20,
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  totalEarningsLabel: {
    fontSize: 14,
    color: '#666',
    marginBottom: 5,
  },
  totalEarningsValue: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 15,
  },
  earningsStats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    width: '100%',
  },
  statItem: {
    alignItems: 'center',
  },
  statValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginTop: 5,
    marginBottom: 2,
  },
  statLabel: {
    fontSize: 12,
    color: '#666',
  },
  recentDeliveriesContainer: {
    flex: 1,
    backgroundColor: '#fff',
    marginTop: 15,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 14,
    color: '#666',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginTop: 20,
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
  },
  deliveriesList: {
    paddingBottom: 80, // Space for cashout button
  },
  deliveryItem: {
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  deliveryItemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  deliveryItemId: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333',
  },
  deliveryItemAmount: {
    fontSize: 14,
    fontWeight: '600',
    color: '#0066cc',
  },
  deliveryItemDetails: {
    marginBottom: 8,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 2,
  },
  locationIcon: {
    width: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  locationText: {
    fontSize: 13,
    color: '#333',
    flex: 1,
  },
  routeDivider: {
    paddingLeft: 10,
    height: 8,
  },
  routeDividerLine: {
    width: 1,
    height: '100%',
    backgroundColor: '#ddd',
  },
  deliveryItemTime: {
    fontSize: 12,
    color: '#999',
  },
  cashoutButton: {
    position: 'absolute',
    bottom: 20,
    left: 20,
    right: 20,
    backgroundColor: '#0066cc',
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
  },
  cashoutButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
});

export default EarningsScreen;