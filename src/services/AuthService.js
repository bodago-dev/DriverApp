// src/services/AuthService.js
import { getAuth, onAuthStateChanged, signInWithPhoneNumber, signOut, PhoneAuthProvider, signInWithCredential } from '@react-native-firebase/auth';
import { getFirestore, doc, getDoc, setDoc, updateDoc, serverTimestamp } from '@react-native-firebase/firestore';

class AuthService {
    constructor() {
        console.log('AuthService CONSTRUCTOR: Initializing...');
        this.user = null;
        this.userProfile = null;
        this.authStateListeners = [];

        try {
            // Initialize Firebase services with modular API
            this.auth = getAuth();
            this.db = getFirestore();
            console.log('AuthService CONSTRUCTOR: Firebase services obtained.');

            // Listen for authentication state changes
            this.unsubscribeAuth = onAuthStateChanged(this.auth, this.onAuthStateChanged.bind(this));
            console.log('AuthService CONSTRUCTOR: Firebase onAuthStateChanged listener attached.');
        } catch (error) {
            console.error('AuthService CONSTRUCTOR CRITICAL ERROR:', error);
        }
    }

    // Add authentication state listener
    addAuthStateListener(listener) {
        console.log('AuthService.addAuthStateListener: Adding a new listener.');
        if (typeof listener !== 'function') {
            console.error('AuthService.addAuthStateListener: Provided listener is not a function!');
            return () => {}; // Return a no-op function
        }
        this.authStateListeners.push(listener);
        console.log('AuthService.addAuthStateListener: Listener added. Total listeners:', this.authStateListeners.length);

        // Immediately notify the new listener
        try {
            console.log('AuthService.addAuthStateListener: Immediately notifying new listener');
            listener(this.user, this.userProfile);
        } catch (error) {
            console.error("AuthService.addAuthStateListener: Error notifying new listener:", error);
        }

        // Return unsubscribe function
        return () => {
            const index = this.authStateListeners.indexOf(listener);
            if (index > -1) {
                this.authStateListeners.splice(index, 1);
            }
        };
    }

    async onAuthStateChanged(user) {
        console.log('AuthService.onAuthStateChanged: FIRED with user:', user?.uid || null);
        this.user = user;
        let loadedProfile = null;

        if (user) {
            try {
                console.log('AuthService.onAuthStateChanged: Loading profile for UID:', user.uid);
                const userDoc = await getDoc(doc(this.db, 'users', user.uid));
                if (userDoc.exists()) {
                    loadedProfile = userDoc.data();
                    console.log('AuthService.onAuthStateChanged: Profile FOUND:', loadedProfile);
                } else {
                    console.log('AuthService.onAuthStateChanged: Profile NOT found for UID:', user.uid);
                }
            } catch (error) {
                console.error('AuthService.onAuthStateChanged: Error loading user profile:', error);
                if (error.code !== 'permission-denied') {
                    throw error;
                }
            }
        }

        this.userProfile = loadedProfile;
        console.log('AuthService.onAuthStateChanged: Notifying listeners');
        this.authStateListeners.forEach(listener => {
            try {
                listener(this.user, this.userProfile);
            } catch (listenerError) {
                console.error('AuthService.onAuthStateChanged: Error in listener:', listenerError);
            }
        });
    }

    // Send OTP to phone number
    async sendOTP(phoneNumber) {
        try {
            const formattedPhone = this.formatPhoneNumber(phoneNumber);
            console.log('AuthService.sendOTP: Sending OTP to', formattedPhone);
            const confirmation = await signInWithPhoneNumber(this.auth, formattedPhone);
            return {
                success: true,
                confirmation,
                verificationId: confirmation.verificationId
            };
        } catch (error) {
            console.error('AuthService.sendOTP: Error sending OTP:', error);
            return {
                success: false,
                error: this.getErrorMessage(error)
            };
        }
    }

    // Verify OTP and complete authentication
    async verifyOTP(verificationId, otp) {
      try {
        // Validate OTP format first
        if (!otp || otp.length !== 6 || !/^\d+$/.test(otp)) {
          return {
            success: false,
            error: 'Please enter a valid 6-digit verification code',
            errorCode: 'invalid-format'
          };
        }

        // Create credential using verificationId and OTP
        const credential = PhoneAuthProvider.credential(verificationId, otp);

        // Sign in with the credential
        const userCredential = await signInWithCredential(this.auth, credential);
        const user = userCredential.user;

        // Check if user profile exists
        try {
          const userDoc = await getDoc(doc(this.db, 'users', user.uid));

          if (!userDoc.exists()) {
            // New user - needs to complete profile
            return {
              success: true,
              user,
              isNewUser: true
            };
          } else {
            // Existing user
            this.userProfile = userDoc.data();
            return {
              success: true,
              user,
              userProfile: this.userProfile,
              isNewUser: false
            };
          }
        } catch (error) {
          // If permission error, treat as new user
          if (error.code === 'permission-denied') {
            return {
              success: true,
              user,
              isNewUser: true
            };
          }
          throw error;
        }
      } catch (error) {
//        if (__DEV__) {
//            console.error('Error verifying OTP:', error);
//          }

        // Enhanced error handling for OTP verification
        let errorMessage = 'An unexpected error occurred';
        let errorCode = 'unknown-error';

        // Extract error code from different possible locations
        const errorCodeFromError = error.code || error?.nativeErrorCode || error?.userInfo?.code;

        switch (errorCodeFromError) {
          case 'auth/invalid-verification-code':
            errorMessage = 'The verification code is incorrect. Please check and try again.';
            errorCode = 'auth/invalid-verification-code';
            break;
          case 'auth/code-expired':
            errorMessage = 'The verification code has expired. Please request a new code.';
            errorCode = 'auth/code-expired';
            break;
          case 'auth/too-many-requests':
            errorMessage = 'Too many attempts. Please try again later.';
            errorCode = 'auth/too-many-requests';
            break;
          case 'auth/session-expired':
            errorMessage = 'The verification session has expired. Please start over.';
            errorCode = 'auth/session-expired';
            break;
          default:
            errorMessage = this.getErrorMessage(error);
            errorCode = errorCodeFromError || 'unknown-error';
        }

        return {
          success: false,
          error: errorMessage,
          errorCode: errorCode
        };
      }
    }

