// src/services/AuthService.js
import { getAuth, onAuthStateChanged, signInWithPhoneNumber, signOut, PhoneAuthProvider } from '@react-native-firebase/auth';
import { getFirestore, doc, getDoc, setDoc, updateDoc, serverTimestamp } from '@react-native-firebase/firestore';

class AuthService {
    constructor() {
        console.log('AuthService CONSTRUCTOR: Initializing...'); // <-- ADD LOG
        this.user = null;
        this.userProfile = null;
        this.authStateListeners = [];

        try {
            // Initialize Firebase services
            this.auth = getAuth();
            this.db = getFirestore();
            console.log('AuthService CONSTRUCTOR: Firebase services obtained.'); // <-- ADD LOG

            // Listen for authentication state changes
            this.unsubscribeAuth = onAuthStateChanged(this.auth, this.onAuthStateChanged.bind(this));
            console.log('AuthService CONSTRUCTOR: Firebase onAuthStateChanged listener attached.'); // <-- ADD LOG
        } catch (error) {
            console.error('AuthService CONSTRUCTOR CRITICAL ERROR:', error); // <-- ADD LOG (Important for catching init failures)
        }
    }

    // Add authentication state listener
    addAuthStateListener(listener) {
        console.log('AuthService.addAuthStateListener: Adding a new listener.'); // <-- ADD LOG
        if (typeof listener !== 'function') {
            console.error('AuthService.addAuthStateListener: Provided listener is not a function!'); // <-- ADD LOG
            return () => {}; // Return a no-op to prevent errors if MainNavigator tries to call an undefined unsubscribe
        }
        this.authStateListeners.push(listener);
        console.log('AuthService.addAuthStateListener: Listener added. Total listeners:', this.authStateListeners.length); // <-- ADD LOG

        // Immediately notify the new listener with the current state
        try {
            console.log('AuthService.addAuthStateListener: Immediately notifying new listener with user:', this.user, 'and profile:', this.userProfile); // <-- ADD LOG
            listener(this.user, this.userProfile);
        } catch (error) {
            console.error("AuthService.addAuthStateListener: Error immediately notifying new listener:", error); // <-- ADD LOG
        }

        // Return unsubscribe function
        return () => {
            const index = this.authStateListeners.indexOf(listener);
            console.log('AuthService.addAuthStateListener: Attempting to remove listener at index:', index); // <-- ADD LOG
            if (index > -1) {
                this.authStateListeners.splice(index, 1);
                console.log('AuthService.addAuthStateListener: Listener removed. Total listeners now:', this.authStateListeners.length); // <-- ADD LOG
            }
        };
    }

    async onAuthStateChanged(user) {
        console.log('AuthService.onAuthStateChanged: FIRED with user:', user ? user.uid : null); // <-- MODIFIED LOG
        this.user = user;
        let loadedProfile = null;

        if (user) {
            try {
                console.log('AuthService.onAuthStateChanged: Loading profile for UID:', user.uid); // <-- ADD LOG
                const userDoc = await getDoc(doc(this.db, 'users', user.uid));
                if (userDoc.exists()) {
                    loadedProfile = userDoc.data();
                    console.log('AuthService.onAuthStateChanged: Profile FOUND:', loadedProfile); // <-- ADD LOG
                } else {
                    console.log('AuthService.onAuthStateChanged: Profile NOT found for UID:', user.uid); // <-- ADD LOG
                }
            } catch (error) {
                console.error('AuthService.onAuthStateChanged: Error loading user profile:', error);
            }
        }
        this.userProfile = loadedProfile;

        console.log('AuthService.onAuthStateChanged: Notifying', this.authStateListeners.length, 'listeners. Current user:', this.user ? this.user.uid : null, 'Current profile:', this.userProfile); // <-- MODIFIED LOG
        this.authStateListeners.forEach(listener => {
            try {
                listener(this.user, this.userProfile);
            } catch (listenerError) {
                console.error('AuthService.onAuthStateChanged: Error in one of the listeners:', listenerError); // <-- ADD LOG
            }
        });
        console.log('AuthService.onAuthStateChanged: Listeners notified.'); // <-- ADD LOG
    }

