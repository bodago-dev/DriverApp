import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Switch,
  Alert,
  ActivityIndicator,
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { getAuth } from '@react-native-firebase/auth';
import AsyncStorage from '@react-native-async-storage/async-storage';
import authService from '../../services/AuthService.js';

const NotificationSettingsScreen = ({ navigation }) => {
  const auth = getAuth();
  const [isLoading, setIsLoading] = useState(true);
  const [notificationSettings, setNotificationSettings] = useState({
    deliveryRequests: true,
    deliveryUpdates: true,
    earnings: true,
    promotions: true,
    supportMessages: true,
    generalNotifications: true,
  });

  useEffect(() => {
    loadNotificationSettings();
  }, []);

  const loadNotificationSettings = async () => {
    try {
      const currentUser = auth.currentUser;
      if (!currentUser) {
        setIsLoading(false);
        return;
      }

      // Try to load from AsyncStorage first
      const savedSettings = await AsyncStorage.getItem(
        `notification_settings_${currentUser.uid}`
      );

      if (savedSettings) {
        setNotificationSettings(JSON.parse(savedSettings));
      }
    } catch (error) {
      console.error('Error loading notification settings:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleToggle = async (key) => {
    try {
      const currentUser = auth.currentUser;
      if (!currentUser) {
        Alert.alert('Error', 'User not authenticated');
        return;
      }

      const updatedSettings = {
        ...notificationSettings,
        [key]: !notificationSettings[key],
      };

      setNotificationSettings(updatedSettings);

      // Save to AsyncStorage
      await AsyncStorage.setItem(
        `notification_settings_${currentUser.uid}`,
        JSON.stringify(updatedSettings)
      );

      // Also update in Firestore
      await authService.updateUserProfile({
        notificationSettings: updatedSettings,
      });
    } catch (error) {
      console.error('Error updating notification settings:', error);
      Alert.alert('Error', 'Failed to update notification settings');
      // Revert the change
      loadNotificationSettings();
    }
  };

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#0066cc" />
      </View>
    );
  }

  const notificationOptions = [
    {
      id: 'deliveryRequests',
      title: 'Delivery Requests',
      description: 'Get notified about new delivery requests',
      icon: 'cube-outline',
    },
    {
      id: 'deliveryUpdates',
      title: 'Delivery Updates',
      description: 'Get notified about delivery status changes',
      icon: 'sync-outline',
    },
    {
      id: 'earnings',
      title: 'Earnings Alerts',
      description: 'Get notified about your earnings and payouts',
      icon: 'wallet-outline',
    },
    {
      id: 'promotions',
      title: 'Promotions & Bonuses',
      description: 'Receive special offers and bonus opportunities',
      icon: 'gift-outline',
    },
    {
      id: 'supportMessages',
      title: 'Support Messages',
      description: 'Receive responses from our support team',
      icon: 'chatbubble-outline',
    },
    {
      id: 'generalNotifications',
      title: 'General Notifications',
      description: 'Important app updates and announcements',
      icon: 'notifications-outline',
    },
  ];

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>Notification Settings</Text>
      <Text style={styles.subtitle}>
        Manage how you receive notifications from BodaGo
      </Text>

      <View style={styles.settingsContainer}>
        {notificationOptions.map((option) => (
          <View key={option.id} style={styles.settingItem}>
            <View style={styles.settingLeft}>
              <Ionicons
                name={option.icon}
                size={24}
                color="#0066cc"
                style={styles.settingIcon}
              />
              <View style={styles.settingTextContainer}>
                <Text style={styles.settingTitle}>{option.title}</Text>
                <Text style={styles.settingDescription}>
                  {option.description}
                </Text>
              </View>
            </View>
            <Switch
              value={notificationSettings[option.id]}
              onValueChange={() => handleToggle(option.id)}
              trackColor={{ false: '#ddd', true: '#81c784' }}
              thumbColor={notificationSettings[option.id] ? '#0066cc' : '#f4f3f4'}
            />
          </View>
        ))}
      </View>

      <View style={styles.infoContainer}>
        <Ionicons name="information-circle-outline" size={20} color="#0066cc" />
        <Text style={styles.infoText}>
          You can change these settings at any time. Some notifications like
          delivery requests cannot be disabled to ensure you don't miss earning opportunities.
        </Text>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
    marginTop: 20,
    marginHorizontal: 20,
  },
  subtitle: {
    fontSize: 14,
    color: '#666',
    marginBottom: 20,
    marginHorizontal: 20,
  },
  settingsContainer: {
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
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 15,
    paddingHorizontal: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  settingLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  settingIcon: {
    marginRight: 15,
  },
  settingTextContainer: {
    flex: 1,
  },
  settingTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  settingDescription: {
    fontSize: 13,
    color: '#999',
  },
  infoContainer: {
    flexDirection: 'row',
    backgroundColor: '#e6f2ff',
    borderRadius: 8,
    padding: 15,
    marginHorizontal: 15,
    marginBottom: 30,
    alignItems: 'flex-start',
  },
  infoText: {
    fontSize: 13,
    color: '#0066cc',
    marginLeft: 10,
    flex: 1,
  },
});

export default NotificationSettingsScreen;
