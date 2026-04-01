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
import { useTranslation } from 'react-i18next';

const NotificationSettingsScreen = ({ navigation }) => {
  const { t } = useTranslation();
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
        Alert.alert(t('common.error'), t('delivery.history_auth_error'));
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
      Alert.alert(t('common.error'), t('settings.update_error'));
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
      title: t('settings.delivery_requests'),
      description: t('settings.delivery_requests_desc'),
      icon: 'cube-outline',
    },
    {
      id: 'deliveryUpdates',
      title: t('settings.delivery_updates'),
      description: t('settings.delivery_updates_desc'),
      icon: 'sync-outline',
    },
    {
      id: 'earnings',
      title: t('settings.earnings_alerts'),
      description: t('settings.earnings_alerts_desc'),
      icon: 'wallet-outline',
    },
    {
      id: 'promotions',
      title: t('settings.promotions'),
      description: t('settings.promotions_desc'),
      icon: 'gift-outline',
    },
    {
      id: 'supportMessages',
      title: t('settings.support_messages'),
      description: t('settings.support_messages_desc'),
      icon: 'chatbubble-outline',
    },
    {
      id: 'generalNotifications',
      title: t('settings.general_notifications'),
      description: t('settings.general_notifications_desc'),
      icon: 'notifications-outline',
    },
  ];

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>{t('settings.notification_settings')}</Text>
      <Text style={styles.subtitle}>
        {t('settings.manage_notifications')}
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
          {t('settings.notification_info')}
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
