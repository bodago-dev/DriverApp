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
import { useTranslation } from 'react-i18next';

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
  const { t, i18n } = useTranslation();
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
      setNetworkError(t('auth.no_internet_error'));
      return;
    }

    // Validate phone number
    if (!phoneNumber.trim()) {
      setNetworkError(t('auth.enter_phone_error'));
      setInputError(true);
      return;
    }

    if (!validatePhoneNumber(phoneNumber)) {
      setNetworkError(t('auth.invalid_phone_error'));
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
        let errorMessage = result.error || t('auth.otp_failed_error');

        if (result.errorCode) {
          switch (result.errorCode) {
            case 'auth/network-request-failed':
              errorMessage = t('auth.no_internet_error');
              setNetworkError(errorMessage);
              break;
            case 'auth/too-many-requests':
              errorMessage = t('auth.too_many_attempts_error');
              setNetworkError(errorMessage);
              break;
            case 'auth/invalid-phone-number':
              errorMessage = t('auth.invalid_format_error');
              setNetworkError(errorMessage);
              setInputError(true);
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
        setNetworkError(t('auth.no_internet_error'));
      } else if (error.code === 'auth/network-request-failed') {
        setNetworkError(t('auth.no_internet_error'));
      } else {
        setNetworkError(t('auth.otp_failed_error'));
      }
    } finally {
      setIsLoading(false);
    }
  };

  const toggleLanguage = (lang: string) => {
    i18n.changeLanguage(lang);
  };

  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'padding'}
        style={styles.container}>
        <ScrollView
          contentContainerStyle={styles.scrollContainer}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
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

          <Text style={styles.title}>{t('auth.welcome')}</Text>
          <Text style={styles.subtitle}>
            {t('auth.enter_phone_subtitle')}
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
              {t('auth.phone_helper')}
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
              {isLoading ? t('common.loading') : t('common.continue')}
            </Text>
          </TouchableOpacity>

          {/* Network Status Indicator */}
          {!isConnected && !networkError && (
            <View style={styles.networkStatus}>
              <Ionicons name="wifi-outline" size={16} color="#ff9800" />
              <Text style={styles.networkStatusText}>
                {t('auth.no_internet_error')}
              </Text>
            </View>
          )}

          <View style={styles.requirementsContainer}>
            <Text style={styles.requirementsTitle}>{t('auth.requirements_title') || 'Driver Requirements:'}</Text>
            <Text style={styles.requirementItem}>• {t('auth.req_photo') || 'Profile Photo'}</Text>
            <Text style={styles.requirementItem}>• {t('auth.req_license') || 'Valid Drivers License: Class A'}</Text>
            <Text style={styles.requirementItem}>• {t('auth.req_id') || 'National ID/Voter ID/Passport/Birth Certificate'}</Text>
            <Text style={styles.requirementItem}>• {t('auth.req_reg') || 'Vehicle Registration Card'}</Text>
            <Text style={styles.requirementItem}>• {t('auth.req_insurance') || 'Vehicle Insurance'}</Text>
            <Text style={styles.requirementItem}>• {t('auth.req_latra') || 'LATRA Vehicle Licence'}</Text>
            <Text style={styles.requirementItem}>• {t('auth.req_police') || 'Police Clearance Certificate'}</Text>
            <Text style={styles.requirementItem}>• {t('auth.req_age') || 'Age 18 years or above'}</Text>
          </View>

          <View style={styles.languageSelector}>
            <Text style={styles.languageText}>Language / Lugha:</Text>
            <View style={styles.languageOptions}>
              <TouchableOpacity
                style={styles.languageOption}
                onPress={() => toggleLanguage('sw')}
              >
                <Text style={[
                  styles.languageOptionText,
                  i18n.language === 'sw' && styles.activeLanguage
                ]}>
                  Swahili
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.languageOption}
                onPress={() => toggleLanguage('en')}
              >
                <Text style={[
                  styles.languageOptionText,
                  i18n.language === 'en' && styles.activeLanguage
                ]}>
                  English
                </Text>
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
    paddingBottom: 60,
    // NOTE: Do NOT use justifyContent: 'center' here.
    // It prevents scrolling and hides bottom content on small screens.
  },
  // Error Banner Styles
  errorBanner: {
    backgroundColor: '#ff6b6b',
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
    marginBottom: 15,
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
    borderColor: '#ff6b6b',
    borderWidth: 2,
    backgroundColor: '#fff5f5',
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
  // Network Status Indicator
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
    backgroundColor: '#f9f9f9',
    padding: 15,
    borderRadius: 8,
    marginBottom: 20,
  },
  requirementsTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 10,
  },
  requirementItem: {
    fontSize: 12,
    color: '#666',
    marginBottom: 5,
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
