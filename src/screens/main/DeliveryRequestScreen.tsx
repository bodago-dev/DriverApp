import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Dimensions,
  ActivityIndicator,
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from 'react-native-maps';
import {
  getFirestore,
  collection,
  query,
  where,
  limit,
  getDocs
} from '@react-native-firebase/firestore';
import firestoreService from '../../services/FirestoreService';
import authService from '../../services/AuthService';

const { width, height } = Dimensions.get('window');

type DeliveryRequest = {
  id: string;
  pickupAddress: string;
  dropoffAddress: string;
  packageSize: 'small' | 'medium' | 'large';
  distance: string;
  fare: number;
  estimatedTime: string;
  pickupLocation?: {
    coordinates: {
      latitude: number;
      longitude: number;
    };
    address: string;
  };
  dropoffLocation?: {
    coordinates: {
      latitude: number;
      longitude: number;
    };
    address: string;
  };
  packageDetails?: {
    size: 'small' | 'medium' | 'large';
  };
  fareDetails?: {
    total: number;
  };
  paymentMethod?: string;
};

// Helper function to calculate optimal map region
const calculateMapRegion = (pickupCoords: any, dropoffCoords: any) => {
  if (!pickupCoords || !dropoffCoords) {
    return {
      latitude: -6.7924, // Default to Dar es Salaam
      longitude: 39.2083,
      latitudeDelta: 0.0922,
      longitudeDelta: 0.0421,
    };
  }

  // Calculate min/max coordinates
  const minLat = Math.min(pickupCoords.latitude, dropoffCoords.latitude);
  const maxLat = Math.max(pickupCoords.latitude, dropoffCoords.latitude);
  const minLon = Math.min(pickupCoords.longitude, dropoffCoords.longitude);
  const maxLon = Math.max(pickupCoords.longitude, dropoffCoords.longitude);

  // Calculate center point
  const centerLat = (minLat + maxLat) / 2;
  const centerLon = (minLon + maxLon) / 2;

  // Calculate deltas with padding
  const latDelta = (maxLat - minLat) * 1.5; // Add 50% padding
  const lonDelta = (maxLon - minLon) * 1.5; // Add 50% padding

  // Ensure minimum deltas to prevent zooming too far in
  const minDelta = 0.01;
  return {
    latitude: centerLat,
    longitude: centerLon,
    latitudeDelta: Math.max(minDelta, latDelta),
    longitudeDelta: Math.max(minDelta, lonDelta),
  };
};

