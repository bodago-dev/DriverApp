import AsyncStorage from '@react-native-async-storage/async-storage';
import i18n from './index';

const LANGUAGE_KEY = 'user_language_preference';

/**
 * Save the user's language preference to AsyncStorage
 * @param language 'en' or 'sw'
 */
export const saveLanguagePreference = async (language: string) => {
  try {
    await AsyncStorage.setItem(LANGUAGE_KEY, language);
  } catch (error) {
    console.error('Error saving language preference:', error);
  }
};

/**
 * Load the user's language preference from AsyncStorage and apply it
 */
export const initLanguage = async () => {
  try {
    const savedLanguage = await AsyncStorage.getItem(LANGUAGE_KEY);
    if (savedLanguage && (savedLanguage === 'en' || savedLanguage === 'sw')) {
      await i18n.changeLanguage(savedLanguage);
      return savedLanguage;
    }
  } catch (error) {
    console.error('Error loading language preference:', error);
  }
  return i18n.language;
};
