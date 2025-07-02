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

const DeliveryStatusScreen = ({ route, navigation }) => {
  const { deliveryId, request } = route.params;
  
  const [isLoading, setIsLoading] = useState(false);
  const [deliveryCompleted, setDeliveryCompleted] = useState(false);
  const [photoTaken, setPhotoTaken] = useState(false);
  const [signatureCollected, setSignatureCollected] = useState(false);
  
  const handleTakePhoto = () => {
    // In a real app, this would open the camera
    // For demo purposes, we'll simulate taking a photo
    Alert.alert(
      'Take Photo',
      'Take a photo of the delivered package',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Take Photo',
          onPress: () => {
            // Simulate photo capture
            setTimeout(() => {
              setPhotoTaken(true);
            }, 1000);
          },
        },
      ]
    );
  };

  const handleCollectSignature = () => {
    // In a real app, this would open a signature pad
    // For demo purposes, we'll simulate collecting a signature
    Alert.alert(
      'Collect Signature',
      'Ask the recipient to sign on the screen',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Collect Signature',
          onPress: () => {
            // Simulate signature collection
            setTimeout(() => {
              setSignatureCollected(true);
            }, 1000);
          },
        },
      ]
    );
  };

  const handleCompleteDelivery = () => {
    if (!photoTaken || !signatureCollected) {
      Alert.alert(
        'Incomplete Delivery',
        'Please take a photo and collect signature to complete the delivery.',
      );
      return;
    }

    setIsLoading(true);
    
    // Simulate API call to complete delivery
    setTimeout(() => {
      setIsLoading(false);
      setDeliveryCompleted(true);
      
      // Show success message
      Alert.alert(
        'Delivery Completed',
        'The delivery has been successfully completed!',
        [
          {
            text: 'OK',
            onPress: () => {
              // Navigate back to home screen
              navigation.reset({
                index: 0,
                routes: [{ name: 'Home' }],
              });
            },
          },
        ]
      );
    }, 2000);
  };

  const formatPrice = (price) => {
    return `TZS ${price.toLocaleString()}`;
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Delivery Status</Text>
        <Text style={styles.orderId}>Order #{deliveryId}</Text>
      </View>
      
      <View style={styles.card}>
        <View style={styles.statusContainer}>
          <View style={styles.statusIconContainer}>
            <Ionicons name="checkmark-circle" size={40} color="#4caf50" />
          </View>
          <View style={styles.statusTextContainer}>
            <Text style={styles.statusTitle}>Arrived at Destination</Text>
            <Text style={styles.statusDescription}>
              You have arrived at the delivery location. Complete the delivery by following the steps below.
            </Text>
          </View>
        </View>
      </View>
      
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Delivery Location</Text>
        <Text style={styles.locationText}>{request.dropoffAddress}</Text>
      </View>
      
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Delivery Checklist</Text>
        
        <View style={styles.checklistItem}>
          <View style={styles.checklistIconContainer}>
            {photoTaken ? (
              <Ionicons name="checkmark-circle" size={24} color="#4caf50" />
            ) : (
              <Ionicons name="ellipse-outline" size={24} color="#ccc" />
            )}
          </View>
          <View style={styles.checklistTextContainer}>
            <Text style={styles.checklistTitle}>Take Delivery Photo</Text>
            <Text style={styles.checklistDescription}>
              Take a photo of the package at the delivery location
            </Text>
          </View>
          <TouchableOpacity 
            style={[
              styles.checklistButton,
              photoTaken && styles.checklistButtonCompleted
            ]}
            onPress={handleTakePhoto}>
            <Text style={styles.checklistButtonText}>
              {photoTaken ? 'Retake' : 'Take Photo'}
            </Text>
          </TouchableOpacity>
        </View>
        
        <View style={styles.checklistItem}>
          <View style={styles.checklistIconContainer}>
            {signatureCollected ? (
              <Ionicons name="checkmark-circle" size={24} color="#4caf50" />
            ) : (
              <Ionicons name="ellipse-outline" size={24} color="#ccc" />
            )}
          </View>
          <View style={styles.checklistTextContainer}>
            <Text style={styles.checklistTitle}>Collect Signature</Text>
            <Text style={styles.checklistDescription}>
              Ask the recipient to sign to confirm delivery
            </Text>
          </View>
          <TouchableOpacity 
            style={[
              styles.checklistButton,
              signatureCollected && styles.checklistButtonCompleted
            ]}
            onPress={handleCollectSignature}>
            <Text style={styles.checklistButtonText}>
              {signatureCollected ? 'Recollect' : 'Collect'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
      
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Delivery Summary</Text>
        
        <View style={styles.summaryItem}>
          <Text style={styles.summaryLabel}>Package Size</Text>
          <Text style={styles.summaryValue}>
            {request.packageSize === 'small' ? 'Small' : 
             request.packageSize === 'medium' ? 'Medium' : 'Large'}
          </Text>
        </View>
        
        <View style={styles.summaryItem}>
          <Text style={styles.summaryLabel}>Distance</Text>
          <Text style={styles.summaryValue}>{request.distance} km</Text>
        </View>
        
        <View style={styles.summaryItem}>
          <Text style={styles.summaryLabel}>Delivery Fare</Text>
          <Text style={styles.summaryValue}>{formatPrice(request.fare)}</Text>
        </View>
        
        <View style={styles.summaryItem}>
          <Text style={styles.summaryLabel}>Payment Method</Text>
          <Text style={styles.summaryValue}>M-Pesa (Paid)</Text>
        </View>
      </View>
      
      <TouchableOpacity
        style={[
          styles.completeButton,
          (isLoading || deliveryCompleted) && styles.completeButtonDisabled
        ]}
        onPress={handleCompleteDelivery}
        disabled={isLoading || deliveryCompleted}>
        <Text style={styles.completeButtonText}>
          {isLoading ? 'Completing...' : 'Complete Delivery'}
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
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  header: {
    backgroundColor: '#fff',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 5,
  },
  orderId: {
    fontSize: 14,
    color: '#666',
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 15,
    margin: 15,
    marginBottom: 10,
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
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusIconContainer: {
    marginRight: 15,
  },
  statusTextContainer: {
    flex: 1,
  },
  statusTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 5,
  },
  statusDescription: {
    fontSize: 14,
    color: '#666',
  },
  locationText: {
    fontSize: 14,
    color: '#333',
  },
  checklistItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 15,
  },
  checklistIconContainer: {
    marginRight: 10,
  },
  checklistTextContainer: {
    flex: 1,
  },
  checklistTitle: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333',
    marginBottom: 2,
  },
  checklistDescription: {
    fontSize: 12,
    color: '#666',
  },
  checklistButton: {
    backgroundColor: '#e6f2ff',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 4,
  },
  checklistButtonCompleted: {
    backgroundColor: '#e8f5e9',
  },
  checklistButtonText: {
    fontSize: 12,
    color: '#0066cc',
    fontWeight: '500',
  },
  summaryItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  summaryLabel: {
    fontSize: 14,
    color: '#666',
  },
  summaryValue: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333',
  },
  completeButton: {
    backgroundColor: '#0066cc',
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: 'center',
    margin: 15,
  },
  completeButtonDisabled: {
    backgroundColor: '#99ccff',
  },
  completeButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  contactContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    margin: 15,
    marginTop: 0,
    marginBottom: 30,
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

export default DeliveryStatusScreen;
