import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Image,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import authService from '../../services/AuthService';
import { getAuth, onAuthStateChanged } from '@react-native-firebase/auth';
import { useTranslation } from 'react-i18next';

const DriverProfileScreen = ({ route, navigation }) => {
  const { t } = useTranslation();
  const auth = getAuth();
  const user = auth.currentUser;

  // Get phone number from Firebase auth user
  const phoneNumber = user?.phoneNumber?.replace('+255', '') || '';

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [address, setAddress] = useState('');
  const [isLoading, setIsLoading] = useState(false);


// Update the handleSaveProfile function in DriverProfileScreen.tsx
const handleSaveProfile = async () => {
    if (!firstName.trim() || !lastName.trim()) {
      Alert.alert(t('common.error'), t('auth.profile_name_error'));
      return;
    }

    setIsLoading(true);

    try {
        const result = await authService.createUserProfile({
          firstName,
          lastName,
          phoneNumber: `+255${phoneNumber}`, // Save with country code
          email,
          address,
          role: 'rider', // Automatically assign 'rider' role
        });

        if (result.success) {
          navigation.navigate('VehicleInfo', {
            driverProfile: result.userProfile
          });
        }
      } catch (error) {
        Alert.alert(t('common.error'), t('auth.profile_save_error'));
    } finally {
      setIsLoading(false);
    }
}; // This closes handleSaveProfile

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContainer}>
        <Text style={styles.title}>{t('onboarding.profile_title')}</Text>
        <Text style={styles.subtitle}>
          {t('onboarding.profile_subtitle')}
        </Text>

        <View style={styles.avatarContainer}>
          <Image
            source={require('../../assets/driver-avatar-placeholder.jpg')}
            style={styles.avatar}
          />
          <TouchableOpacity style={styles.editAvatarButton}>
            <Text style={styles.editAvatarText}>{t('auth.profile_add_photo')}</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.formContainer}>
          <View style={styles.inputGroup}>
            <Text style={styles.label}>{t('auth.profile_first_name')} <Text style={styles.required}>*</Text></Text>
            <TextInput
              style={styles.input}
              placeholder={t('auth.profile_first_name_placeholder')}
              value={firstName}
              onChangeText={setFirstName}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>{t('auth.profile_last_name')} <Text style={styles.required}>*</Text></Text>
            <TextInput
              style={styles.input}
              placeholder={t('auth.profile_last_name_placeholder')}
              value={lastName}
              onChangeText={setLastName}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>{t('auth.profile_phone')}</Text>
            <TextInput
              style={[styles.input, styles.disabledInput]}
              value={`+255${phoneNumber}`}
              editable={false}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>{t('auth.profile_email_optional')}</Text>
            <TextInput
              style={styles.input}
              placeholder={t('auth.profile_email_placeholder')}
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>{t('auth.profile_address')} <Text style={styles.required}>*</Text></Text>
            <TextInput
              style={styles.input}
              placeholder={t('auth.profile_address_placeholder')}
              value={address}
              onChangeText={setAddress}
            />
          </View>
        </View>

        <View style={styles.infoContainer}>
          <Ionicons name="information-circle-outline" size={20} color="#0066cc" />
          <Text style={styles.infoText}>
            {t('auth.profile_info_secure')}
          </Text>
        </View>

        <TouchableOpacity
          style={[styles.button, isLoading && styles.buttonDisabled]}
          onPress={handleSaveProfile}
          disabled={isLoading}>
          <Text style={styles.buttonText}>
            {isLoading ? t('common.saving') : t('common.continue')}
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
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    textAlign: 'center',
    marginBottom: 10,
    marginTop: 20,
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 30,
  },
  avatarContainer: {
    alignItems: 'center',
    marginBottom: 30,
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#f0f0f0',
  },
  editAvatarButton: {
    position: 'absolute',
    bottom: 0,
    right: '35%',
    backgroundColor: '#0066cc',
    borderRadius: 15,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  editAvatarText: {
    color: '#fff',
    fontSize: 12,
  },
  formContainer: {
    marginBottom: 20,
  },
  inputGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    color: '#333',
    marginBottom: 8,
    fontWeight: '500',
  },
  required: {
    color: '#f44336',
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    height: 50,
    paddingHorizontal: 15,
    fontSize: 16,
    color: '#333',
  },
  disabledInput: {
    backgroundColor: '#f9f9f9',
    color: '#666',
  },
  infoContainer: {
    flexDirection: 'row',
    backgroundColor: '#e6f2ff',
    borderRadius: 8,
    padding: 12,
    marginBottom: 20,
  },
  infoText: {
    fontSize: 13,
    color: '#333',
    marginLeft: 8,
    flex: 1,
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
});

export default DriverProfileScreen;
