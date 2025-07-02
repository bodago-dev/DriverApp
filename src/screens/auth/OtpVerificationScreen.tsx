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

const OtpVerificationScreen = ({ route, navigation }) => {
  const { phoneNumber } = route.params;
  const [otp, setOtp] = useState(['', '', '', '']);
  const [timer, setTimer] = useState(60);
  const [isResending, setIsResending] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  
  const inputRefs = Array(4).fill(0).map(() => React.createRef());

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
    if (text && index < 3) {
      inputRefs[index + 1].current.focus();
    }
  };

  const handleKeyPress = (e, index) => {
    // Handle backspace
    if (e.nativeEvent.key === 'Backspace' && !otp[index] && index > 0) {
      inputRefs[index - 1].current.focus();
    }
  };

  const handleResendOtp = () => {
    if (timer > 0) return;
    
    setIsResending(true);
    
    // Simulate API call to resend OTP
    setTimeout(() => {
      setIsResending(false);
      setTimer(60);
      Alert.alert('OTP Sent', 'A new verification code has been sent to your phone.');
    }, 1500);
  };

  const handleVerify = () => {
    // Check if OTP is complete
    if (otp.some(digit => !digit)) {
      Alert.alert('Incomplete OTP', 'Please enter the complete verification code.');
      return;
    }

    setIsVerifying(true);

    // Simulate API call to verify OTP
    setTimeout(() => {
      setIsVerifying(false);
      
      // For demo purposes, any 4-digit code is accepted
      // In a real app, this would validate against a backend
      
      // Check if this is a new driver or existing driver
      const isNewDriver = true; // This would be determined by the backend
      
      if (isNewDriver) {
        // New driver - go to profile setup
        navigation.navigate('DriverProfile', { phoneNumber });
      } else {
        // Existing driver - go to main app
        navigation.reset({
          index: 0,
          routes: [{ name: 'Main' }],
        });
      }
    }, 1500);
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContainer}>
        <Text style={styles.title}>Verification Code</Text>
        <Text style={styles.subtitle}>
          Enter the 4-digit code sent to +255 {phoneNumber}
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
    width: 60,
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
