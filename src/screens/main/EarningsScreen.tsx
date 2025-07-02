import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  FlatList,
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';

const EarningsScreen = ({ navigation }) => {
  const [isLoading, setIsLoading] = useState(true);
  const [selectedPeriod, setSelectedPeriod] = useState('today');
  const [earningsData, setEarningsData] = useState({
    today: {
      total: 25000,
      deliveries: 5,
      tips: 2000,
      hours: 6.5,
    },
    week: {
      total: 150000,
      deliveries: 32,
      tips: 12000,
      hours: 38,
    },
    month: {
      total: 620000,
      deliveries: 124,
      tips: 45000,
      hours: 160,
    },
  });
  
  const [recentDeliveries, setRecentDeliveries] = useState([]);

  // Fetch earnings data
  useEffect(() => {
    // Simulate API call to fetch earnings data
    setTimeout(() => {
      // Generate mock recent deliveries
      const mockDeliveries = [
        {
          id: 'DEL1001',
          date: '2025-06-07',
          time: '14:30',
          pickupAddress: 'Mlimani City Mall',
          dropoffAddress: 'Kariakoo Market',
          amount: 4500,
        },
        {
          id: 'DEL1002',
          date: '2025-06-07',
          time: '12:15',
          pickupAddress: 'Julius Nyerere International Airport',
          dropoffAddress: 'Masaki Peninsula',
          amount: 9500,
        },
        {
          id: 'DEL1003',
          date: '2025-06-07',
          time: '09:45',
          pickupAddress: 'University of Dar es Salaam',
          dropoffAddress: 'Mbezi Beach',
          amount: 6500,
        },
        {
          id: 'DEL1004',
          date: '2025-06-06',
          time: '16:20',
          pickupAddress: 'Kariakoo Market',
          dropoffAddress: 'Mikocheni',
          amount: 5500,
        },
        {
          id: 'DEL1005',
          date: '2025-06-06',
          time: '11:10',
          pickupAddress: 'Ubungo Bus Terminal',
          dropoffAddress: 'University of Dar es Salaam',
          amount: 3500,
        },
      ];
      
      setRecentDeliveries(mockDeliveries);
      setIsLoading(false);
    }, 1500);
  }, []);

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
        <Text style={styles.deliveryItemAmount}>{formatPrice(item.amount)}</Text>
      </View>
      
      <View style={styles.deliveryItemDetails}>
        <View style={styles.locationRow}>
          <View style={styles.locationIcon}>
            <Ionicons name="locate" size={14} color="#0066cc" />
          </View>
          <Text style={styles.locationText} numberOfLines={1}>
            {item.pickupAddress}
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
            {item.dropoffAddress}
          </Text>
        </View>
      </View>
      
      <Text style={styles.deliveryItemTime}>{item.date} • {item.time}</Text>
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
            <Text style={styles.loadingText}>Loading deliveries...</Text>
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
