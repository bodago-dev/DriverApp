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
} from 'react-native';

import authService from '../../services/AuthService';

// Define types for your navigation
type RootStackParamList = {
  OtpVerification: {
    verificationId: string; // Only pass the string ID instead of whole confirmation object
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

  const handleSendOTP = async () => {
      if (!phoneNumber.trim()) {
        Alert.alert('Error', 'Please enter your phone number');
        return;
      }

      if (phoneNumber.length !== 9) {
        Alert.alert('Error', 'Please enter a valid 9-digit phone number');
        return;
      }

      setIsLoading(true);

      try {
        const fullPhoneNumber = `+255${phoneNumber}`;
        const result = await authService.sendOTP(fullPhoneNumber);

        if (result.success) {
          navigation.navigate('OtpVerification', {
            verificationId: result.confirmation.verificationId, // Only pass the verificationId
            phoneNumber: phoneNumber
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
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container as StyleProp<ViewStyle>}>
      <ScrollView contentContainerStyle={styles.scrollContainer}>
        <View style={styles.logoContainer}>
          <Image
            source={require('../../assets/rider-logo-placeholder.png')}
            style={styles.logo as StyleProp<ImageStyle>}
            resizeMode="contain"
          />
        </View>

        <Text style={styles.title as StyleProp<TextStyle>}>Rider Login
        </Text>
        <Text style={styles.subtitle as StyleProp<TextStyle>}>
          Join our delivery network and start earning
        </Text>

        <View style={styles.inputContainer as StyleProp<ViewStyle>}>
          <View style={styles.phoneInputContainer as StyleProp<ViewStyle>}>
            <Text style={styles.countryCode as StyleProp<TextStyle>}>+255</Text>
            <TextInput
              style={styles.input as StyleProp<TextStyle>}
              placeholder="712 345 678"
              keyboardType="phone-pad"
              value={phoneNumber}
              onChangeText={setPhoneNumber}
              maxLength={10}
            />
          </View>
          <Text style={styles.helperText as StyleProp<TextStyle>}>
            We'll send you a verification code via SMS
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
    marginBottom: 40,
  },
  logo: {
    width: 120,
    height: 120,
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
