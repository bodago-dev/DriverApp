// DeliveryDetailsScreen.tsx
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  ActivityIndicator,
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import firestoreService from '../../services/FirestoreService';
import { useTranslation } from 'react-i18next';

const formatPrice = (price: number) => {
  return `TZS ${price.toLocaleString()}`;
};

const DeliveryDetailsScreen = ({ route, navigation }) => {
  const { t } = useTranslation();
  const { deliveryId } = route.params;
  const [delivery, setDelivery] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchDeliveryDetails = async () => {
      try {
        const result = await firestoreService.getDelivery(deliveryId);
        if (result.success) {
          setDelivery(result.delivery);
        } else {
          console.error('Failed to fetch delivery details:', result.error);
        }
      } catch (error) {
        console.error('Error fetching delivery details:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchDeliveryDetails();
  }, [deliveryId]);

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#0066cc" />
        <Text style={styles.loadingText}>{t('delivery.details_loading')}</Text>
      </View>
    );
  }

  if (!delivery) {
    return (
      <View style={styles.container}>
        <Text style={styles.errorText}>{t('delivery.details_error')}</Text>
      </View>
    );
  }

  const getStatusText = (status) => {
    if (!status) return 'Unknown';

    const statusMap = {
      'pending': t('delivery.status_pending'),
      'searching': t('delivery.status_searching'),
      'accepted': t('delivery.status_accepted'),
      'arrived_pickup': t('delivery.status_at_pickup'),
      'picked_up': t('delivery.status_picked_up'),
      'in_transit': t('delivery.status_in_transit'),
      'arrived_dropoff': t('delivery.status_at_destination'),
      'delivered': t('delivery.status_delivered'),
      'cancelled': t('delivery.status_cancelled'),
      'failed': t('delivery.status_failed'),
      'driver_assigned': t('delivery.status_driver_assigned')
    };

    // Fallback to capitalize and replace underscores if not found in map
    return statusMap[status] || status.charAt(0).toUpperCase() + status.slice(1).replace('_', ' ');
  };

  const getStatusColor = (status) => {
    if (!status) return '#666';

    const colorMap = {
      'pending': '#ff9800',
      'searching': '#2196f3',
      'accepted': '#4caf50',
      'arrived_pickup': '#4caf50',
      'picked_up': '#4caf50',
      'in_transit': '#2196f3',
      'arrived_dropoff': '#4caf50',
      'delivered': '#4caf50',
      'cancelled': '#f44336',
      'failed': '#f44336'
    };

    return colorMap[status] || '#666';
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>{t('delivery.details')}</Text>
        <Text style={styles.deliveryId}>Order #{delivery.id?.substring(0, 8) || 'N/A'}</Text>
      </View>

      <View style={styles.statusContainer}>
        <View style={[styles.statusIndicator, { backgroundColor: getStatusColor(delivery.status) }]} />
        <Text style={styles.statusText}>{getStatusText(delivery.status)}</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>{t('delivery.route')}</Text>
        <View style={styles.routeInfo}>
          <View style={styles.locationRow}>
            <Ionicons name="locate" size={16} color="#0066cc" />
            <Text style={styles.locationText}>
              {delivery.pickupLocation?.name || delivery.pickupLocation?.address || t('home.pickup')}
            </Text>
          </View>
          <View style={styles.routeDivider}>
            <View style={styles.routeDividerLine} />
          </View>
          <View style={styles.locationRow}>
            <Ionicons name="location" size={16} color="#ff6b6b" />
            <Text style={styles.locationText}>
              {delivery.dropoffLocation?.name || delivery.dropoffLocation?.address || t('home.dropoff')}
            </Text>
          </View>
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>{t('delivery.package_details')}</Text>
        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>{t('delivery.package_type')}</Text>
          <Text style={styles.detailValue}>{delivery.packageDetails?.description || 'N/A'}</Text>
        </View>
        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>{t('delivery.size')}</Text>
          <Text style={styles.detailValue}>
            {delivery.packageDetails?.size === 'small' ? t('delivery.size_small') :
             delivery.packageDetails?.size === 'medium' ? t('delivery.size_medium') : t('delivery.size_large')}
          </Text>
        </View>
        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>{t('delivery.weight')}</Text>
          <Text style={styles.detailValue}>
            {delivery.packageDetails?.weight === 'small' ? t('delivery.weight_light') :
             delivery.packageDetails?.weight === 'medium' ? t('delivery.weight_medium') : t('delivery.weight_heavy')}
          </Text>
        </View>
        {delivery.packageDetails?.specialInstructions && (
          <View style={styles.specialInstructionsContainer}>
            <Text style={styles.detailLabel}>{t('delivery.special_instructions')}</Text>
            <Text style={styles.specialInstructionsText}>
              {delivery.packageDetails.specialInstructions}
            </Text>
          </View>
        )}
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>{t('delivery.delivery_info')}</Text>
        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>{t('delivery.vehicle')}</Text>
          <Text style={styles.detailValue}>
            {delivery.selectedVehicle?.name || 'N/A'}
          </Text>
        </View>
        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>{t('delivery.requested_at')}</Text>
          <Text style={styles.detailValue}>
            {delivery.createdAt?.toDate().toLocaleString() || 'N/A'}
          </Text>
        </View>
        {delivery.timeline?.delivered && (
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>{t('delivery.delivered_at')}</Text>
            <Text style={styles.detailValue}>
              {delivery.timeline.delivered.toDate().toLocaleString()}
            </Text>
          </View>
        )}
      </View>

      <View style={styles.bottomCard}>
        <Text style={styles.cardTitle}>{t('delivery.payment')}</Text>
        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>{t('delivery.payment_method')}</Text>
          <Text style={styles.detailValue}>
            {delivery.paymentMethod === 'cash' ? t('delivery.paid_cash') :
             delivery.paymentMethod === 'mpesa' ? 'M-Pesa' :
             delivery.paymentMethod === 'airtelmoney' ? 'Airtel Money' :
             delivery.paymentMethod === 'mixx' ? 'Mixx by Yas' : 'N/A'}
          </Text>
        </View>
        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>{t('delivery.total_fare')}</Text>
          <Text style={styles.detailValue}>
            {formatPrice(delivery.fareDetails?.total || 0)}
          </Text>
        </View>
        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>{t('delivery.service_fee')}</Text>
          <Text style={[styles.detailValue, { color: '#ff6b6b' }]}>
            -{formatPrice(delivery.fareDetails?.serviceFee || 0)}
          </Text>
        </View>
        <View style={[styles.detailRow, { marginTop: 5, borderTopWidth: 1, borderTopColor: '#eee', paddingTop: 10 }]}>
          <Text style={[styles.detailLabel, { fontWeight: 'bold', color: '#333' }]}>{t('delivery.your_earnings')}</Text>
          <Text style={[styles.detailValue, { fontWeight: 'bold', color: '#4caf50', fontSize: 16 }]}>
            {formatPrice((delivery.fareDetails?.total || 0) - (delivery.fareDetails?.serviceFee || 0))}
          </Text>
        </View>
      </View>

      {delivery.rating && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>{t('delivery.your_rating')}</Text>
          <View style={styles.ratingContainer}>
            {[1, 2, 3, 4, 5].map((star) => (
              <Ionicons
                key={star}
                name={star <= delivery.rating ? "star" : "star-outline"}
                size={24}
                color="#ffc107"
              />
            ))}
          </View>
        </View>
      )}
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
  errorText: {
    fontSize: 16,
    color: '#f44336',
    textAlign: 'center',
    marginTop: 20,
  },
  header: {
    padding: 20,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#333',
  },
  deliveryId: {
    fontSize: 14,
    color: '#666',
    marginTop: 5,
  },
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 15,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  statusIndicator: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 8,
  },
  statusText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333', // Add explicit color
    flex: 1,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 15,
    margin: 15,
    marginBottom: 0,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },

  bottomCard: {
      backgroundColor: '#fff',
      borderRadius: 8,
      padding: 15,
      margin: 15,
      marginBottom: 5,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.1,
      shadowRadius: 2,
      elevation: 2,
    },

  cardTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
  },
  routeInfo: {
    marginBottom: 10,
    marginRight: 2,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 5,
  },
  locationText: {
    fontSize: 14,
    color: '#333',
    marginLeft: 8,
  },
  routeDivider: {
    paddingLeft: 12,
    height: 15,
  },
  routeDividerLine: {
    width: 1,
    height: '100%',
    backgroundColor: '#ddd',
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  detailLabel: {
    fontSize: 14,
    color: '#666',
  },
  detailValue: {
    fontSize: 14,
    color: '#333',
    fontWeight: '500',
  },
  ratingContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 10,
  },
  specialInstructionsContainer: {
      marginBottom: 10,
  },
  specialInstructionsText: {
    fontSize: 14,
    color: '#333',
    fontWeight: '500',
    marginTop: 5,
    lineHeight: 20, // Better readability with line height
  },
});

export default DeliveryDetailsScreen;
