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
  TouchableWithoutFeedback,
  Keyboard,
} from 'react-native';

import { getAuth } from '@react-native-firebase/auth';
import authService from '../../services/AuthService';
import { useTranslation } from 'react-i18next';

const OtpVerificationScreen = ({ route, navigation }) => {
  const { t } = useTranslation();
  const { phoneNumber, verificationId } = route.params; // Now receiving verificationId instead of confirmation
  const [otp, setOtp] = useState(['', '', '', '', '', '']); // 6 digits now
  const [timer, setTimer] = useState(60);
  const [isResending, setIsResending] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);

  const inputRefs = Array(6).fill(0).map(() => React.createRef());

  const [hasError, setHasError] = useState(false);

  // Add this useEffect to clear error state when user starts typing
  useEffect(() => {
    if (hasError && otp.some(digit => digit !== '')) {
      setHasError(false);
    }
  }, [otp, hasError]);

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

  // Add this function to clear OTP and refocus on first input
  const clearOtpAndRefocus = () => {
    setOtp(['', '', '', '', '', '']);
    setHasError(true);

    // Focus on the first input field after a brief delay
    setTimeout(() => {
      if (inputRefs[0] && inputRefs[0].current) {
        inputRefs[0].current.focus();
      }
    }, 100);
  };

  const handleOtpChange = (text, index) => {
    // Only allow numbers
    if (!/^\d*$/.test(text)) return;

    const newOtp = [...otp];
    newOtp[index] = text;
    setOtp(newOtp);
    setHasError(false); // Clear error when user starts typing

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
      setHasError(false); // Clear any previous errors

      try {
        const result = await authService.sendOTP(phoneNumber);
        if (result.success) {
          Alert.alert(t('common.success'), 'A new verification code has been sent to your phone.');
          setTimer(60);
          clearOtpAndRefocus(); // Clear existing OTP when resending
        } else {
          Alert.alert('Error', result.error || 'Failed to resend OTP');
        }
      } catch (error) {
        Alert.alert('Error', 'Failed to resend OTP. Please try again.');
      } finally {
        setIsResending(false);
      }
  };

  const handleVerify = async () => {
    const otpCode = otp.join('');

    // Validate OTP length
    if (otpCode.length !== 6) {
      Alert.alert(t('common.warning'), 'Please enter the complete 6-digit verification code.');
      return;
    }

    // Validate that all digits are numbers
    if (!/^\d+$/.test(otpCode)) {
      Alert.alert(t('common.error'), 'Please enter only numbers in the verification code.');
      return;
    }

    setIsVerifying(true);
    setHasError(false); // Clear any previous error state

    try {
      const result = await authService.verifyOTP(verificationId, otpCode);

      if (result.success) {
        // If it's a new user, pass the phone number to the onboarding flow
        if (result.isNewUser) {
          // The MainNavigator will handle the navigation to onboarding
          // We don't need explicit navigation here
        }
      } else {
        // Show user-friendly error message from the service
        // Alert.alert('Verification Failed', result.error || 'Invalid verification code');

        // Clear OTP fields and refocus for incorrect codes
        if (result.errorCode === 'auth/invalid-verification-code' ||
            result.errorCode === 'auth/code-expired') {
          clearOtpAndRefocus();
        } else {
          // For other errors, just set error state without clearing
          setHasError(true);
        }
      }
    } catch (error) {
      // This catch block should only handle unexpected errors, not OTP verification errors
      console.error('Unexpected error during verification:', error);
      Alert.alert('Error', 'An unexpected error occurred. Please try again.');
      clearOtpAndRefocus();
    } finally {
      setIsVerifying(false);
    }
  };

  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContainer}
                  keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.title}>{t('auth.verification_title')}</Text>
        <Text style={styles.subtitle}>
          {t('auth.verification_subtitle', { phone: phoneNumber })}
        </Text>

        <View style={styles.otpContainer}>
          {otp.map((digit, index) => (
            <TextInput
              key={index}
              ref={inputRefs[index]}
              style={[
                  styles.otpInput,
                  hasError && styles.otpInputError,
                  isVerifying && styles.otpInputDisabled
              ]}
              value={digit}
              onChangeText={(text) => handleOtpChange(text, index)}
              onKeyPress={(e) => handleKeyPress(e, index)}
              keyboardType="number-pad"
              maxLength={1}
              editable={!isVerifying}
              selectTextOnFocus={!isVerifying}
            />
          ))}
        </View>

        {hasError && (
          <Text style={styles.errorText}>
            {t('auth.otp_failed_error')}
          </Text>
        )}

        <TouchableOpacity
          style={[styles.button, isVerifying && styles.buttonDisabled]}
          onPress={handleVerify}
          disabled={isVerifying}>
          <Text style={styles.buttonText}>
            {isVerifying ? t('common.loading') : t('common.confirm')}
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
                ? t('common.loading')
                : timer > 0
                  ? t('auth.resend_in', { timer })
                  : t('auth.resend_code')}
            </Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          style={styles.changeNumber}
          onPress={() => navigation.goBack()}>
          <Text style={styles.changeNumberText}>
            {t('auth.change_phone')}
          </Text>
        </TouchableOpacity>
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
    paddingBottom: 20,
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
    color: '#333',
    backgroundColor: '#fff',
    marginHorizontal: 5,
  },
  otpInputError: {
    borderColor: '#f44336',
    backgroundColor: '#ffebee',
    borderWidth: 2,
  },
  otpInputDisabled: {
    backgroundColor: '#f9f9f9',
    opacity: 0.7,
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
  errorText: {
    color: '#f44336',
    textAlign: 'center',
    marginBottom: 15,
    fontSize: 14,
    fontWeight: '500',
  },
});

export default OtpVerificationScreen;