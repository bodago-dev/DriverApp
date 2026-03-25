import * as React from 'react';
import { useState, useEffect } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { getAuth, onAuthStateChanged } from '@react-native-firebase/auth';
import { navigationRef } from '../services/NavigationService';
import authService from '../services/AuthService.js';

// Splash Screen
import SplashScreen from '../screens/SplashScreen';

// Auth Screens
import PhoneAuthScreen from '../screens/auth/PhoneAuthScreen';
import OtpVerificationScreen from '../screens/auth/OtpVerificationScreen';
import DriverProfileScreen from '../screens/auth/DriverProfileScreen';
import VehicleInfoScreen from '../screens/auth/VehicleInfoScreen';
import DocumentVerificationScreen from '../screens/auth/DocumentVerificationScreen';

// Main Screens
import HomeScreen from '../screens/main/HomeScreen';
import DeliveryRequestScreen from '../screens/main/DeliveryRequestScreen';
import NavigationScreen from '../screens/main/NavigationScreen';
import DeliveryStatusScreen from '../screens/main/DeliveryStatusScreen';
import DeliveryDetailsScreen from '../screens/main/DeliveryDetailsScreen';
import DeliveryHistoryScreen from '../screens/main/DeliveryHistoryScreen';
import EarningsScreen from '../screens/main/EarningsScreen';
import ProfileScreen from '../screens/main/ProfileScreen';
import SupportScreen from '../screens/main/SupportScreen';
import EditProfileScreen from '../screens/main/EditProfileScreen';
import NotificationSettingsScreen from '../screens/main/NotificationSettingsScreen';
import LanguageSettingsScreen from '../screens/main/LanguageSettingsScreen';
import RiderAboutScreen from '../screens/main/RiderAboutScreen';
import RiderFAQScreen from '../screens/main/RiderFAQScreen';
import RiderContactSupportScreen from '../screens/main/RiderContactSupportScreen';

// Stack navigators
const AuthStack = createNativeStackNavigator();
const MainStack = createNativeStackNavigator();
const DeliveryStack = createNativeStackNavigator();
const EarningsStack = createNativeStackNavigator();
const ProfileStack = createNativeStackNavigator();
const OnboardingStack = createNativeStackNavigator(); // NEW: Stack for onboarding screens
const Tab = createBottomTabNavigator();

// Auth navigator
const AuthNavigator = () => {
  return (
    <AuthStack.Navigator screenOptions={{ headerShown: false }}>
      <AuthStack.Screen name="PhoneAuth" component={PhoneAuthScreen} />
      <AuthStack.Screen name="OtpVerification" component={OtpVerificationScreen} />
      <AuthStack.Screen name="DriverProfile" component={DriverProfileScreen} />
      <AuthStack.Screen name="VehicleInfo" component={VehicleInfoScreen} />
      <AuthStack.Screen name="DocumentVerification" component={DocumentVerificationScreen} />
    </AuthStack.Navigator>
  );
};

// NEW: Onboarding navigator
const OnboardingNavigator = () => {
  return (
    <OnboardingStack.Navigator screenOptions={{
      headerShown: false,
      gestureEnabled: false
    }}>
      <OnboardingStack.Screen
        name="DriverProfile"
        component={DriverProfileScreen}
      />
      <OnboardingStack.Screen
        name="VehicleInfo"
        component={VehicleInfoScreen}
      />
      <OnboardingStack.Screen
        name="DocumentVerification"
        component={DocumentVerificationScreen}
      />
    </OnboardingStack.Navigator>
  );
};

// Delivery flow navigator
const DeliveryNavigator = () => {
  return (
    <DeliveryStack.Navigator>
      <DeliveryStack.Screen name="Home" component={HomeScreen} options={{ headerShown: false }} />
      <DeliveryStack.Screen name="DeliveryRequest" component={DeliveryRequestScreen} options={{ title: 'New Request' }} />
      <DeliveryStack.Screen name="Navigation" component={NavigationScreen} options={{ title: 'Navigation' }} />
      <DeliveryStack.Screen name="DeliveryStatus" component={DeliveryStatusScreen} options={{ title: 'Delivery Status' }} />
      <DeliveryStack.Screen name="DeliveryDetails" component={DeliveryDetailsScreen} options={{ title: 'Delivery Details' }} />
    </DeliveryStack.Navigator>
  );
};

// Earnings navigator
const EarningsNavigator = () => {
  return (
    <EarningsStack.Navigator>
      <EarningsStack.Screen name="EarningsMain" component={EarningsScreen} options={{ title: 'My Earnings' }} />
    </EarningsStack.Navigator>
  );
};

