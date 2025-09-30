import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
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
  const [mapKey, setMapKey] = useState(0);

  // Use actual coordinates from the request if available
  const pickupCoordinates = request.pickupLocation?.coordinates || {
    latitude: -6.7924,
    longitude: 39.2083,
  };

  const dropoffCoordinates = request.dropoffLocation?.coordinates || {
    latitude: -6.8124,
    longitude: 39.2583,
  };

  // Calculate the initial region
  const initialRegion = calculateMapRegion(pickupCoordinates, dropoffCoordinates);

  console.log('Pickup Coordinates:', pickupCoordinates);
  console.log('Dropoff Coordinates:', dropoffCoordinates);
  console.log('Initial Region:', initialRegion);

  // Validate coordinates
  if (!pickupCoordinates || !dropoffCoordinates) {
    console.error('Invalid coordinates received');
  }

  // Update map key when coordinates change
  useEffect(() => {
    setMapKey(prev => prev + 1); // Force remount when coordinates change
  }, [pickupCoordinates, dropoffCoordinates]);

  // Fit map to markers when coordinates change
  useEffect(() => {
    const timer = setTimeout(() => {
      if (mapRef.current && pickupCoordinates && dropoffCoordinates) {
        console.log('Fitting to coordinates...');
        mapRef.current.fitToCoordinates([pickupCoordinates, dropoffCoordinates], {
          edgePadding: { top: 100, right: 100, bottom: 100, left: 100 },
          animated: true,
        });
      }
    }, 500); // Small delay to ensure map is ready

    return () => clearTimeout(timer);
  }, [pickupCoordinates, dropoffCoordinates, request.id]);

  // Countdown timer for request expiration
  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => {
        setCountdown(countdown - 1);
      }, 3000);

      return () => clearTimeout(timer);
    } else {
      // Request expired
      Alert.alert(
        'Request Expired',
        'This delivery request has expired.',
        [
          {
            text: 'OK',
            onPress: () => navigation.goBack(),
          },
        ]
      );
    }
  }, [countdown]);

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

      // 4. Navigate to NavigationScreen with the correct delivery ID
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
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Decline',
          style: 'destructive',
          onPress: () => navigation.goBack(),
        },
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
        key={`map-${request.id}`}
        ref={mapRef}
        provider={PROVIDER_GOOGLE}
        style={styles.map}
        initialRegion={initialRegion}
        onMapReady={() => {
            console.log('Map ready');
            setMapReady(true);
        }}
        onLayout={() => {
            console.log('Map layout completed');
            setMapReady(true);
        }}
      >
        {mapReady && (
            <>
              {/* Markers and polyline */}
              <Marker
                coordinate={pickupCoordinates}
                title="Pickup"
                description={request.pickupLocation?.address || request.pickupAddress}
              >
                <View style={[styles.markerContainer, { backgroundColor: '#e6f2ff' }]}>
                  <Ionicons name="locate" size={16} color="#0066cc" />
                </View>
              </Marker>

              {/* Dropoff Marker */}
              <Marker
                coordinate={dropoffCoordinates}
                title="Dropoff"
                description={request.dropoffLocation?.address || request.dropoffAddress}
              >
                <View style={[styles.markerContainer, { backgroundColor: '#ffebee' }]}>
                  <Ionicons name="location" size={16} color="#ff6b6b" />
                </View>
              </Marker>

              {/* Route Line */}
              <Polyline
                coordinates={[pickupCoordinates, dropoffCoordinates]}
                strokeWidth={3}
                strokeColor="#0066cc"
              />
            </>
        )}

      </MapView>

      {/* Countdown Timer */}
      <View style={styles.countdownContainer}>
        <Text style={styles.countdownText}>Request expires in: {countdown}s</Text>
      </View>

      {/* Request Details */}
      <ScrollView style={styles.detailsContainer}>
        <View style={styles.fareContainer}>
          <Text style={styles.fareLabel}>Delivery Fare</Text>
          <Text style={styles.fareValue}>{formatPrice(request.fareDetails?.total || request.fare)}</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Route</Text>
          <View style={styles.routeInfo}>
            <View style={styles.locationRow}>
              <View style={styles.locationIcon}>
                <Ionicons name="locate" size={16} color="#0066cc" />
              </View>
              <Text style={styles.locationText} numberOfLines={1}>
                {request.pickupLocation?.address || request.pickupAddress}
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
                {request.dropoffLocation?.address || request.dropoffAddress}
              </Text>
            </View>
          </View>

          <View style={styles.routeDetails}>
            <View style={styles.routeDetailItem}>
              <Ionicons name="navigate-outline" size={16} color="#666" />
              <Text style={styles.routeDetailText}>
                {request.distance} km
              </Text>
            </View>
            <View style={styles.routeDetailItem}>
              <Ionicons name="time-outline" size={16} color="#666" />
              <Text style={styles.routeDetailText}>
                {request.estimatedTime}
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Package Details</Text>
          <View style={styles.packageDetails}>
            <View style={styles.packageDetailItem}>
              <Text style={styles.packageDetailLabel}>Size</Text>
              <Text style={styles.packageDetailValue}>
                {request.packageDetails?.size === 'small' ? 'Small' :
                 request.packageDetails?.size === 'medium' ? 'Medium' : 'Large'}
              </Text>
            </View>
            <View style={styles.packageDetailItem}>
              <Text style={styles.packageDetailLabel}>Payment Method</Text>
              <Text style={styles.packageDetailValue}>{request.paymentMethod || 'M-Pesa (Paid)'}</Text>
            </View>
          </View>
        </View>

        <View style={styles.actionsContainer}>
          <TouchableOpacity
            style={styles.declineButton}
            onPress={handleDecline}>
            <Text style={styles.declineButtonText}>Decline</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.acceptButton, isLoading && styles.disabledButton]}
            onPress={handleAccept}
            disabled={isLoading}>
            <Text style={styles.acceptButtonText}>
              {isLoading ? 'Accepting...' : 'Accept'}
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  map: {
    height: '40%',
  },
  markerContainer: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 2,
  },
  countdownContainer: {
    position: 'absolute',
    top: 10,
    left: 10,
    right: 10,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    borderRadius: 20,
    paddingVertical: 6,
    paddingHorizontal: 12,
    alignItems: 'center',
    zIndex: 1,
  },
  countdownText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 14,
  },
  detailsContainer: {
    flex: 1,
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    marginTop: -20,
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  fareContainer: {
    alignItems: 'center',
    marginBottom: 20,
  },
  fareLabel: {
    fontSize: 14,
    color: '#666',
    marginBottom: 5,
  },
  fareValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#0066cc',
  },
  card: {
    backgroundColor: '#f9f9f9',
    borderRadius: 10,
    padding: 15,
    marginBottom: 15,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
  },
  routeInfo: {
    marginBottom: 10,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 5,
  },
  locationIcon: {
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  locationText: {
    fontSize: 14,
    color: '#333',
    flex: 1,
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
  routeDetails: {
    flexDirection: 'row',
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#eee',
  },
  routeDetailItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 20,
  },
  routeDetailText: {
    fontSize: 14,
    color: '#666',
    marginLeft: 5,
  },
  packageDetails: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  packageDetailItem: {
    width: '50%',
    marginBottom: 10,
  },
  packageDetailLabel: {
    fontSize: 12,
    color: '#666',
    marginBottom: 4,
  },
  packageDetailValue: {
    fontSize: 14,
    color: '#333',
  },
  actionsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 10,
    marginBottom: 30,
  },
  declineButton: {
    flex: 1,
    backgroundColor: '#f8f9fa',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    paddingVertical: 12,
    marginRight: 10,
    alignItems: 'center',
  },
  declineButtonText: {
    color: '#666',
    fontSize: 16,
    fontWeight: '600',
  },
  acceptButton: {
    flex: 2,
    backgroundColor: '#0066cc',
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
  },
  disabledButton: {
    backgroundColor: '#99ccff',
  },
  acceptButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default DeliveryRequestScreen;