    // Send OTP to phone number
    async sendOTP(phoneNumber) {
        try {
            const formattedPhone = this.formatPhoneNumber(phoneNumber);
            console.log('AuthService.sendOTP: Sending OTP to', formattedPhone); // Optional log
            const confirmation = await signInWithPhoneNumber(this.auth, formattedPhone);
            return { success: true, confirmation, verificationId: confirmation.verificationId };
        } catch (error) {
            console.error('AuthService.sendOTP: Error sending OTP:', error);
            return { success: false, error: this.getErrorMessage(error) };
        }
    }

    // Verify OTP and complete authentication
    async verifyOTP(verificationId, otp) {
      try {

        // Create credential using verificationId and OTP
        const credential = PhoneAuthProvider.credential(verificationId, otp);

        // Sign in with the credential
        const userCredential = await this.auth.signInWithCredential(credential);
        const user = userCredential.user;

        // Check if user profile exists
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
        console.error('Error verifying OTP:', error);
        return {
          success: false,
          error: this.getErrorMessage(error)
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

            // Use phoneNumber from userData OR fallback to Firebase Auth user's number
            const phoneNumber = userData.phoneNumber || user.phoneNumber;

            const userProfileData = {
                uid: user.uid,
                phoneNumber,
                ...userData,
                onboardingCompleted: false,
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp()
            };

            await setDoc(doc(this.db, 'users', user.uid), userProfileData);
            this.userProfile = userProfileData; // Update local cache in AuthService

            // Notify listeners that profile is now available
            this.authStateListeners.forEach(listener => listener(this.user, this.userProfile));

            return { success: true, userProfile: this.userProfile };
        } catch (error) {
            console.error('Error creating user profile:', error);
            return { success: false, error: this.getErrorMessage(error) };
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
        return { success: false, error: error.message };
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
            return { success: false, error: this.getErrorMessage(error) };
        }
    }

    // Load user profile from Firestore
    async loadUserProfile(uid) {
        try {
            const userDoc = await getDoc(doc(this.db, 'users', uid));
            if (userDoc.exists()) {
                this.userProfile = userDoc.data();
            } else {
                this.userProfile = null; // Explicitly set to null if not found
            }
        } catch (error) {
            console.error('Error loading user profile:', error);
            this.userProfile = null; // Ensure profile is null on error
        }
        // OPTIONALLY: Re-notify listeners here if loadUserProfile is async and you want them to get the updated profile.
        // However, the current structure where verifyOTP sets isNewUser and MainNavigator uses authService listener
        // should work if OtpVerificationScreen handles the initial nav to UserProfile.
        // For subsequent app loads, this loadUserProfile is key.
    }

    // Sign out user
    async signOut() {
        try {
            await signOut(this.auth);
            this.userProfile = null;
            return { success: true };
        } catch (error) {
            console.error('Error signing out:', error);
            return { success: false, error: this.getErrorMessage(error) };
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
        return this.userProfile ? this.userProfile.role : null;
    }

    // Format phone number to international format
    formatPhoneNumber(phoneNumber) {
        // Remove any non-digit characters
        const cleaned = phoneNumber.replace(/\D/g, '');

        // Add Tanzania country code if not present
        if (cleaned.startsWith('0')) {
            return '+255' + cleaned.substring(1);
        } else if (cleaned.startsWith('255')) {
            return '+' + cleaned;
        } else if (cleaned.startsWith('+255')) {
            return cleaned;
        } else {
            return '+255' + cleaned;
        }
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
        this.unsubscribeAuth();
    }
}

// Create and export singleton instance
const authService = new AuthService();
export default authService;