    // Create user profile after successful authentication
    async createUserProfile(userData) {
        try {
            const user = this.auth.currentUser;
            if (!user) {
                throw new Error('No authenticated user found');
            }

            const userProfileData = {
                uid: user.uid,
                phoneNumber: userData.phoneNumber || user.phoneNumber,
                ...userData,
                onboardingCompleted: false,
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp()
            };

            await setDoc(doc(this.db, 'users', user.uid), userProfileData);
            this.userProfile = userProfileData;

            // Notify listeners
            this.authStateListeners.forEach(listener => listener(this.user, this.userProfile));

            return {
                success: true,
                userProfile: this.userProfile
            };
        } catch (error) {
            console.error('Error creating user profile:', error);
            return {
                success: false,
                error: this.getErrorMessage(error)
            };
        }
    }

    // Complete onboarding process
    async completeOnboarding(userId) {
        try {
            await updateDoc(doc(this.db, 'users', userId), {
                onboardingCompleted: true,
                updatedAt: serverTimestamp()
            });

            // Force refresh the user profile
            await this.loadUserProfile(userId);

            // Notify all listeners
            this.authStateListeners.forEach(listener => listener(this.user, this.userProfile));

            return { success: true };
        } catch (error) {
            return {
                success: false,
                error: error.message
            };
        }
    }

    // Update user profile
    async updateUserProfile(updates) {
        try {
            const user = this.auth.currentUser;
            if (!user) {
                throw new Error('No authenticated user found');
            }

            const updatedData = {
                ...updates,
                updatedAt: serverTimestamp()
            };

            await updateDoc(doc(this.db, 'users', user.uid), updatedData);

            this.userProfile = { ...this.userProfile, ...updatedData };
            return {
                success: true,
                userProfile: this.userProfile
            };
        } catch (error) {
            console.error('Error updating user profile:', error);
            return {
                success: false,
                error: this.getErrorMessage(error)
            };
        }
    }

    // Load user profile from Firestore
    async loadUserProfile(uid) {
        try {
            const userDoc = await getDoc(doc(this.db, 'users', uid));
            if (userDoc.exists()) {
                this.userProfile = userDoc.data();
            } else {
                this.userProfile = null;
            }
        } catch (error) {
            console.error('Error loading user profile:', error);
            this.userProfile = null;
        }
    }

    // Sign out user
    async signOut() {
        try {
            await signOut(this.auth);
            this.userProfile = null;
            return { success: true };
        } catch (error) {
            console.error('Error signing out:', error);
            return {
                success: false,
                error: this.getErrorMessage(error)
            };
        }
    }

    // Get current user
    getCurrentUser() {
        return this.user;
    }

    // Get current user profile
    getCurrentUserProfile() {
        return this.userProfile;
    }

    // Check if user is authenticated
    isAuthenticated() {
        return !!this.user;
    }

    // Get user role
    getUserRole() {
        return this.userProfile?.role || null;
    }

    // Format phone number to international format
    formatPhoneNumber(phoneNumber) {
        const cleaned = phoneNumber.replace(/\D/g, '');

        if (cleaned.startsWith('0')) {
            return '+255' + cleaned.substring(1);
        } else if (cleaned.startsWith('255')) {
            return '+' + cleaned;
        } else if (cleaned.startsWith('+255')) {
            return cleaned;
        }
        return '+255' + cleaned;
    }

    // Get user-friendly error message
    getErrorMessage(error) {
        switch (error.code) {
            case 'auth/invalid-phone-number':
                return 'Invalid phone number format';
            case 'auth/invalid-verification-code':
                return 'Invalid verification code';
            case 'auth/code-expired':
                return 'Verification code has expired';
            case 'auth/too-many-requests':
                return 'Too many requests. Please try again later';
            case 'auth/network-request-failed':
                return 'Network error. Please check your connection';
            default:
                return error.message || 'An unexpected error occurred';
        }
    }

    // Cleanup on instance destruction
    destroy() {
        this.unsubscribeAuth?.();
    }
}

// Create and export singleton instance
const authService = new AuthService();
export default authService;