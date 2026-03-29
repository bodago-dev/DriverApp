import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Linking,
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';

const SupportScreen = ({ navigation }) => {
  const supportOptions = [
    {
      id: 'faq',
      title: 'Frequently Asked Questions',
      icon: 'help-circle-outline',
      onPress: () => navigation.navigate('RiderFAQ'),
    },
    {
      id: 'contact',
      title: 'Contact Support',
      icon: 'call-outline',
      onPress: () => navigation.navigate('RiderContactSupport'),
    },
  ];

const handleCallEmergency = () => {
  Linking.openURL('tel:+255712863555').catch((err) =>
    console.error('Failed to call:', err)
  );
};

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>How can we help you?</Text>
      
      <View style={styles.optionsContainer}>
        {supportOptions.map((option) => (
          <TouchableOpacity
            key={option.id}
            style={styles.optionCard}
            onPress={option.onPress}>
            <Ionicons name={option.icon} size={24} color="#0066cc" />
            <Text style={styles.optionTitle}>{option.title}</Text>
            <Ionicons name="chevron-forward" size={20} color="#ccc" />
          </TouchableOpacity>
        ))}
      </View>
      
      <View style={styles.emergencyContainer}>
        <Text style={styles.emergencyTitle}>Emergency Contact</Text>
        <Text style={styles.emergencyText}>
          For urgent delivery issues, call our support line:
        </Text>
        <TouchableOpacity 
          style={styles.emergencyButton} 
          onPress={handleCallEmergency} 
        >
          <Ionicons name="call" size={20} color="#fff" />
          <Text style={styles.emergencyButtonText}>+255 712 863 555</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 20,
    textAlign: 'center',
    marginTop: 20,
    marginHorizontal: 20,
  },
  optionsContainer: {
    backgroundColor: '#fff',
    borderRadius: 10,
    marginHorizontal: 15,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  optionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 15,
    paddingHorizontal: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  optionTitle: {
    flex: 1,
    fontSize: 16,
    color: '#333',
    marginLeft: 15,
    fontWeight: '500',
  },
  emergencyContainer: {
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 20,
    marginHorizontal: 15,
    marginBottom: 30,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  emergencyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 10,
  },
  emergencyText: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginBottom: 15,
  },
  emergencyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ff6b6b',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
  },
  emergencyButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
});

export default SupportScreen;
