import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  Alert,
  Linking,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  TouchableWithoutFeedback,
  Keyboard,
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import firestoreService from '../../services/FirestoreService';

const DeliveryStatusScreen = ({ route, navigation }) => {
  const { deliveryId, request } = route.params;

  const [isLoading, setIsLoading] = useState(false);
  const [deliveryCompleted, setDeliveryCompleted] = useState(false);
  const [photoTaken, setPhotoTaken] = useState(false);
  const [pinEntered, setPinEntered] = useState('');
  const [pinVerified, setPinVerified] = useState(false);
  const [cashPaymentReceived, setCashPaymentReceived] = useState(false);
  const [keyboardVisible, setKeyboardVisible] = useState(false);

  const scrollViewRef = useRef(null);
  const pinInputRef = useRef(null);
  const pinSectionRef = useRef(null);

  useEffect(() => {
    const keyboardDidShowListener = Keyboard.addListener(
      'keyboardDidShow',
      () => setKeyboardVisible(true)
    );
    const keyboardDidHideListener = Keyboard.addListener(
      'keyboardDidHide',
      () => setKeyboardVisible(false)
    );

    return () => {
      keyboardDidShowListener.remove();
      keyboardDidHideListener.remove();
    };
  }, []);

  const scrollToPinInput = () => {
    // Small delay to ensure keyboard is open and layout is calculated
    setTimeout(() => {
      if (pinSectionRef.current && scrollViewRef.current) {
        pinSectionRef.current.measureLayout(
          scrollViewRef.current.getScrollableNode(),
          (x, y) => {
            scrollViewRef.current.scrollTo({ y: y - 100, animated: true });
          },
          (error) => {
            console.log('Error measuring layout:', error);
            // Fallback: scroll to a reasonable position
            scrollViewRef.current.scrollToEnd({ animated: true });
          }
        );
      }
    }, 100);
  };

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

  const handleVerifyPin = async () => {
    if (pinEntered.length < 4) {
      Alert.alert('Error', 'Please enter a 4-digit PIN');
      return;
    }

    setIsLoading(true);
    try {
      const deliveryResult = await firestoreService.getDelivery(deliveryId);
      if (deliveryResult.success && deliveryResult.delivery) {
        const correctPin = deliveryResult.delivery.deliveryPin;
        if (pinEntered === correctPin) {
          setPinVerified(true);
          Alert.alert('Success', 'PIN Verified Successfully');
          // Dismiss keyboard after successful verification
          Keyboard.dismiss();
        } else {
          Alert.alert('Error', 'Invalid PIN. Please try again.');
          setPinEntered(''); // Clear the invalid PIN
          // Focus back on PIN input
          pinInputRef.current?.focus();
        }
      } else {
        Alert.alert('Error', 'Failed to fetch delivery details for verification.');
      }
    } catch (error) {
      console.error('Error verifying PIN:', error);
      Alert.alert('Error', 'An unexpected error occurred during verification.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCompleteDelivery = async () => {
    // For cash payments, we need to check if payment is received
    if (request.paymentMethod === 'cash') {
      // Show confirmation dialog for cash payment
      Alert.alert(
        'Confirm Cash Payment',
        'Have you received the cash payment of ' + formatPrice(request.fare) + ' from the customer?',
        [
          {
            text: 'No, Not Received',
            style: 'cancel',
            onPress: () => {
              // User said payment not received - show warning
              Alert.alert(
                'Payment Not Received',
                'Please collect the cash payment before completing the delivery.',
              );
              return;
            }
          },
          {
            text: 'Yes, Received',
            onPress: async () => {
              // Proceed with delivery completion including cash payment confirmation
              await completeDeliveryProcess(true);
            },
          },
        ]
      );
    } else {
      // For non-cash payments, just complete the delivery
      await completeDeliveryProcess(false);
    }
  };

  const completeDeliveryProcess = async (isCashPayment: boolean) => {
    // Check required steps
    if (!photoTaken || !pinVerified) {
      Alert.alert(
        'Incomplete Delivery',
        'Please take a photo and verify the delivery PIN to complete the delivery.',
      );
      return;
    }

    setIsLoading(true);

    try {
      // If it's a cash payment, we need to update both payment and delivery status
      let result;
      if (isCashPayment) {
        // For cash payments, we need to complete delivery and mark payment as received
        result = await firestoreService.completeDeliveryAndPayment(deliveryId, 'cash');
      } else {
        // For other payment methods, just complete delivery
        const deliveryResult = await firestoreService.updateDeliveryStatus(
          deliveryId,
          'delivered',
          { requestId: request?.requestId || deliveryId }
        );
        result = deliveryResult;
      }

      if (result.success) {
        setDeliveryCompleted(true);
        setCashPaymentReceived(isCashPayment);

        // Show success message with appropriate text
        const successMessage = isCashPayment
          ? 'Cash payment received and delivery completed successfully!'
          : 'Delivery has been successfully completed!';

        Alert.alert(
          'Delivery Completed',
          successMessage,
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
      } else {
        Alert.alert('Error', 'Failed to complete delivery. Please try again.');
      }
    } catch (error) {
      console.error('Error completing delivery:', error);
      Alert.alert('Error', 'An unexpected error occurred. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const formatPrice = (price) => {
    return `TZS ${price.toLocaleString()}`;
  };

  const handleCallCustomer = () => {
    if (request?.phoneNumber) {
      Linking.openURL(`tel:${request.phoneNumber}`);
    } else {
      Alert.alert('Error', 'Customer phone number not available.');
    }
  };

  const handleMessageCustomer = () => {
    if (request?.phoneNumber) {
      Linking.openURL(`sms:${request.phoneNumber}`);
    } else {
      Alert.alert('Error', 'Customer phone number not available.');
    }
  };

  console.log('Request...', request);

  // Determine button text based on payment method
  const getCompleteButtonText = () => {
    if (isLoading) return 'Processing...';

    if (request.paymentMethod === 'cash') {
      return 'Complete Delivery & Confirm Cash';
    }

    return 'Complete Delivery';
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={{ flex: 1 }}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
    >
      <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
        <ScrollView
          ref={scrollViewRef}
          style={styles.container}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{
            paddingBottom: keyboardVisible ? 100 : 20,
          }}
        >
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

            <View
              style={styles.checklistItem}
              ref={pinSectionRef}
            >
              <View style={styles.checklistIconContainer}>
                {pinVerified ? (
                  <Ionicons name="checkmark-circle" size={24} color="#4caf50" />
                ) : (
                  <Ionicons name="ellipse-outline" size={24} color="#ccc" />
                )}
              </View>
              <View style={styles.checklistTextContainer}>
                <Text style={styles.checklistTitle}>Verify Delivery PIN</Text>
                <Text style={styles.checklistDescription}>
                  Enter the 4-digit PIN provided by the recipient
                </Text>
                {!pinVerified && (
                  <View style={styles.pinInputContainer}>
                    <TextInput
                      ref={pinInputRef}
                      style={styles.pinInput}
                      placeholder="PIN"
                      placeholderTextColor="#999"
                      value={pinEntered}
                      onChangeText={setPinEntered}
                      keyboardType="number-pad"
                      maxLength={4}
                      secureTextEntry
                      onFocus={scrollToPinInput}
                      onSubmitEditing={handleVerifyPin}
                      returnKeyType="done"
                    />
                    <TouchableOpacity
                      style={styles.verifyButton}
                      onPress={handleVerifyPin}
                      disabled={isLoading || pinEntered.length < 4}
                    >
                      <Text style={styles.verifyButtonText}>Verify</Text>
                    </TouchableOpacity>
                  </View>
                )}
                {pinVerified && (
                  <Text style={styles.verifiedText}>PIN Verified Successfully</Text>
                )}
              </View>
            </View>
          </View>

          {request.paymentMethod === 'cash' && (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Cash Payment</Text>
              <View style={styles.summaryItem}>
                <Text style={styles.summaryLabel}>Amount to Collect</Text>
                <Text style={styles.summaryValue}>{formatPrice(request.fare)}</Text>
              </View>
              <View style={styles.paymentNote}>
                <Ionicons name="information-circle-outline" size={16} color="#ff9800" />
                <Text style={styles.paymentNoteText}>
                  You'll confirm cash payment when completing delivery
                </Text>
              </View>
            </View>
          )}

          {/* Special Instructions - Only show if there are instructions */}
          {request.packageDetails?.specialInstructions &&
           request.packageDetails.specialInstructions.trim() !== '' &&
           request.packageDetails.specialInstructions !== 'No special instructions provided.' && (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Special Instructions</Text>
              <View style={styles.specialInstructionsContainer}>
                <Text style={styles.specialInstructionsTitle}>Instructions from Customer</Text>
                <Text style={styles.specialInstructionsText}>
                  {request.packageDetails.specialInstructions}
                </Text>
              </View>
            </View>
          )}

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
              <Text style={styles.summaryValue}>
                {request.paymentMethod === 'cash' ? 'Cash on Delivery' : request.paymentMethod}
              </Text>
            </View>
          </View>

          <TouchableOpacity
            style={[
              styles.completeButton,
              (isLoading || deliveryCompleted) && styles.completeButtonDisabled,
              request.paymentMethod === 'cash' && styles.completeButtonCash
            ]}
            onPress={handleCompleteDelivery}
            disabled={isLoading || deliveryCompleted}>
            <Text style={styles.completeButtonText}>
              {getCompleteButtonText()}
            </Text>
          </TouchableOpacity>

          <View style={styles.contactContainer}>
            <TouchableOpacity style={styles.contactButton} onPress={handleCallCustomer}>
              <Ionicons name="call" size={20} color="#0066cc" />
              <Text style={styles.contactButtonText}>Call Customer</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.contactButton} onPress={handleMessageCustomer}>
              <Ionicons name="chatbubble" size={20} color="#0066cc" />
              <Text style={styles.contactButtonText}>Message</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </TouchableWithoutFeedback>
    </KeyboardAvoidingView>
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
  pinInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10,
  },
  pinInput: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 4,
    paddingHorizontal: 10,
    paddingVertical: 8,
    width: 100,
    marginRight: 10,
    fontSize: 16,
    textAlign: 'center',
    letterSpacing: 2,
    color: '#333',
    backgroundColor: '#fff',
  },
  verifyButton: {
    backgroundColor: '#0066cc',
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 4,
  },
  verifyButtonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  verifiedText: {
    color: '#4caf50',
    fontSize: 12,
    fontWeight: '600',
    marginTop: 5,
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
  paymentNote: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10,
    padding: 10,
    backgroundColor: '#fff8e1',
    borderRadius: 8,
    borderLeftWidth: 3,
    borderLeftColor: '#ff9800',
  },
  paymentNoteText: {
    fontSize: 12,
    color: '#ff9800',
    marginLeft: 8,
    flex: 1,
  },
  completeButton: {
    backgroundColor: '#0066cc',
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: 'center',
    margin: 15,
  },
  completeButtonCash: {
    backgroundColor: '#4caf50', // Green for cash payments
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
  specialInstructionsContainer: {
    backgroundColor: '#fff9e6',
    padding: 15,
    borderRadius: 12,
    borderLeftWidth: 3,
    borderLeftColor: '#ffc107',
  },
  specialInstructionsTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#856404',
    marginBottom: 5,
  },
  specialInstructionsText: {
    fontSize: 14,
    color: '#856404',
    fontStyle: 'italic',
  },
});

export default DeliveryStatusScreen;