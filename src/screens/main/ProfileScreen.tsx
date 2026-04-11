import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  Alert,
  ActivityIndicator,
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { getAuth, signOut } from '@react-native-firebase/auth';
import { getFirestore, doc, getDoc } from '@react-native-firebase/firestore';
import { launchImageLibrary, launchCamera } from 'react-native-image-picker';
import { useTranslation } from 'react-i18next';
import storageService from '../../services/StorageService';
import authService from '../../services/AuthService';

const ProfileScreen = ({ navigation }) => {
  const { t } = useTranslation();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const auth = getAuth();
  const firestore = getFirestore();

  // Fetch user data from Firestore
  useEffect(() => {
    const fetchUserData = async () => {
      try {
        const currentUser = auth.currentUser;
        if (currentUser) {
          const userDoc = await getDoc(doc(firestore, 'users', currentUser.uid));
          if (userDoc.exists()) {
            const userData = userDoc.data();
            setUser({
              ...userData,
              profilePicture: userData.profilePictureUrl
                ? { uri: userData.profilePictureUrl }
                : require('../../assets/driver-avatar-placeholder.jpg'),
            });
          }
        }
      } catch (error) {
        console.error('Error fetching user data:', error);
        Alert.alert(t('common.error'), t('profile.profile_load_error'));
      } finally {
        setLoading(false);
      }
    };

    fetchUserData();
  }, [t]);

  const handleLogout = async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.error('Logout error:', error);
      Alert.alert(t('common.error'), t('profile.logout_error'));
    }
  };

  const menuItems = [
    {
      id: 'notifications',
      title: t('settings.notifications'),
      icon: 'notifications-outline',
      onPress: () => navigation.navigate('NotificationSettings'),
    },
    {
      id: 'language',
      title: t('settings.language'),
      icon: 'language-outline',
      onPress: () => navigation.navigate('LanguageSettings'),
    },
    {
      id: 'help',
      title: t('profile.help_support'),
      icon: 'help-circle-outline',
      onPress: () => navigation.navigate('Support'),
    },
    {
      id: 'about',
      title: t('profile.about'),
      icon: 'information-circle-outline',
      onPress: () => navigation.navigate('RiderAbout'),
    },
  ];

  const handleEditProfile = () => {
    if (user) {
      navigation.navigate('EditProfile', { user });
    }
  };

  const handleProfilePhotoPress = () => {
    Alert.alert(
      t('profile.change_photo', { defaultValue: 'Change Profile Photo' }),
      '',
      [
        {
          text: t('onboarding.take_photo'),
          onPress: () => pickProfilePhoto('camera'),
        },
        {
          text: t('onboarding.choose_library'),
          onPress: () => pickProfilePhoto('gallery'),
        },
        {
          text: t('common.cancel'),
          style: 'cancel',
        },
      ]
    );
  };

  const pickProfilePhoto = async (source) => {
    const options = {
      mediaType: 'photo',
      includeBase64: false,
      maxHeight: 600,
      maxWidth: 600,
      quality: 0.8,
    };

    const callback = async (response) => {
      if (response.didCancel) return;
      if (response.errorCode) {
        Alert.alert(t('common.error'), response.errorMessage);
        return;
      }

      if (response.assets && response.assets.length > 0) {
        const asset = response.assets[0];
        await uploadProfilePhoto(asset.uri);
      }
    };

    if (source === 'camera') {
      launchCamera(options, callback);
    } else {
      launchImageLibrary(options, callback);
    }
  };

  const uploadProfilePhoto = async (localUri) => {
    setLoading(true);
    try {
      const downloadUrl = await storageService.uploadProfilePhoto(localUri);

      // Update Firestore
      const updateResult = await authService.updateUserProfile({
        profilePictureUrl: downloadUrl,
      });

      if (updateResult.success) {
        setUser((prevUser) => ({
          ...prevUser,
          profilePicture: { uri: downloadUrl },
          profilePictureUrl: downloadUrl,
        }));
      } else {
        throw new Error(updateResult.error);
      }
    } catch (error) {
      console.error('Profile photo upload error:', error);
      Alert.alert(t('common.error'), t('profile.profile_save_error', { defaultValue: 'Failed to save profile photo' }));
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#0066cc" />
        <Text style={styles.loadingText}>{t('common.loading')}</Text>
      </View>
    );
  }

  if (!user) {
    return (
      <View style={styles.loadingContainer}>
        <Text>{t('common.no_data')}</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      {/* Profile Header */}
      <View style={styles.profileHeader}>
        <View style={styles.profileImageContainer}>
          <Image source={user.profilePicture} style={styles.profileImage} />
          <TouchableOpacity
            style={styles.editImageButton}
            onPress={handleProfilePhotoPress}
          >
            <Ionicons name="camera-outline" size={18} color="#fff" />
          </TouchableOpacity>
        </View>

        <View style={styles.profileInfo}>
          <Text style={styles.profileName}>{`${user.firstName} ${user.lastName}`}</Text>
          <Text style={styles.profilePhone}>{user.phoneNumber}</Text>
          {user.email && <Text style={styles.profileEmail}>{user.email}</Text>}
        </View>

        <TouchableOpacity
          style={styles.editProfileButton}
          onPress={handleEditProfile}>
          <Text style={styles.editProfileText}>{t('profile.edit_profile')}</Text>
        </TouchableOpacity>
      </View>

      {/* Menu Items */}
      <View style={styles.menuContainer}>
        {menuItems.map((item) => (
          <TouchableOpacity
            key={item.id}
            style={styles.menuItem}
            onPress={item.onPress}>
            <View style={styles.menuIconContainer}>
              <Ionicons name={item.icon} size={22} color="#0066cc" />
            </View>
            <Text style={styles.menuTitle}>{item.title}</Text>
            <Ionicons name="chevron-forward" size={20} color="#ccc" />
          </TouchableOpacity>
        ))}
      </View>

      {/* Logout Button */}
      <TouchableOpacity
        style={styles.logoutButton}
        onPress={handleLogout}>
        <Ionicons name="log-out-outline" size={20} color="#f44336" />
        <Text style={styles.logoutText}>{t('profile.logout')}</Text>
      </TouchableOpacity>

      {/* App Version */}
      <Text style={styles.versionText}>{t('profile.version')} 1.0.0</Text>
      <Text style={styles.copyrightText}>{t('profile.copyright')}</Text>
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
  loadingText: {
    marginTop: 10,
    color: '#666',
  },
  profileHeader: {
    backgroundColor: '#fff',
    padding: 20,
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  profileImageContainer: {
    position: 'relative',
    marginBottom: 15,
  },
  profileImage: {
    width: 100,
    height: 100,
    borderRadius: 50,
  },
  editImageButton: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: '#0066cc',
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#fff',
  },
  profileInfo: {
    alignItems: 'center',
    marginBottom: 15,
  },
  profileName: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 5,
  },
  profilePhone: {
    fontSize: 14,
    color: '#666',
    marginBottom: 3,
  },
  profileEmail: {
    fontSize: 14,
    color: '#666',
  },
  editProfileButton: {
    paddingHorizontal: 20,
    paddingVertical: 8,
    backgroundColor: '#e6f2ff',
    borderRadius: 20,
  },
  editProfileText: {
    color: '#0066cc',
    fontWeight: '500',
  },
  menuContainer: {
    backgroundColor: '#fff',
    borderRadius: 10,
    margin: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 15,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  menuIconContainer: {
    width: 40,
    alignItems: 'center',
    marginRight: 10,
  },
  menuTitle: {
    flex: 1,
    fontSize: 16,
    color: '#333',
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
    borderRadius: 10,
    margin: 15,
    padding: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  logoutText: {
    color: '#f44336',
    fontSize: 16,
    fontWeight: '500',
    marginLeft: 10,
  },
  versionText: {
    textAlign: 'center',
    fontSize: 12,
    color: '#999',
    marginTop: 10,
    marginBottom: 5,
  },
  copyrightText: {
    textAlign: 'center',
    fontSize: 11,
    color: '#bbb',
    marginBottom: 30,
  },
});

export default ProfileScreen;
