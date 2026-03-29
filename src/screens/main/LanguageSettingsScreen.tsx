import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { getAuth } from '@react-native-firebase/auth';
import AsyncStorage from '@react-native-async-storage/async-storage';
import authService from '../../services/AuthService.js';
import { useTranslation } from 'react-i18next';

const LanguageSettingsScreen = ({ navigation }) => {
  const { t, i18n } = useTranslation();
  const auth = getAuth();
  const [isLoading, setIsLoading] = useState(true);
  const [selectedLanguage, setSelectedLanguage] = useState(i18n.language);

  useEffect(() => {
    loadLanguagePreference();
  }, []);

  const loadLanguagePreference = async () => {
    try {
      const currentUser = auth.currentUser;
      if (!currentUser) {
        setIsLoading(false);
        return;
      }

      // Try to load from AsyncStorage first
      const savedLanguage = await AsyncStorage.getItem(
        `language_preference_${currentUser.uid}`
      );

      if (savedLanguage) {
        setSelectedLanguage(savedLanguage);
        if (i18n.language !== savedLanguage) {
          i18n.changeLanguage(savedLanguage);
        }
      }
    } catch (error) {
      console.error('Error loading language preference:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleLanguageChange = async (language) => {
    try {
      const currentUser = auth.currentUser;
      if (!currentUser) {
        Alert.alert(t('common.error'), 'User not authenticated');
        return;
      }

      setIsLoading(true);
      
      // Update i18n instance
      await i18n.changeLanguage(language);
      setSelectedLanguage(language);

      // Save to AsyncStorage
      await AsyncStorage.setItem(
        `language_preference_${currentUser.uid}`,
        language
      );

      // Also update in Firestore
      await authService.updateUserProfile({
        languagePreference: language,
      });

      Alert.alert(
        t('common.success'), 
        t('settings.language_changed', { 
          language: language === 'en' ? t('settings.english') : t('settings.swahili') 
        })
      );
    } catch (error) {
      console.error('Error updating language preference:', error);
      Alert.alert(t('common.error'), 'Failed to update language preference');
      // Revert the change
      loadLanguagePreference();
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#0066cc" />
      </View>
    );
  }

  const languages = [
    {
      id: 'sw',
      name: t('settings.swahili'),
      nativeName: 'Kiswahili',
      flag: '🇹🇿',
      description: 'Tumia app kwa Kiswahili',
    },
    {
      id: 'en',
      name: t('settings.english'),
      nativeName: 'English',
      flag: '🇬🇧',
      description: 'Use the app in English',
    },
  ];

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>{t('settings.language_settings')}</Text>
      <Text style={styles.subtitle}>
        {t('settings.choose_language')}
      </Text>

      <View style={styles.languagesContainer}>
        {languages.map((language) => (
          <TouchableOpacity
            key={language.id}
            style={[
              styles.languageItem,
              selectedLanguage === language.id && styles.languageItemSelected,
            ]}
            onPress={() => handleLanguageChange(language.id)}
          >
            <View style={styles.languageLeft}>
              <Text style={styles.flag}>{language.flag}</Text>
              <View style={styles.languageTextContainer}>
                <Text style={styles.languageName}>{language.name}</Text>
                <Text style={styles.languageNativeName}>
                  {language.nativeName}
                </Text>
                <Text style={styles.languageDescription}>
                  {language.description}
                </Text>
              </View>
            </View>
            {selectedLanguage === language.id && (
              <View style={styles.checkmark}>
                <Ionicons name="checkmark-circle" size={24} color="#0066cc" />
              </View>
            )}
          </TouchableOpacity>
        ))}
      </View>

      <View style={styles.infoContainer}>
        <Ionicons name="information-circle-outline" size={20} color="#0066cc" />
        <Text style={styles.infoText}>
          {t('settings.language_info')}
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
  languagesContainer: {
    backgroundColor: '#fff',
    borderRadius: 10,
    marginHorizontal: 15,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
    overflow: 'hidden',
  },
  languageItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 18,
    paddingHorizontal: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  languageItemSelected: {
    backgroundColor: '#f0f7ff',
  },
  languageLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  flag: {
    fontSize: 32,
    marginRight: 15,
  },
  languageTextContainer: {
    flex: 1,
  },
  languageName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 2,
  },
  languageNativeName: {
    fontSize: 14,
    color: '#0066cc',
    marginBottom: 4,
  },
  languageDescription: {
    fontSize: 12,
    color: '#999',
  },
  checkmark: {
    marginLeft: 10,
  },
  infoContainer: {
    flexDirection: 'row',
    backgroundColor: '#e6f2ff',
    borderRadius: 8,
    padding: 15,
    marginHorizontal: 15,
    marginBottom: 20,
    alignItems: 'flex-start',
  },
  infoText: {
    fontSize: 13,
    color: '#0066cc',
    marginLeft: 10,
    flex: 1,
  },
});

export default LanguageSettingsScreen;
