import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Alert,
  TouchableWithoutFeedback,
  Keyboard,
} from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import Ionicons from 'react-native-vector-icons/Ionicons';
import authService from '../../services/AuthService';

// Define types for your navigation
type RootStackParamList = {
  OtpVerification: {
    verificationId: string;
    phoneNumber: string;
  };
};

type PhoneAuthScreenProps = {
  navigation: {
    navigate: (screen: keyof RootStackParamList, params?: any) => void;
  };
};

const PhoneAuthScreen: React.FC<PhoneAuthScreenProps> = ({ navigation }) => {
  const [phoneNumber, setPhoneNumber] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [networkError, setNetworkError] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState<boolean | null>(true);
  const [inputError, setInputError] = useState(false);

  // Check network connection on component mount
  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener(state => {
      setIsConnected(state.isConnected);

      // Clear network error when connection is restored
      if (state.isConnected && networkError?.includes('internet')) {
        setNetworkError(null);
      }
    });

    return () => unsubscribe();
  }, [networkError]);

  // Clear error when user starts typing
  useEffect(() => {
    if (networkError || inputError) {
      setNetworkError(null);
      setInputError(false);
    }
  }, [phoneNumber]);

  // Function to format phone number to international format
  const formatPhoneNumber = (input: string): string => {
    // Remove all non-digit characters
    const cleaned = input.replace(/\D/g, '');

    // Handle different input formats
    if (cleaned.startsWith('0')) {
      // Local format: 0712345678 -> +255712345678
      return '+255' + cleaned.substring(1);
    } else if (cleaned.startsWith('255')) {
      // National format: 255712345678 -> +255712345678
      return '+' + cleaned;
    } else if (cleaned.startsWith('+255')) {
      // Already in international format
      return cleaned;
    } else if (cleaned.length === 9) {
      // Assume it's a local number without leading zero
      return '+255' + cleaned;
    }

    // Return as is (will be validated later)
    return '+' + cleaned;
  };

  const handlePhoneNumberChange = (input: string) => {
    // Allow only digits
    const cleanedInput = input.replace(/\D/g, '');
    setPhoneNumber(cleanedInput);
  };

  const validatePhoneNumber = (number: string): boolean => {
    const cleaned = number.replace(/\D/g, '');

    // Check if it starts with 0 and has 10 digits (0712345678)
    if (cleaned.startsWith('0') && cleaned.length === 10) {
      return true;
    }

    // Check if it starts with 255 and has 12 digits (255712345678)
    if (cleaned.startsWith('255') && cleaned.length === 12) {
      return true;
    }

    // Check if it's 9 digits without prefix (712345678)
    if (!cleaned.startsWith('0') && !cleaned.startsWith('255') && cleaned.length === 9) {
      return true;
    }

    return false;
  };

  const handleSendOTP = async () => {
    // Dismiss keyboard first
    Keyboard.dismiss();

    // Clear any existing errors
    setNetworkError(null);
    setInputError(false);

    // Check internet connection first
    if (!isConnected) {
      setNetworkError('No internet connection. Please check your network and try again.');
      return;
    }

    // Validate phone number
    if (!phoneNumber.trim()) {
      setNetworkError('Please enter your phone number');
      setInputError(true);
      return;
    }

    if (!validatePhoneNumber(phoneNumber)) {
      setNetworkError('Please enter a valid 9-digit Tanzanian phone number (e.g., 0712345678)');
      setInputError(true);
      return;
    }

    setIsLoading(true);

    try {
      const formattedPhoneNumber = formatPhoneNumber(phoneNumber);
      const result = await authService.sendOTP(formattedPhoneNumber);

      if (result.success) {
        // Clear any existing errors
        setNetworkError(null);
        setInputError(false);

        navigation.navigate('OtpVerification', {
          verificationId: result.confirmation.verificationId,
          phoneNumber: formattedPhoneNumber // Send raw digits for display
        });
      } else {
        // Map Firebase error codes to user-friendly messages
        let errorMessage = result.error || 'Failed to send OTP';

        if (result.errorCode) {
          switch (result.errorCode) {
            case 'auth/network-request-failed':
              errorMessage = 'Network error. Please check your internet connection and try again.';
              setNetworkError(errorMessage);
              break;
            case 'auth/too-many-requests':
              errorMessage = 'Too many attempts. Please try again later.';
              setNetworkError(errorMessage);
              break;
            case 'auth/invalid-phone-number':
              errorMessage = 'Invalid phone number format. Please enter a valid Tanzanian number.';
              setNetworkError(errorMessage);
              setInputError(true);
              break;
            case 'auth/quota-exceeded':
              errorMessage = 'Service temporarily unavailable. Please try again in a few minutes.';
              setNetworkError(errorMessage);
              break;
            default:
              setNetworkError(errorMessage);
          }
        } else {
          setNetworkError(errorMessage);
        }
      }
    } catch (error: any) {
      console.error('OTP Error:', error);

      // Handle network-related errors
      if (error.message?.includes('network') || error.message?.includes('Network')) {
        setNetworkError('Network error. Please check your internet connection and try again.');
      } else if (error.code === 'auth/network-request-failed') {
        setNetworkError('Network error. Please check your internet connection and try again.');
      } else {
        setNetworkError('Failed to send OTP. Please try again.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.container}>
        <ScrollView
          contentContainerStyle={styles.scrollContainer}
          keyboardShouldPersistTaps="handled"
        >
          {/* Network Error Banner */}
          {networkError && (
            <View style={styles.errorBanner}>
              <View style={styles.errorContent}>
                <Ionicons name="warning-outline" size={20} color="#fff" />
                <Text style={styles.errorText} numberOfLines={2}>{networkError}</Text>
              </View>
              <TouchableOpacity
                onPress={() => setNetworkError(null)}
                style={styles.closeErrorButton}
              >
                <Ionicons name="close" size={20} color="#fff" />
              </TouchableOpacity>
            </View>
          )}

          <View style={styles.logoContainer}>
            <Image
              source={require('../../assets/splash_logo.png')}
              style={styles.logo}
              resizeMode="contain"
            />
          </View>

          <Text style={styles.title}>Rider Login</Text>
          <Text style={styles.subtitle}>
            Join our delivery network and start earning
          </Text>

          <View style={styles.inputContainer}>
            <View style={[
              styles.phoneInputContainer,
              inputError && styles.phoneInputContainerError
            ]}>
              <Text style={styles.countryCode}>+255</Text>
              <TextInput
                style={styles.input}
                placeholder="712345678"
                keyboardType="phone-pad"
                value={phoneNumber}
                onChangeText={handlePhoneNumberChange}
                maxLength={10} // Allow for 0712345678 format
              />
            </View>
            <Text style={styles.helperText}>
              Enter your 9-digit phone number (e.g., 712345678 or 0712345678)
            </Text>
          </View>

          <TouchableOpacity
            style={[
              styles.button,
              isLoading && styles.buttonDisabled
            ]}
            onPress={handleSendOTP}
            disabled={isLoading || !isConnected}>
            <Text style={styles.buttonText}>
              {isLoading ? 'Sending...' : 'Continue'}
            </Text>
          </TouchableOpacity>

          {/* Network Status Indicator */}
          {!isConnected && !networkError && (
            <View style={styles.networkStatus}>
              <Ionicons name="wifi-outline" size={16} color="#ff9800" />
              <Text style={styles.networkStatusText}>
                You are offline. Please connect to the internet.
              </Text>
            </View>
          )}

          <View style={styles.requirementsContainer}>
            <Text style={styles.requirementsTitle}>Driver Requirements:</Text>
            <Text style={styles.requirementItem}>• Profile Photo</Text>
            <Text style={styles.requirementItem}>• Valid Drivers License: Class A</Text>
            <Text style={styles.requirementItem}>• National ID/Voter ID/Passport/Birth Certificate</Text>
            <Text style={styles.requirementItem}>• Vehicle Registration Card</Text>
            <Text style={styles.requirementItem}>• Vehicle Insurance</Text>
            <Text style={styles.requirementItem}>• LATRA Vehicle Licence</Text>
            <Text style={styles.requirementItem}>• Police Clearance Certificate</Text>
            <Text style={styles.requirementItem}>• Age 18 years or above</Text>
          </View>

          <View style={styles.languageSelector}>
            <Text style={styles.languageText}>Language / Lugha:</Text>
            <View style={styles.languageOptions}>
              <TouchableOpacity style={styles.languageOption}>
                <Text style={[
                  styles.languageOptionText,
                  styles.activeLanguage
                ]}>
                  Swahili
                </Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.languageOption}>
                <Text style={styles.languageOptionText}>English</Text>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </TouchableWithoutFeedback>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  scrollContainer: {
    flexGrow: 1,
    padding: 20,
    justifyContent: 'center',
  },
  // Error Banner Styles
  errorBanner: {
    backgroundColor: '#f44336',
    padding: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderRadius: 8,
    marginBottom: 20,
  },
  errorContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  errorText: {
    color: '#fff',
    fontSize: 14,
    marginLeft: 10,
    flex: 1,
    fontWeight: '500',
  },
  closeErrorButton: {
    padding: 4,
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: 10,
  },
  logo: {
    width: 180,
    height: 180,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    textAlign: 'center',
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 30,
  },
  inputContainer: {
    marginBottom: 30,
  },
  phoneInputContainer: {
    flexDirection: 'row',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    height: 50,
    alignItems: 'center',
    marginBottom: 8,
  },
  phoneInputContainerError: {
    borderColor: '#f44336',
    borderWidth: 2,
    backgroundColor: '#ffebee',
  },
  countryCode: {
    paddingHorizontal: 15,
    fontSize: 16,
    color: '#333',
    borderRightWidth: 1,
    borderRightColor: '#ddd',
    height: '100%',
    textAlignVertical: 'center',
  },
  input: {
    flex: 1,
    paddingHorizontal: 15,
    fontSize: 16,
    color: '#333',
  },
  helperText: {
    fontSize: 12,
    color: '#888',
    marginLeft: 5,
    marginBottom: 2,
  },
  button: {
    backgroundColor: '#0066cc',
    borderRadius: 8,
    height: 50,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  buttonDisabled: {
    backgroundColor: '#99ccff',
  },
  // Network Status Styles
  networkStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff3e0',
    padding: 10,
    borderRadius: 8,
    marginBottom: 20,
  },
  networkStatusText: {
    fontSize: 14,
    color: '#ff9800',
    marginLeft: 8,
    fontWeight: '500',
  },
  requirementsContainer: {
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    padding: 15,
    marginBottom: 20,
  },
  requirementsTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  requirementItem: {
    fontSize: 13,
    color: '#666',
    marginBottom: 4,
  },
  languageSelector: {
    marginTop: 20,
    alignItems: 'center',
  },
  languageText: {
    fontSize: 14,
    color: '#666',
    marginBottom: 10,
  },
  languageOptions: {
    flexDirection: 'row',
  },
  languageOption: {
    marginHorizontal: 10,
  },
  languageOptionText: {
    fontSize: 14,
    color: '#666',
  },
  activeLanguage: {
    color: '#0066cc',
    fontWeight: 'bold',
    textDecorationLine: 'underline',
  },
});

export default PhoneAuthScreen;