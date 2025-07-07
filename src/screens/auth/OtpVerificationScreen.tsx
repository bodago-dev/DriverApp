import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Alert,
} from 'react-native';

import { getAuth } from '@react-native-firebase/auth';
import authService from '../../services/AuthService';

const OtpVerificationScreen = ({ route, navigation }) => {
  const { phoneNumber, verificationId } = route.params; // Now receiving verificationId instead of confirmation
  const [otp, setOtp] = useState(['', '', '', '', '', '']); // 6 digits now
  const [timer, setTimer] = useState(60);
  const [isResending, setIsResending] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  
  const inputRefs = Array(6).fill(0).map(() => React.createRef());

  useEffect(() => {
    // Start countdown timer
    const interval = setInterval(() => {
      setTimer((prevTimer) => {
        if (prevTimer <= 1) {
          clearInterval(interval);
          return 0;
        }
        return prevTimer - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  const handleOtpChange = (text, index) => {
    // Only allow numbers
    if (!/^\d*$/.test(text)) return;

    const newOtp = [...otp];
    newOtp[index] = text;
    setOtp(newOtp);

    // Auto-focus to next input
    if (text && index < 5) {
      inputRefs[index + 1].current.focus();
    }
  };

  const handleKeyPress = (e, index) => {
    // Handle backspace
    if (e.nativeEvent.key === 'Backspace' && !otp[index] && index > 0) {
      inputRefs[index - 1].current.focus();
    }
  };

  const handleResendOtp = async () => {
      if (timer > 0) return;

      setIsResending(true);

      try {
        const result = await authService.sendOTP(phoneNumber);
        if (result.success) {
          Alert.alert('OTP Sent', 'A new verification code has been sent to your phone.');
          setTimer(60);
          // Update the verificationId if needed
          // verificationId = result.confirmation.verificationId;
        } else {
          Alert.alert('Error', result.error || 'Failed to resend OTP');
        }
      } catch (error) {
        Alert.alert('Error', 'Failed to resend OTP. Please try again.');
      } finally {
        setIsResending(false);
      }
  };

  // Update the handleVerify function in OtpVerificationScreen.tsx
    const handleVerify = async () => {
      const otpCode = otp.join('');
      if (otpCode.length !== 6) {
        Alert.alert('Incomplete OTP', 'Please enter the complete 6-digit verification code.');
        return;
      }

  setIsVerifying(true);

  try {
      const result = await authService.verifyOTP(verificationId, otpCode);
      if (result.success) {
        // If it's a new user, pass the phone number to the onboarding flow
        if (result.isNewUser) {
          // The MainNavigator will handle the navigation to onboarding
          // We don't need explicit navigation here
        }
      } else {
        Alert.alert('Error', result.error || 'Verification failed');
      }
    } catch (error) {
      Alert.alert('Error', error.message || 'Verification failed');
    } finally {
      setIsVerifying(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContainer}>
        <Text style={styles.title}>Verification Code</Text>
        <Text style={styles.subtitle}>
          Enter the 6-digit code sent to +255 {phoneNumber}
        </Text>

        <View style={styles.otpContainer}>
          {otp.map((digit, index) => (
            <TextInput
              key={index}
              ref={inputRefs[index]}
              style={styles.otpInput}
              value={digit}
              onChangeText={(text) => handleOtpChange(text, index)}
              onKeyPress={(e) => handleKeyPress(e, index)}
              keyboardType="number-pad"
              maxLength={1}
            />
          ))}
        </View>

        <TouchableOpacity
          style={[styles.button, isVerifying && styles.buttonDisabled]}
          onPress={handleVerify}
          disabled={isVerifying}>
          <Text style={styles.buttonText}>
            {isVerifying ? 'Verifying...' : 'Verify'}
          </Text>
        </TouchableOpacity>

        <View style={styles.resendContainer}>
          <Text style={styles.resendText}>
            Didn't receive the code?{' '}
          </Text>
          <TouchableOpacity 
            onPress={handleResendOtp}
            disabled={timer > 0 || isResending}>
            <Text 
              style={[
                styles.resendButton, 
                (timer > 0 || isResending) && styles.resendButtonDisabled
              ]}>
              {isResending 
                ? 'Sending...' 
                : timer > 0 
                  ? `Resend in ${timer}s` 
                  : 'Resend Code'}
            </Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity 
          style={styles.changeNumber}
          onPress={() => navigation.goBack()}>
          <Text style={styles.changeNumberText}>
            Change Phone Number
          </Text>
        </TouchableOpacity>
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
  otpContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 30,
  },
  otpInput: {
    width: 50,
    height: 60,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    textAlign: 'center',
    fontSize: 24,
    fontWeight: 'bold',
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
  resendContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  resendText: {
    fontSize: 14,
    color: '#666',
  },
  resendButton: {
    fontSize: 14,
    color: '#0066cc',
    fontWeight: '600',
  },
  resendButtonDisabled: {
    color: '#999',
  },
  changeNumber: {
    alignItems: 'center',
  },
  changeNumberText: {
    fontSize: 14,
    color: '#0066cc',
    textDecorationLine: 'underline',
  },
});

export default OtpVerificationScreen;