// Profile navigator
const ProfileNavigator = () => {
  return (
    <ProfileStack.Navigator>
      <ProfileStack.Screen name="ProfileMain" component={ProfileScreen} options={{ title: 'My Profile' }} />
      <ProfileStack.Screen name="EditProfile" component={EditProfileScreen} options={{ title: 'Edit Profile' }} />
      <ProfileStack.Screen name="NotificationSettings" component={NotificationSettingsScreen} options={{ title: 'Notification Settings' }} />
      <ProfileStack.Screen name="LanguageSettings" component={LanguageSettingsScreen} options={{ title: 'Language' }} />
      <ProfileStack.Screen name="Support" component={SupportScreen} options={{ title: 'Help & Support' }} />
      <ProfileStack.Screen name="RiderFAQ" component={RiderFAQScreen} options={{ title: 'FAQ' }} />
      <ProfileStack.Screen name="RiderContactSupport" component={RiderContactSupportScreen} options={{ title: 'Contact Support' }} />
      <ProfileStack.Screen name="RiderAbout" component={RiderAboutScreen} options={{ title: 'About BodaGo' }} />
    </ProfileStack.Navigator>
  );
};

// Tab navigator
const TabNavigator = () => {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ focused, color, size }) => {
          let iconName;

          if (route.name === 'DeliveryTab') {
            iconName = focused ? 'cube' : 'cube-outline';
          } else if (route.name === 'History') {
            iconName = focused ? 'time' : 'time-outline';
          } else if (route.name === 'EarningsTab') {
            iconName = focused ? 'wallet' : 'wallet-outline';
          } else if (route.name === 'ProfileTab') {
            iconName = focused ? 'person' : 'person-outline';
          }

          return <Ionicons name={iconName} size={size} color={color} />;
        },
        tabBarActiveTintColor: '#0066cc',
        tabBarInactiveTintColor: 'gray',
      })}
    >
      <Tab.Screen
        name="DeliveryTab"
        component={DeliveryNavigator}
        options={{
          headerShown: false,
          title: 'Deliveries'
        }}
      />
      <Tab.Screen
        name="History"
        component={DeliveryHistoryScreen}
        options={{
          title: 'History'
        }}
      />
      <Tab.Screen
        name="EarningsTab"
        component={EarningsNavigator}
        options={{
          headerShown: false,
          title: 'Earnings'
        }}
      />
      <Tab.Screen
        name="ProfileTab"
        component={ProfileNavigator}
        options={{
          headerShown: false,
          title: 'Profile'
        }}
      />
    </Tab.Navigator>
  );
};

// Main navigator
const MainNavigator = () => {
  const [showSplash, setShowSplash] = useState(true);
  const [isReady, setIsReady] = useState(false);
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);

  useEffect(() => {
    let isMounted = true;
    let unsubscribe: () => void;

    // Wait for BOTH auth state AND profile to stabilize
    const checkAuthAndProfile = async () => {
      unsubscribe = authService.addAuthStateListener(async (fbUser, fbProfile) => {
        if (!isMounted) return;

//         console.log("Auth state update:", {
//           user: fbUser?.uid,
//           profileExists: !!fbProfile
//         });

        setUser(fbUser);
        setProfile(fbProfile);

        // Only mark as ready if:
        // - User is logged out (fbUser = null), OR
        // - User is logged in AND profile is loaded
        if (!fbUser || (fbUser && fbProfile)) {
          setIsReady(true);
        }
      });
    };

    checkAuthAndProfile();

    return () => {
      isMounted = false;
      unsubscribe?.();
    };
  }, []);

  // Show splash screen first
  if (showSplash) {
    return (
      <SplashScreen onFinish={() => setShowSplash(false)} />
    );
  }

  if (!isReady) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#0066cc" />
      </View>
    );
  }

  return (
    <NavigationContainer ref={navigationRef}>
      <MainStack.Navigator screenOptions={{ headerShown: false }}>
        {!user ? (
          <MainStack.Screen name="Auth" component={AuthNavigator} />
        ) : profile?.onboardingCompleted ? (
          <MainStack.Screen name="MainTabs" component={TabNavigator} />
        ) : (
          <MainStack.Screen
            name="Onboarding"
            component={OnboardingNavigator}
            options={{ gestureEnabled: false }}
          />
        )}
      </MainStack.Navigator>
    </NavigationContainer>
  );
};

export default MainNavigator;
