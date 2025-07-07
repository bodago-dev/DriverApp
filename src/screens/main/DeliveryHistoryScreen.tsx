import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { getAuth } from '@react-native-firebase/auth';
import firestoreService from '../../services/FirestoreService';

const DeliveryHistoryScreen = ({ navigation }) => {
  const [deliveries, setDeliveries] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchDeliveries = async () => {
      try {
        const auth = getAuth();
        const user = auth.currentUser;
        if (user) {
          const result = await firestoreService.getUserDeliveries(user.uid, 'driver');
          if (result.success) {
            setDeliveries(result.deliveries);
          }
        }
      } catch (error) {
        console.error('Error fetching deliveries:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchDeliveries();
  }, []);

  const renderDeliveryItem = ({ item }) => (
    <TouchableOpacity
      style={styles.deliveryItem}
      onPress={() => navigation.navigate('DeliveryStatus', {
        deliveryId: item.id,
        request: {
          pickupAddress: item.pickupAddress,
          dropoffAddress: item.dropoffAddress,
          packageSize: item.packageSize,
          distance: item.distance,
          fare: item.fare
        }
      })}>
      <View style={styles.deliveryHeader}>
        <Text style={styles.deliveryId}>Order #{item.id}</Text>
        <Text style={styles.deliveryFare}>TZS {item.fare?.toLocaleString()}</Text>
      </View>
      <View style={styles.routeContainer}>
        <View style={styles.locationRow}>
          <Ionicons name="locate" size={16} color="#0066cc" />
          <Text style={styles.locationText} numberOfLines={1}>
            {item.pickupAddress}
          </Text>
        </View>
        <View style={styles.routeDivider}>
          <View style={styles.routeDividerLine} />
        </View>
        <View style={styles.locationRow}>
          <Ionicons name="location" size={16} color="#ff6b6b" />
          <Text style={styles.locationText} numberOfLines={1}>
            {item.dropoffAddress}
          </Text>
        </View>
      </View>
      <Text style={styles.deliveryDate}>
        {item.createdAt?.toDate().toLocaleDateString()}
      </Text>
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#0066cc" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {deliveries.length > 0 ? (
        <FlatList
          data={deliveries}
          renderItem={renderDeliveryItem}
          keyExtractor={item => item.id}
          contentContainerStyle={styles.listContainer}
        />
      ) : (
        <View style={styles.emptyContainer}>
          <Ionicons name="time-outline" size={48} color="#ccc" />
          <Text style={styles.emptyText}>No delivery history yet</Text>
        </View>
      )}
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
    marginBottom: 10,
  },
  deliveryId: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
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
  deliveryDate: {
    fontSize: 12,
    color: '#666',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 16,
    color: '#666',
    marginTop: 10,
  },
});

export default DeliveryHistoryScreen;