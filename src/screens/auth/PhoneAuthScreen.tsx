import React, { useState } from 'react';
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
  StyleProp,
  ViewStyle,
  TextStyle,
  ImageStyle,
  TouchableWithoutFeedback,
  Keyboard,
} from 'react-native';

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

    if (!phoneNumber.trim()) {
      Alert.alert('Error', 'Please enter your phone number');
      return;
    }

    if (!validatePhoneNumber(phoneNumber)) {
      Alert.alert('Error', 'Please enter a valid 9-digit Tanzanian phone number (e.g., 0712345678)');
      return;
    }

    setIsLoading(true);

    try {
      const formattedPhoneNumber = formatPhoneNumber(phoneNumber);
      const result = await authService.sendOTP(formattedPhoneNumber);

      if (result.success) {
        navigation.navigate('OtpVerification', {
          verificationId: result.confirmation.verificationId,
          phoneNumber: formattedPhoneNumber // Send raw digits for display
        });
      } else {
        Alert.alert('Error', result.error || 'Failed to send OTP');
      }
    } catch (error) {
      console.error('OTP Error:', error);
      Alert.alert('Error', 'Failed to send OTP. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
  <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container as StyleProp<ViewStyle>}>
      <ScrollView contentContainerStyle={styles.scrollContainer}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.logoContainer}>
          <Image
            source={require('../../assets/splash_logo.png')}
            style={styles.logo as StyleProp<ImageStyle>}
            resizeMode="contain"
          />
        </View>

        <Text style={styles.title as StyleProp<TextStyle>}>Rider Login</Text>
        <Text style={styles.subtitle as StyleProp<TextStyle>}>
          Join our delivery network and start earning
        </Text>

        <View style={styles.inputContainer as StyleProp<ViewStyle>}>
          <View style={styles.phoneInputContainer as StyleProp<ViewStyle>}>
            <Text style={styles.countryCode as StyleProp<TextStyle>}>+255</Text>
            <TextInput
              style={styles.input as StyleProp<TextStyle>}
              placeholder="712345678"
              keyboardType="phone-pad"
              value={phoneNumber}
              onChangeText={handlePhoneNumberChange}
              maxLength={10} // Allow for 0712345678 format
            />
          </View>
          <Text style={styles.helperText as StyleProp<TextStyle>}>
            Enter your 9-digit phone number (e.g., 712345678 or 0712345678)
          </Text>
        </View>

        <TouchableOpacity
          style={[
            styles.button as StyleProp<ViewStyle>,
            isLoading && (styles.buttonDisabled as StyleProp<ViewStyle>)
          ]}
          onPress={handleSendOTP}
          disabled={isLoading}>
          <Text style={styles.buttonText as StyleProp<TextStyle>}>
            {isLoading ? 'Sending...' : 'Continue'}
          </Text>
        </TouchableOpacity>

        <View style={styles.requirementsContainer}>
          <Text style={styles.requirementsTitle}>Driver Requirements:</Text>
          <Text style={styles.requirementItem}>• Profile Photo</Text>
          <Text style={styles.requirementItem}>• Vehicle Photo</Text>
          <Text style={styles.requirementItem}>• Valid Driving License: Class A</Text>
          <Text style={styles.requirementItem}>• National ID/Voter ID/Passport/Birth Certificate</Text>
          <Text style={styles.requirementItem}>• Vehicle Registration Card</Text>
          <Text style={styles.requirementItem}>• Vehicle Insurance</Text>
          <Text style={styles.requirementItem}>• LATRA Vehicle Licence</Text>
          <Text style={styles.requirementItem}>• Police Clearance Certificate</Text>
          <Text style={styles.requirementItem}>• Age 18 years or above</Text>
        </View>

        <View style={styles.languageSelector as StyleProp<ViewStyle>}>
          <Text style={styles.languageText as StyleProp<TextStyle>}>Language / Lugha:</Text>
          <View style={styles.languageOptions as StyleProp<ViewStyle>}>
            <TouchableOpacity style={styles.languageOption as StyleProp<ViewStyle>}>
              <Text style={[
                styles.languageOptionText as StyleProp<TextStyle>,
                styles.activeLanguage as StyleProp<TextStyle>
              ]}>
                Swahili
              </Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.languageOption as StyleProp<ViewStyle>}>
              <Text style={styles.languageOptionText as StyleProp<TextStyle>}>English</Text>
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
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
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