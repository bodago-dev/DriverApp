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

const VehicleInfoScreen = ({ route, navigation }) => {
  const { driverProfile } = route.params;
  
  const [vehicleType, setVehicleType] = useState('');
  const [vehicleMake, setVehicleMake] = useState('');
  const [vehicleModel, setVehicleModel] = useState('');
  const [vehicleYear, setVehicleYear] = useState('');
  const [licensePlate, setLicensePlate] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const vehicleTypes = [
    { id: 'boda', name: 'Boda Boda', icon: 'bicycle-outline' },
    { id: 'bajaji', name: 'Bajaji', icon: 'car-outline' },
    { id: 'guta', name: 'Guta', icon: 'car-sport-outline' },
  ];

const handleContinue = async () => {
  // Basic validation
  if (!vehicleType) {
    Alert.alert('Missing Information', 'Please select a vehicle type');
    return;
  }

  if (!vehicleMake.trim() || !vehicleModel.trim() || !vehicleYear.trim() || !licensePlate.trim()) {
    Alert.alert('Missing Information', 'Please fill in all required fields');
    return;
  }

  setIsLoading(true);

  try {
    await authService.updateUserProfile({
      vehicleInfo: {
        vehicleType,
        vehicleMake,
        vehicleModel,
        vehicleYear,
        licensePlate
      }
    });

    navigation.navigate('DocumentVerification', {
      driverProfile: {
        ...driverProfile,
        vehicleInfo: {
          vehicleType,
          vehicleMake,
          vehicleModel,
          vehicleYear,
          licensePlate
        }
      }
    });
  } catch (error) {
    Alert.alert('Error', 'Failed to save vehicle info');
  } finally {
    setIsLoading(false);
  }
};

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContainer}>
        <Text style={styles.title}>Vehicle Information</Text>
        <Text style={styles.subtitle}>
          Tell us about your vehicle
        </Text>

        <View style={styles.formContainer}>
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Vehicle Type <Text style={styles.required}>*</Text></Text>
            <View style={styles.vehicleTypesContainer}>
              {vehicleTypes.map((type) => (
                <TouchableOpacity
                  key={type.id}
                  style={[
                    styles.vehicleTypeCard,
                    vehicleType === type.id && styles.selectedVehicleType,
                  ]}
                  onPress={() => setVehicleType(type.id)}>
                  <Ionicons
                    name={type.icon}
                    size={24}
                    color={vehicleType === type.id ? '#0066cc' : '#666'}
                  />
                  <Text
                    style={[
                      styles.vehicleTypeName,
                      vehicleType === type.id && styles.selectedText,
                    ]}>
                    {type.name}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Vehicle Make <Text style={styles.required}>*</Text></Text>
            <TextInput
              style={styles.input}
              placeholder="e.g., Toyota, Honda, Bajaj"
              value={vehicleMake}
              onChangeText={setVehicleMake}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Vehicle Model <Text style={styles.required}>*</Text></Text>
            <TextInput
              style={styles.input}
              placeholder="e.g., Hiace, RE, Boxer"
              value={vehicleModel}
              onChangeText={setVehicleModel}
            />
          </View>

          <View style={styles.rowInputs}>
            <View style={[styles.inputGroup, styles.halfInput]}>
              <Text style={styles.label}>Year <Text style={styles.required}>*</Text></Text>
              <TextInput
                style={styles.input}
                placeholder="e.g., 2020"
                value={vehicleYear}
                onChangeText={setVehicleYear}
                keyboardType="number-pad"
                maxLength={4}
              />
            </View>

            <View style={[styles.inputGroup, styles.halfInput]}>
              <Text style={styles.label}>License Plate <Text style={styles.required}>*</Text></Text>
              <TextInput
                style={styles.input}
                placeholder="e.g., T 123 ABC"
                value={licensePlate}
                onChangeText={setLicensePlate}
                autoCapitalize="characters"
              />
            </View>
          </View>
        </View>

        <View style={styles.infoContainer}>
          <Ionicons name="information-circle-outline" size={20} color="#0066cc" />
          <Text style={styles.infoText}>
            Your vehicle information will be verified and displayed to customers during deliveries.
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
  vehicleTypesContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  vehicleTypeCard: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 15,
    marginHorizontal: 5,
  },
  selectedVehicleType: {
    borderColor: '#0066cc',
    backgroundColor: '#f0f7ff',
  },
  vehicleTypeName: {
    fontSize: 14,
    color: '#333',
    marginTop: 8,
  },
  selectedText: {
    color: '#0066cc',
    fontWeight: '500',
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
  rowInputs: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  halfInput: {
    width: '48%',
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

export default VehicleInfoScreen;