const DeliveryRequestScreen = ({ route, navigation }: {
  route: { params: { request: DeliveryRequest } };
  navigation: any;
}) => {
  const { request } = route.params;
  const [isLoading, setIsLoading] = useState(false);
  const [countdown, setCountdown] = useState(100);
  const mapRef = React.useRef<MapView>(null);
  const [mapReady, setMapReady] = useState(false);

  // Use useMemo to prevent unnecessary recalculations
  const pickupCoordinates = useMemo(() =>
    request.pickupLocation?.coordinates || {
      latitude: -6.7924,
      longitude: 39.2083,
    }, [request.pickupLocation?.coordinates]);

  const dropoffCoordinates = useMemo(() =>
    request.dropoffLocation?.coordinates || {
      latitude: -6.8124,
      longitude: 39.2583,
    }, [request.dropoffLocation?.coordinates]);

  // Calculate the initial region only once using useMemo
  const initialRegion = useMemo(() =>
    calculateMapRegion(pickupCoordinates, dropoffCoordinates),
    [pickupCoordinates, dropoffCoordinates]
  );

  // Fit map to markers only once when map is ready and coordinates are available
  const fitMapToCoordinates = useCallback(() => {
    if (mapRef.current && pickupCoordinates && dropoffCoordinates) {
      console.log('Fitting to coordinates...');
      mapRef.current.fitToCoordinates([pickupCoordinates, dropoffCoordinates], {
        edgePadding: { top: 100, right: 100, bottom: 100, left: 100 },
        animated: true,
      });
    }
  }, [pickupCoordinates, dropoffCoordinates]);

  // Countdown timer for request expiration
  useEffect(() => {
    const countdownInterval = setInterval(() => {
      setCountdown(prevCountdown => {
        if (prevCountdown <= 1) {
          clearInterval(countdownInterval);
          Alert.alert(
            'Request Expired',
            'This delivery request has expired.',
            [{ text: 'OK', onPress: () => navigation.goBack() }]
          );
          return 0;
        }
        return prevCountdown - 1;
      });
    }, 1000);

    return () => clearInterval(countdownInterval);
  }, [navigation]);

  const handleAccept = async () => {
    setIsLoading(true);

    try {
      const currentUser = authService.getCurrentUser();
      if (!currentUser) {
        throw new Error('User not authenticated');
      }

      const db = getFirestore();

      // 1. Find the existing delivery document for this request
      const deliveriesQuery = query(
        collection(db, 'deliveries'),
        where('requestId', '==', request.id),
        limit(1)
      );

      const querySnapshot = await getDocs(deliveriesQuery);

      if (querySnapshot.empty) {
        throw new Error('No delivery found for this request');
      }

      const deliveryDoc = querySnapshot.docs[0];
      const deliveryId = deliveryDoc.id;

      // 2. Update the delivery request status and assign driver
      const updateRequestResult = await firestoreService.updateDeliveryRequestStatus(
        request.id,
        'accepted',
        currentUser.uid
      );

      if (!updateRequestResult.success) {
        throw new Error(updateRequestResult.error || 'Failed to update request status');
      }

      // 3. Update the delivery document with driver assignment
      const updateDeliveryResult = await firestoreService.updateDeliveryStatus(
        deliveryId,
        'accepted',
        {
            driverId: currentUser.uid,
            requestId: request.id
        }
      );

      if (!updateDeliveryResult.success) {
        throw new Error(updateDeliveryResult.error || 'Failed to update delivery status');
      }

      // 4. Navigate to NavigationScreen
      navigation.replace('Navigation', {
        deliveryId: deliveryId,
        request: {
          ...request,
          pickupAddress: request.pickupLocation?.address || request.pickupAddress,
          dropoffAddress: request.dropoffLocation?.address || request.dropoffAddress,
          packageSize: request.packageDetails?.size || request.packageSize,
          fare: request.fareDetails?.total || request.fare,
          distance: request.distance?.toFixed(1) || 'N/A',
        },
        pickupCoordinates: pickupCoordinates,
        dropoffCoordinates: dropoffCoordinates,
      });

    } catch (error) {
      console.error('Error accepting request:', error);
      Alert.alert('Error', error.message || 'Failed to accept delivery request');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDecline = () => {
    Alert.alert(
      'Decline Request',
      'Are you sure you want to decline this delivery request?',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Decline', style: 'destructive', onPress: () => navigation.goBack() },
      ]
    );
  };

  const formatPrice = (price: number) => {
    return `TZS ${price.toLocaleString()}`;
  };

  return (
    <View style={styles.container}>
      {/* Map View */}
      <MapView
        ref={mapRef}
        provider={PROVIDER_GOOGLE}
        style={styles.map}
        initialRegion={initialRegion}
        onMapReady={() => {
          console.log('🗺️ DeliveryRequestScreen - Map ready');
          setMapReady(true);
          setTimeout(fitMapToCoordinates, 500);
        }}
      >
        <Marker coordinate={pickupCoordinates} title="Pickup">
          <View style={styles.markerContainer}>
            <Ionicons name="locate" size={20} color="#FFFFFF" />
          </View>
        </Marker>

        <Marker coordinate={dropoffCoordinates} title="Dropoff">
          <View style={[styles.markerContainer, { backgroundColor: '#ff6b6b' }]}>
            <Ionicons name="location" size={20} color="#FFFFFF" />
          </View>
        </Marker>

        <Polyline
          coordinates={[pickupCoordinates, dropoffCoordinates]}
          strokeWidth={3}
          strokeColor="#0066cc"
          lineDashPattern={[5, 5]}
        />
      </MapView>

      {/* Request Details Panel */}
      <View style={styles.detailsPanel}>
        <View style={styles.header}>
          <Text style={styles.title}>New Delivery Request</Text>
          <View style={styles.timerContainer}>
            <Text style={styles.timerText}>{countdown}s</Text>
          </View>
        </View>

        <ScrollView showsVerticalScrollIndicator={false}>
          <View style={styles.locationContainer}>
            <View style={styles.locationItem}>
              <View style={[styles.dot, { backgroundColor: '#0066cc' }]} />
              <View style={styles.locationTextContainer}>
                <Text style={styles.locationLabel}>Pickup</Text>
                <Text style={styles.locationText} numberOfLines={2}>
                  {request.pickupLocation?.name || request.pickupLocation?.address || request.pickupAddress}
                </Text>
              </View>
            </View>
            <View style={styles.line} />
            <View style={styles.locationItem}>
              <View style={[styles.dot, { backgroundColor: '#ff6b6b' }]} />
              <View style={styles.locationTextContainer}>
                <Text style={styles.locationLabel}>Dropoff</Text>
                <Text style={styles.locationText} numberOfLines={2}>
                  {request.dropoffLocation?.name || request.dropoffLocation?.address || request.dropoffAddress}
                </Text>
              </View>
            </View>
          </View>

          <View style={styles.infoGrid}>
            <View style={styles.infoItem}>
              <Ionicons name="resize" size={20} color="#666" />
              <Text style={styles.infoLabel}>Size</Text>
              <Text style={styles.infoValue}>
                {(request.packageDetails?.size || request.packageSize).charAt(0).toUpperCase() + (request.packageDetails?.size || request.packageSize).slice(1)}
              </Text>
            </View>
            <View style={styles.infoItem}>
              <Ionicons name="map" size={20} color="#666" />
              <Text style={styles.infoLabel}>Distance</Text>
              <Text style={styles.infoValue}>{request.distance?.toFixed(1) || 'N/A'} km</Text>
            </View>
            <View style={styles.infoItem}>
              <Ionicons name="cash" size={20} color="#666" />
              <Text style={styles.infoLabel}>Fare</Text>
              <Text style={styles.infoValue}>{formatPrice(request.fareDetails?.total || request.fare)}</Text>
            </View>
          </View>

          <View style={styles.paymentContainer}>
            <Text style={styles.paymentLabel}>Payment Method</Text>
            <View style={styles.paymentMethod}>
              <Ionicons name="card" size={20} color="#0066cc" />
              <Text style={styles.paymentText}>{request.paymentMethod || 'M-Pesa (Paid)'}</Text>
            </View>
          </View>
        </ScrollView>

        <View style={styles.actionButtons}>
          <TouchableOpacity
            style={styles.declineButton}
            onPress={handleDecline}
            disabled={isLoading}
          >
            <Text style={styles.declineText}>Decline</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.acceptButton}
            onPress={handleAccept}
            disabled={isLoading}
          >
            {isLoading ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.acceptText}>Accept Request</Text>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  map: {
    flex: 1,
  },
  markerContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#0066cc',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  detailsPanel: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 25,
    borderTopRightRadius: 25,
    padding: 20,
    maxHeight: '55%',
    elevation: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -10 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  timerContainer: {
    backgroundColor: '#FFF0F0',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: '#FFDADA',
  },
  timerText: {
    color: '#FF4B4B',
    fontWeight: 'bold',
    fontSize: 14,
  },
  locationContainer: {
    marginBottom: 20,
  },
  locationItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  dot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginTop: 5,
    marginRight: 15,
  },
  locationTextContainer: {
    flex: 1,
  },
  locationLabel: {
    fontSize: 12,
    color: '#999',
    marginBottom: 2,
  },
  locationText: {
    fontSize: 15,
    color: '#333',
    fontWeight: '500',
    lineHeight: 20,
  },
  line: {
    width: 2,
    height: 30,
    backgroundColor: '#F0F0F0',
    marginLeft: 5,
    marginVertical: 5,
  },
  infoGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: '#F8F9FA',
    borderRadius: 15,
    padding: 15,
    marginBottom: 20,
  },
  infoItem: {
    alignItems: 'center',
    flex: 1,
  },
  infoLabel: {
    fontSize: 11,
    color: '#999',
    marginTop: 5,
    marginBottom: 2,
  },
  infoValue: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#333',
  },
  paymentContainer: {
    marginBottom: 25,
  },
  paymentLabel: {
    fontSize: 14,
    color: '#999',
    marginBottom: 10,
  },
  paymentMethod: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0F7FF',
    padding: 12,
    borderRadius: 12,
  },
  paymentText: {
    marginLeft: 10,
    fontSize: 15,
    color: '#0066cc',
    fontWeight: '600',
  },
  actionButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  declineButton: {
    flex: 0.35,
    paddingVertical: 15,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#EEEEEE',
    alignItems: 'center',
  },
  declineText: {
    color: '#666',
    fontSize: 16,
    fontWeight: '600',
  },
  acceptButton: {
    flex: 0.6,
    backgroundColor: '#0066cc',
    paddingVertical: 15,
    borderRadius: 12,
    alignItems: 'center',
    elevation: 3,
    shadowColor: '#0066cc',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
  },
  acceptText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
});

export default DeliveryRequestScreen;
