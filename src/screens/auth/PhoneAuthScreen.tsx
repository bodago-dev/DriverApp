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
} from 'react-native';

const PhoneAuthScreen = ({ navigation }) => {
  const [phoneNumber, setPhoneNumber] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleContinue = () => {
    // Basic validation
    if (!phoneNumber || phoneNumber.length < 9) {
      Alert.alert('Invalid Phone Number', 'Please enter a valid phone number');
      return;
    }

    setIsLoading(true);

    // Simulate API call to send OTP
    setTimeout(() => {
      setIsLoading(false);
      // Navigate to OTP verification screen
      navigation.navigate('OtpVerification', { phoneNumber });
    }, 1500);
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContainer}>
        <View style={styles.logoContainer}>
          <Image
            source={require('../../assets/rider-logo-placeholder.png')}
            style={styles.logo}
            resizeMode="contain"
          />
        </View>

        <Text style={styles.title}>Rider Login
        </Text>
        <Text style={styles.subtitle}>
          Join our delivery network and start earning
        </Text>

        <View style={styles.inputContainer}>
          <View style={styles.phoneInputContainer}>
            <Text style={styles.countryCode}>+255</Text>
            <TextInput
              style={styles.input}
              placeholder="712 345 678"
              keyboardType="phone-pad"
              value={phoneNumber}
              onChangeText={setPhoneNumber}
              maxLength={10}
            />
          </View>
          <Text style={styles.helperText}>
            We'll send you a verification code via SMS
          </Text>
        </View>

        <TouchableOpacity
          style={[styles.button, isLoading && styles.buttonDisabled]}
          onPress={handleContinue}
          disabled={isLoading}>
          <Text style={styles.buttonText}>
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

        <View style={styles.languageSelector}>
          <Text style={styles.languageText}>Language / Lugha:</Text>
          <View style={styles.languageOptions}>
            <TouchableOpacity style={styles.languageOption}>
              <Text style={[styles.languageOptionText, styles.activeLanguage]}>
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
