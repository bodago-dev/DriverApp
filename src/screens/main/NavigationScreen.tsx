import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  BackHandler,
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from 'react-native-maps';

const NavigationScreen = ({ route, navigation }) => {
  const { deliveryId, request, pickupCoordinates, dropoffCoordinates } = route.params;
  
  const [currentStep, setCurrentStep] = useState('to_pickup'); // to_pickup, arrived_pickup, to_dropoff, arrived_dropoff
  const [driverLocation, setDriverLocation] = useState({
    latitude: pickupCoordinates.latitude - 0.01,
    longitude: pickupCoordinates.longitude - 0.01,
  });
  const [eta, setEta] = useState('10 min');
  const [isLoading, setIsLoading] = useState(false);
  
  // Handle back button to prevent accidental navigation away
  useEffect(() => {
    const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
      Alert.alert(
        'Cancel Delivery?',
        'Are you sure you want to cancel this delivery? This may affect your rating.',
        [
          {
            text: 'No, Continue',
            style: 'cancel',
            onPress: () => {},
          },
          {
            text: 'Yes, Cancel',
            style: 'destructive',
            onPress: () => {
              navigation.goBack();
              return true;
            },
          },
        ]
      );
      return true;
    });
    
    return () => backHandler.remove();
  }, []);
  
  // Simulate driver movement
  useEffect(() => {
    if (currentStep === 'to_pickup') {
      // Simulate driver moving to pickup location
      const interval = setInterval(() => {
        setDriverLocation(prev => ({
          latitude: prev.latitude + (pickupCoordinates.latitude - prev.latitude) * 0.2,
          longitude: prev.longitude + (pickupCoordinates.longitude - prev.longitude) * 0.2,
        }));
        
        // Check if driver is close to pickup
        const distance = Math.sqrt(
          Math.pow(driverLocation.latitude - pickupCoordinates.latitude, 2) +
          Math.pow(driverLocation.longitude - pickupCoordinates.longitude, 2)
        );
        
        if (distance < 0.001) {
          clearInterval(interval);
          setEta('Arrived');
        } else {
          const remainingMinutes = Math.ceil(distance * 1000);
          setEta(`${remainingMinutes} min`);
        }
      }, 2000);
      
      return () => clearInterval(interval);
    } else if (currentStep === 'to_dropoff') {
      // Simulate driver moving to dropoff location
      const interval = setInterval(() => {
        setDriverLocation(prev => ({
          latitude: prev.latitude + (dropoffCoordinates.latitude - prev.latitude) * 0.2,
          longitude: prev.longitude + (dropoffCoordinates.longitude - prev.longitude) * 0.2,
        }));
        
        // Check if driver is close to dropoff
        const distance = Math.sqrt(
          Math.pow(driverLocation.latitude - dropoffCoordinates.latitude, 2) +
          Math.pow(driverLocation.longitude - dropoffCoordinates.longitude, 2)
        );
        
        if (distance < 0.001) {
          clearInterval(interval);
          setEta('Arrived');
        } else {
          const remainingMinutes = Math.ceil(distance * 1000);
          setEta(`${remainingMinutes} min`);
        }
      }, 2000);
      
      return () => clearInterval(interval);
    }
  }, [currentStep, driverLocation]);

  const handleNextStep = () => {
    setIsLoading(true);
    
    // Simulate API call to update delivery status
    setTimeout(() => {
      setIsLoading(false);
      
      if (currentStep === 'to_pickup') {
        setCurrentStep('arrived_pickup');
        setEta('Waiting for pickup');
      } else if (currentStep === 'arrived_pickup') {
        setCurrentStep('to_dropoff');
        setEta('15 min');
      } else if (currentStep === 'to_dropoff') {
        setCurrentStep('arrived_dropoff');
        setEta('Delivery complete');
      } else if (currentStep === 'arrived_dropoff') {
        // Navigate to delivery status screen for completion
        navigation.replace('DeliveryStatus', {
          deliveryId,
          request,
        });
      }
    }, 1500);
  };

  const getActionButtonText = () => {
    switch (currentStep) {
      case 'to_pickup':
        return 'Arrived at Pickup';
      case 'arrived_pickup':
        return 'Package Picked Up';
      case 'to_dropoff':
        return 'Arrived at Dropoff';
      case 'arrived_dropoff':
        return 'Complete Delivery';
      default:
        return 'Next';
    }
  };

  const getStepTitle = () => {
    switch (currentStep) {
      case 'to_pickup':
        return 'Navigating to Pickup';
      case 'arrived_pickup':
        return 'At Pickup Location';
      case 'to_dropoff':
        return 'Navigating to Dropoff';
      case 'arrived_dropoff':
        return 'At Dropoff Location';
      default:
        return 'Navigation';
    }
  };

  const getStepInstructions = () => {
    switch (currentStep) {
      case 'to_pickup':
        return 'Follow the route to the pickup location';
      case 'arrived_pickup':
        return 'Collect the package from the sender';
      case 'to_dropoff':
        return 'Follow the route to the dropoff location';
      case 'arrived_dropoff':
        return 'Deliver the package to the recipient';
      default:
        return '';
    }
  };

  const getMapRegion = () => {
    if (currentStep === 'to_pickup' || currentStep === 'arrived_pickup') {
      return {
        latitude: (driverLocation.latitude + pickupCoordinates.latitude) / 2,
        longitude: (driverLocation.longitude + pickupCoordinates.longitude) / 2,
        latitudeDelta: 0.02,
        longitudeDelta: 0.02,
      };
    } else {
      return {
        latitude: (driverLocation.latitude + dropoffCoordinates.latitude) / 2,
        longitude: (driverLocation.longitude + dropoffCoordinates.longitude) / 2,
        latitudeDelta: 0.02,
        longitudeDelta: 0.02,
      };
    }
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
        region={getMapRegion()}>
        {/* Driver Marker */}
        <Marker
          coordinate={driverLocation}
          title="You"
          description="Your current location">
          <View style={[styles.markerContainer, { backgroundColor: '#0066cc' }]}>
            <Ionicons 
              name={
                request.vehicleType === 'boda' ? 'bicycle' : 
                request.vehicleType === 'tuktuk' ? 'car' : 'car-sport'
              } 
              size={16} 
              color="#fff" 
            />
          </View>
        </Marker>
        
        {/* Pickup Marker */}
        <Marker
          coordinate={pickupCoordinates}
          title="Pickup"
          description={request.pickupAddress}>
          <View style={[
            styles.markerContainer, 
            { 
              backgroundColor: (currentStep === 'to_pickup' || currentStep === 'arrived_pickup') 
                ? '#e6f2ff' 
                : '#ccc'
            }
          ]}>
            <Ionicons 
              name="locate" 
              size={16} 
              color={(currentStep === 'to_pickup' || currentStep === 'arrived_pickup') 
                ? '#0066cc' 
                : '#666'} 
            />
          </View>
        </Marker>
        
        {/* Dropoff Marker */}
        <Marker
          coordinate={dropoffCoordinates}
          title="Dropoff"
          description={request.dropoffAddress}>
          <View style={[
            styles.markerContainer, 
            { 
              backgroundColor: (currentStep === 'to_dropoff' || currentStep === 'arrived_dropoff') 
                ? '#ffebee' 
                : '#ccc'
            }
          ]}>
            <Ionicons 
              name="location" 
              size={16} 
              color={(currentStep === 'to_dropoff' || currentStep === 'arrived_dropoff') 
                ? '#ff6b6b' 
                : '#666'} 
            />
          </View>
        </Marker>
        
        {/* Route Line */}
        {currentStep === 'to_pickup' || currentStep === 'arrived_pickup' ? (
          <Polyline
            coordinates={[driverLocation, pickupCoordinates]}
            strokeWidth={3}
            strokeColor="#0066cc"
          />
        ) : (
          <Polyline
            coordinates={[driverLocation, dropoffCoordinates]}
            strokeWidth={3}
            strokeColor="#0066cc"
          />
        )}
      </MapView>
      
      {/* Navigation Panel */}
      <View style={styles.navigationPanel}>
        <View style={styles.navigationHeader}>
          <Text style={styles.navigationTitle}>{getStepTitle()}</Text>
          <View style={styles.etaContainer}>
            <Ionicons name="time-outline" size={16} color="#0066cc" />
            <Text style={styles.etaText}>{eta}</Text>
          </View>
        </View>
        
        <Text style={styles.navigationInstructions}>{getStepInstructions()}</Text>
        
        <View style={styles.addressContainer}>
          <View style={styles.addressCard}>
            {(currentStep === 'to_pickup' || currentStep === 'arrived_pickup') ? (
              <>
                <Text style={styles.addressLabel}>Pickup Location</Text>
                <Text style={styles.addressText}>{request.pickupAddress}</Text>
              </>
            ) : (
              <>
                <Text style={styles.addressLabel}>Dropoff Location</Text>
                <Text style={styles.addressText}>{request.dropoffAddress}</Text>
              </>
            )}
          </View>
        </View>
        
        <View style={styles.deliveryInfo}>
          <View style={styles.deliveryInfoItem}>
            <Text style={styles.deliveryInfoLabel}>Order ID</Text>
            <Text style={styles.deliveryInfoValue}>{deliveryId}</Text>
          </View>
          <View style={styles.deliveryInfoItem}>
            <Text style={styles.deliveryInfoLabel}>Package</Text>
            <Text style={styles.deliveryInfoValue}>
              {request.packageSize === 'small' ? 'Small' : 
               request.packageSize === 'medium' ? 'Medium' : 'Large'}
            </Text>
          </View>
          <View style={styles.deliveryInfoItem}>
            <Text style={styles.deliveryInfoLabel}>Fare</Text>
            <Text style={styles.deliveryInfoValue}>{formatPrice(request.fare)}</Text>
          </View>
        </View>
        
        <TouchableOpacity
          style={[styles.actionButton, isLoading && styles.actionButtonDisabled]}
          onPress={handleNextStep}
          disabled={isLoading}>
          <Text style={styles.actionButtonText}>
            {isLoading ? 'Processing...' : getActionButtonText()}
          </Text>
        </TouchableOpacity>
        
        <View style={styles.contactContainer}>
          <TouchableOpacity style={styles.contactButton}>
            <Ionicons name="call" size={20} color="#0066cc" />
            <Text style={styles.contactButtonText}>Call Customer</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.contactButton}>
            <Ionicons name="chatbubble" size={20} color="#0066cc" />
            <Text style={styles.contactButtonText}>Message</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  map: {
    height: '60%',
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
  navigationPanel: {
    flex: 1,
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    marginTop: -20,
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  navigationHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  navigationTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  etaContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#e6f2ff',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 15,
  },
  etaText: {
    fontSize: 14,
    color: '#0066cc',
    fontWeight: '500',
    marginLeft: 5,
  },
  navigationInstructions: {
    fontSize: 14,
    color: '#666',
    marginBottom: 15,
  },
  addressContainer: {
    marginBottom: 15,
  },
  addressCard: {
    backgroundColor: '#f9f9f9',
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: '#eee',
  },
  addressLabel: {
    fontSize: 12,
    color: '#666',
    marginBottom: 4,
  },
  addressText: {
    fontSize: 14,
    color: '#333',
    fontWeight: '500',
  },
  deliveryInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  deliveryInfoItem: {
    alignItems: 'center',
  },
  deliveryInfoLabel: {
    fontSize: 12,
    color: '#666',
    marginBottom: 4,
  },
  deliveryInfoValue: {
    fontSize: 14,
    color: '#333',
    fontWeight: '500',
  },
  actionButton: {
    backgroundColor: '#0066cc',
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: 'center',
    marginBottom: 15,
  },
  actionButtonDisabled: {
    backgroundColor: '#99ccff',
  },
  actionButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  contactContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  contactButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#e6f2ff',
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 15,
    flex: 1,
    marginHorizontal: 5,
  },
  contactButtonText: {
    color: '#0066cc',
    fontSize: 14,
    fontWeight: '500',
    marginLeft: 8,
  },
});

export default NavigationScreen;
