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

const DriverProfileScreen = ({ route, navigation }) => {
  const { phoneNumber } = route.params;
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [address, setAddress] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleContinue = () => {
    // Basic validation
    if (!firstName.trim() || !lastName.trim() || !address.trim()) {
      Alert.alert('Missing Information', 'Please fill in all required fields');
      return;
    }

    setIsLoading(true);

    // Simulate API call to save profile
    setTimeout(() => {
      setIsLoading(false);
      // Navigate to vehicle info screen
      navigation.navigate('VehicleInfo', {
        driverProfile: {
          firstName,
          lastName,
          phoneNumber,
          email,
          address
        }
      });
    }, 1500);
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContainer}>
        <Text style={styles.title}>Driver Profile</Text>
        <Text style={styles.subtitle}>
          Tell us about yourself
        </Text>

        <View style={styles.avatarContainer}>
          <Image
            source={require('../../assets/driver-avatar-placeholder.jpg')}
            style={styles.avatar}
          />
          <TouchableOpacity style={styles.editAvatarButton}>
            <Text style={styles.editAvatarText}>Add Photo</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.formContainer}>
          <View style={styles.inputGroup}>
            <Text style={styles.label}>First Name <Text style={styles.required}>*</Text></Text>
            <TextInput
              style={styles.input}
              placeholder="Enter your first name"
              value={firstName}
              onChangeText={setFirstName}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Last Name <Text style={styles.required}>*</Text></Text>
            <TextInput
              style={styles.input}
              placeholder="Enter your last name"
              value={lastName}
              onChangeText={setLastName}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Phone Number</Text>
            <TextInput
              style={[styles.input, styles.disabledInput]}
              value={`${phoneNumber}`}
              editable={false}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Email (Optional)</Text>
            <TextInput
              style={styles.input}
              placeholder="Enter your email address"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Home Address <Text style={styles.required}>*</Text></Text>
            <TextInput
              style={styles.input}
              placeholder="Enter your home address"
              value={address}
              onChangeText={setAddress}
            />
          </View>
        </View>

        <View style={styles.infoContainer}>
          <Ionicons name="information-circle-outline" size={20} color="#0066cc" />
          <Text style={styles.infoText}>
            Your information will be verified and kept secure according to our privacy policy.
          </Text>
        </View>

        <TouchableOpacity
          style={[styles.button, isLoading && styles.buttonDisabled]}
          onPress={handleContinue}
          disabled={isLoading}>
          <Text style={styles.buttonText}>
            {isLoading ? 'Saving...' : 'Continue'}
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
