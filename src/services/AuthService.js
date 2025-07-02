 // src/services/AuthService.js
 import auth from '@react-native-firebase/auth';
 import firestore from '@react-native-firebase/firestore';
 import AsyncStorage from '@react-native-async-storage/async-storage';

 classAuthService{
     constructor(){
         this.user=null;
         this.userProfile=null;
         this.authStateListeners=[];

         // Listen for authentication state changes
         auth().onAuthStateChanged(this.onAuthStateChanged.bind(this));
 }

 // Handle authentication state changes
 onAuthStateChanged(user){
     this.user=user;

     if(user){
        this.loadUserProfile(user.uid);
     }else{
         this.userProfile=null;
         AsyncStorage.removeItem('userProfile');
     }
     // Notify all listeners
     this.authStateListeners.forEach(listener=>listener(user,this.userProfile));
 }

 // Add authentication state listener
     addAuthStateListener(listener){
        this.authStateListeners.push(listener);

     // Return unsubscribe function
     return()=>{
         const index = this.authStateListeners.indexOf(listener);
         if(index > -1){
         this.authStateListeners.splice(index,1);
         }
     };
 }

 // Send OTP to phone number
 async sendOTP(phoneNumber) {
     try{
     // Format phone number to international format
         const formattedPhone = this.formatPhoneNumber(phoneNumber);

         const confirmation = await auth().signInWithPhoneNumber(formattedPhone);
         return{
             success:true,
             confirmation,
             verificationId: confirmation.verificationId
         };
     } catch(error){
         console.error('Error sending OTP:',error);
         return{
             success:false,
             error:this.getErrorMessage(error)
         };
     }
 }

 // Verify OTP and complete authentication
 async verifyOTP(confirmation,otp){
     try{
         const userCredential = await confirmation.confirm(otp);
         const user = userCredential.user;

         // Check if user profile exists
         const userDoc = await firestore()
             .collection('users')
             .doc(user.uid)
             .get();

         if(!userDoc.exists){
         // New user - needs to complete profile
             return{
                 success:true,
                 user,
                 isNewUser:true
             };
         } else{
             // Existing user
             const userProfile = userDoc.data();
             this.userProfile = userProfile;
             await AsyncStorage.setItem('userProfile',JSON.stringify(userProfile));

             return {
                success:true,
                user,
                userProfile,
                isNewUser:false
             };
         }
     } catch(error){
         console.error('Error verifying OTP:',error);
         return {
             success:false,
             error:this.getErrorMessage(error)
         };
     }
 }

 // Create user profile after successful authentication
 async createUserProfile(userData){
     try {
         const user=auth().currentUser;
         if(!user){
            throw new Error('No authenticated user found');
         }

     const userProfile = {
         uid: user.uid,
         phoneNumber: user.phoneNumber,
         ...userData,
         createdAt:firestore.FieldValue.serverTimestamp(),
         updatedAt:firestore.FieldValue.serverTimestamp()
     };

     await firestore()
     .collection('users')
     .doc(user.uid)
     .set(userProfile);

     this.userProfile = userProfile;
     await AsyncStorage.setItem('userProfile', JSON.stringify(userProfile));

     return{
         success:true,
         userProfile
     };
     } catch(error) {
         console.error('Error creating user profile:',error);

         return{
             success:false,
             error:this.getErrorMessage(error)
         };
     }
 }

// Update user profile
 async updateUserProfile(updates){
     try {
         const user = auth().currentUser;
         if(!user){
            throw newError('No authenticated user found');
         }

         const updatedData = {
             ...updates,
             updatedAt: firestore.FieldValue.serverTimestamp()
         };

         await firestore()
         .collection('users')
         .doc(user.uid)
         .update(updatedData);

         this.userProfile = {...this.userProfile, ...updatedData};
         await AsyncStorage.setItem('userProfile', JSON.stringify(this.userProfile));

         return {
             success:true,
             userProfile:this.userProfile
         };
     } catch(error){
         console.error('Error updating user profile:',error);
         return {
             success:false,
             error:this.getErrorMessage(error)
         };
     }
 }

 // Load user profile from Firestore
 async loadUserProfile(uid) {
     try {
         const userDoc = await firestore()
         .collection('users')
         .doc(uid)
         .get();

     if(userDoc.exists){
         this.userProfile = userDoc.data();
         await AsyncStorage.setItem('userProfile', JSON.stringify(this.userProfile));
     }
     } catch(error) {
        console.error('Error loading user profile:',error);
     }
 }

// Sign out user
async signOut(){
     try{
         await auth().signOut();
         this.userProfile=null;
         await AsyncStorage.removeItem('userProfile');
         return{ success:true };
     } catch(error) {
         console.error('Error signing out:',error);
         return{
             success: false,
             error: this.getErrorMessage(error)
         };
     }
 }

 // Get current user
 getCurrentUser(){
    return this.user;
 }

 // Get current user profile
 getCurrentUserProfile(){
    return this.userProfile;
 }

 // Check if user is authenticated
 isAuthenticated(){
    return!!this.user;
 }

 // Format phone number to international format
 formatPhoneNumber(phoneNumber){

     // Remove any non-digit characters
     const cleaned = phoneNumber.replace(/\D/g, '');

     // Add Tanzania country code if not present
     if(cleaned.startsWith('0')){
        return'+255'+cleaned.substring(1);
     } else if (cleaned.startsWith('255')){
        return '+' + cleaned;
     } else if (cleaned.startsWith('+255')){
        return cleaned;
     } else {
        return'+255'+cleaned;
     }
 }

 // Get user-friendly error message
 getErrorMessage(error){
     switch(error.code){
         case'auth/invalid-phone-number':
            return'Invalid phone number format';
         case'auth/invalid-verification-code':
            return'Invalid verification code';
         case'auth/code-expired':
            return'Verification code has expired';
         case'auth/too-many-requests':
            return'Too many requests. Please try again later';
         case'auth/network-request-failed':
            return'Network error. Please check your connection';
         default:
            return error.message||'An unexpected error occurred';
     }
 }
}
// Create and export singleton instance
const authService = new AuthService();
export default authService;