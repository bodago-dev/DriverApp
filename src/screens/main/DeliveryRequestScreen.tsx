import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  Alert,
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';

const DeliveryRequestScreen = ({ route, navigation }) => {
  const { request } = route.params;
  const [isLoading, setIsLoading] = useState(false);
  const [countdown, setCountdown] = useState(30);
  
  // Countdown timer for request expiration
  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => {
        setCountdown(countdown - 1);
      }, 1000);
      
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

  // Mock coordinates for map
  const pickupCoordinates = {
    latitude: -6.7924,
    longitude: 39.2083,
  };
  
  const dropoffCoordinates = {
    latitude: -6.8124,
    longitude: 39.2583,
  };

  const handleAccept = () => {
    setIsLoading(true);
    
    // Simulate API call to accept request
    setTimeout(() => {
      setIsLoading(false);
      
      // Navigate to navigation screen
      navigation.replace('Navigation', {
        deliveryId: `DEL${Math.floor(Math.random() * 10000)}`,
        request,
        pickupCoordinates,
        dropoffCoordinates,
      });
    }, 1500);
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

  const formatPrice = (price) => {
    return `TZS ${price.toLocaleString()}`;
  };

  return (
    <View style={styles.container}>
      {/* Map View */}
      <MapView
        provider={PROVIDER_GOOGLE}
        style={styles.map}
        initialRegion={{
          latitude: (pickupCoordinates.latitude + dropoffCoordinates.latitude) / 2,
          longitude: (pickupCoordinates.longitude + dropoffCoordinates.longitude) / 2,
          latitudeDelta: 0.05,
          longitudeDelta: 0.05,
        }}>
        {/* Pickup Marker */}
        <Marker
          coordinate={pickupCoordinates}
          title="Pickup"
          description={request.pickupAddress}>
          <View style={[styles.markerContainer, { backgroundColor: '#e6f2ff' }]}>
            <Ionicons name="locate" size={16} color="#0066cc" />
          </View>
        </Marker>
        
        {/* Dropoff Marker */}
        <Marker
          coordinate={dropoffCoordinates}
          title="Dropoff"
          description={request.dropoffAddress}>
          <View style={[styles.markerContainer, { backgroundColor: '#ffebee' }]}>
            <Ionicons name="location" size={16} color="#ff6b6b" />
          </View>
        </Marker>
      </MapView>
      
      {/* Countdown Timer */}
      <View style={styles.countdownContainer}>
        <Text style={styles.countdownText}>Request expires in: {countdown}s</Text>
      </View>
      
      {/* Request Details */}
      <ScrollView style={styles.detailsContainer}>
        <View style={styles.fareContainer}>
          <Text style={styles.fareLabel}>Delivery Fare</Text>
          <Text style={styles.fareValue}>{formatPrice(request.fare)}</Text>
        </View>
        
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Route</Text>
          <View style={styles.routeInfo}>
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
                {request.packageSize === 'small' ? 'Small' : 
                 request.packageSize === 'medium' ? 'Medium' : 'Large'}
              </Text>
            </View>
            <View style={styles.packageDetailItem}>
              <Text style={styles.packageDetailLabel}>Payment Method</Text>
              <Text style={styles.packageDetailValue}>M-Pesa (Paid)</Text>
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
