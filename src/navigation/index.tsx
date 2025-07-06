import * as React from 'react';
import { useState, useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { getAuth, onAuthStateChanged } from '@react-native-firebase/auth';
import { navigationRef } from '../services/NavigationService';
import authService from '../services/AuthService';

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
import DeliveryHistoryScreen from '../screens/main/DeliveryHistoryScreen';
import EarningsScreen from '../screens/main/EarningsScreen';
import ProfileScreen from '../screens/main/ProfileScreen';
import SupportScreen from '../screens/main/SupportScreen';

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
    <OnboardingStack.Navigator screenOptions={{ headerShown: false }}>
      <OnboardingStack.Screen
        name="DriverProfile"
        component={DriverProfileScreen}
        initialParams={{ phoneNumber: 'Fallback Phone', verificationId: 'id' }} // TEMPORARY for testing
        options={{
          title: 'Complete Your Profile',
          headerLeft: () => null, // Disables back button
          gestureEnabled: false  // Disables swipe back gesture
        }}
      />
      <OnboardingStack.Screen name="VehicleInfo" component={VehicleInfoScreen} />
      <OnboardingStack.Screen name="DocumentVerification" component={DocumentVerificationScreen} />
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
      <ProfileStack.Screen name="Support" component={SupportScreen} options={{ title: 'Help & Support' }} />
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
    const [isLoading, setIsLoading] = useState(true);
    const [firebaseUser, setFirebaseUser] = useState(null); // Store Firebase user
    const [userProfile, setUserProfile] = useState(null); // Store user profile from your DB
    const [onboardingCompleted, setOnboardingCompleted] = useState(false);

    useEffect(() => {
    // Use your AuthService listener
    const unsubscribe = authService.addAuthStateListener((fbUser, profile) => {
      console.log('MainNavigator authService Listener - Firebase User:', fbUser);
      console.log('MainNavigator authService Listener - User Profile:', profile);
      setFirebaseUser(fbUser);
      setUserProfile(profile);
      setIsLoading(false);
    });

    return () => unsubscribe(); // Cleanup
  }, []); // Empty dependency array, runs once on mount

  // This would normally check for authentication state
  // const isAuthenticated = false;

  return (
    <NavigationContainer ref={navigationRef}>
        <MainStack.Navigator screenOptions={{ headerShown: false }}>
          {firebaseUser ? (
            userProfile ? (
              <MainStack.Screen name="MainTabs" component={TabNavigator} />
            ) : (
              // User authenticated but no profile - show profile completion
              <MainStack.Screen
                name="Onboarding"
                component={OnboardingNavigator}
              />
            )
          ) : (
            // User not authenticated
            <MainStack.Screen name="Auth" component={AuthNavigator} />
          )}
        </MainStack.Navigator>
      </NavigationContainer>
  );
};

export default MainNavigator;
