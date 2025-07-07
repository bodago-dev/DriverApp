 import Geolocation from 'react-native-geolocation-service';
 import {Platform, Alert, Linking} from 'react-native';
 import {PERMISSIONS, request, check, RESULTS} from 'react-native-permissions';
 import firestoreService from './FirestoreService';
 import authService from './AuthService';

 class LocationService {
     constructor() {
     this.watchId = null;
     this.currentLocation = null;
     this.locationListeners = [];
     this.isTracking = false;
     this.trackingInterval = null;
 }

 // Request location permissions
 async requestLocationPermission() {
 try {
 let permission;

 if(Platform.OS === 'ios'){
    permission = PERMISSIONS.IOS.LOCATION_WHEN_IN_USE;
 } else {
    permission = PERMISSIONS.ANDROID.ACCESS_FINE_LOCATION;
 }

 const result = await request(permission);

 switch (result) {
     case RESULTS.GRANTED:
        return { success:true, granted:true };
     case RESULTS.DENIED:
        return{ success:true, granted:false, message: 'Location permission denied'};
        case RESULTS.BLOCKED:
        return {
             success: false,
             granted: false,
             message: 'Location permission blocked. Please enable in settings.',
             openSettings: true
         };
         default:
        return {success: false, granted: false, message: 'Unknown permission result'};
     }
     } catch(error) {
         console.error('Error requesting location permission:', error);
         return { success: false, granted: false, message:error.message };
     }
 }

 // Check if location permissions are granted
 async checkLocationPermission() {
     try {
     let permission;

     if (Platform.OS === 'ios'){
        permission = PERMISSIONS.IOS.LOCATION_WHEN_IN_USE;
     } else {
        permission = PERMISSIONS.ANDROID.ACCESS_FINE_LOCATION;
     }

     const result = await check(permission);
     return result === RESULTS.GRANTED;
     } catch(error) {
         console.error('Error checking location permission:', error);
         return false;
     }
 }

 // Get current location
 async getCurrentLocation() {
     return new Promise((resolve,reject)=>{
     const hasPermission = this.checkLocationPermission();

     if(!hasPermission) {
         reject(newError('Location permission not granted'));
         return;
     }

     Geolocation.getCurrentPosition(
         (position) => {
         const location = {
             latitude: position.coords.latitude,
             longitude: position.coords.longitude,
             accuracy: position.coords.accuracy,
             timestamp: position.timestamp
         };

         this.currentLocation = location;
         this.notifyLocationListeners(location);
         resolve(location);
         },
         (error) => {
             console.error('Error getting current location:', error);
             reject(error);
         },
         {
             enableHighAccuracy: true,
             timeout: 15000,
             maximumAge: 10000
         }
     );
     });
 }

 // Start watching location changes
 async startLocationTracking(options = {}){
     try{
     const hasPermission = await this.checkLocationPermission();

     if(!hasPermission){
         const permissionResult = await this.requestLocationPermission();
         if(!permissionResult.granted) {
            throw new Error('Location permission required for tracking');
         }
     }
     
     const defaultOptions = {
         enableHighAccuracy: true,
         distanceFilter: 10, // Update every 10 meters
         interval: 5000, // Update every 5 seconds
         fastestInterval: 2000,
         ...options
     };

     this.watchId = Geolocation.watchPosition(
         (position)=>{
         const location = {
             latitude: position.coords.latitude,
             longitude: position.coords.longitude,
             accuracy: position.coords.accuracy,
             speed: position.coords.speed,
             heading: position.coords.heading,
             timestamp: position.timestamp
         };

        this.currentLocation = location;
        this.notifyLocationListeners(location);

         // Update driver location in Firestore if user is a driver
        this.updateDriverLocationInFirestore(location);
         },
         (error) => {
             console.error('Location tracking error:', error);
             this.notifyLocationListeners(null, error);
         },
         defaultOptions
         );

         this.isTracking = true;
         return { success: true };
         } catch(error) {
         console.error('Error starting location tracking:', error);
         return { success: false, error: error.message };
     }
 }

 // Stop location tracking
 stopLocationTracking() {
     if(this.watchId !== null){
     Geolocation.clearWatch(this.watchId);
     this.watchId = null;
 }

 if(this.trackingInterval) {
     clearInterval(this.trackingInterval);
     this.trackingInterval = null;
 }

    this.isTracking = false;
 }

 // Add location listener
 addLocationListener(listener){
     this.locationListeners.push(listener);

     // Return unsubscribe function
     return() => {
         const index = this.locationListeners.indexOf(listener);
         if(index > -1) {
            this.locationListeners.splice(index,1);
         }
     };
 }

// Notify all location listeners
notifyLocationListeners(location,error = null){
    this.locationListeners.forEach(listener => {
    try {
        listener(location,error);
     } catch(err) {
        console.error('Error in location listener:',err);
     }
     });
 }

 // Update driver location in Firestore
 async updateDriverLocationInFirestore(location){
 try {
     const user = authService.getCurrentUser();
     const userProfile = authService.getCurrentUserProfile();

     if(user && userProfile && userProfile.role === 'driver'){
        await firestoreService.updateDriverLocation(user.uid,location);
     }
     } catch(error) {
        console.error('Error updating driver location in Firestore:',error);
     }
 }

 // Calculate distance between two points
 calculateDistance(point1, point2) {
     const R = 6371; // Earth's radius in kilometers
     const dLat = this.toRadians(point2.latitude - point1.latitude);
     const dLon = this.toRadians(point2.longitude - point1.longitude);
     const a =
     Math.sin(dLat/2) * Math.sin(dLat/2) +
     Math.cos(this.toRadians(point1.latitude)) *
     Math.cos(this.toRadians(point2.latitude)) *
     Math.sin(dLon/2) * Math.sin(dLon/2);

     const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
     const distance = R * c;
     return distance;
 }

 // Calculate bearing between two points
 calculateBearing(point1,point2){
     const dLon = this.toRadians(point2.longitude - point1.longitude);
     const lat1 = this.toRadians(point1.latitude);
     const lat2 = this.toRadians(point2.latitude);

     const y = Math.sin(dLon) * Math.cos(lat2);
     const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLon);
     const bearing = Math.atan2(y,x);
     return(this.toDegrees(bearing) + 360) % 360;
}

 // Convert degrees to radians
 toRadians(degrees) {
    return degrees * (Math.PI/180);
 }

 // Convert radians to degrees
 toDegrees(radians) {
 return radians * (180/Math.PI);
 }

 // Get estimated time of arrival
 calculateETA(currentLocation, destination, averageSpeed = 30){
     const distance = this.calculateDistance(currentLocation, destination);
     const timeInHours = distance / averageSpeed;
     const timeInMinutes = Math.round(timeInHours * 60);

     return{
         distance: distance,
         timeInMinutes: timeInMinutes,
         formattedTime: this.formatTime(timeInMinutes)
     };
 }

 // Format time in minutes to readable format
 formatTime(minutes) {
     if(minutes<60){
        return`${minutes} min`;
     } else{
         const hours = Math.floor(minutes / 60);
         const remainingMinutes = minutes % 60;
         return `${hours}h ${remainingMinutes}m`;
     }
 }

 // Open external navigation app
openExternalNavigation(destination, label = 'Destination') {
    const url = Platform.select({
        ios: `maps:0,0?q=${destination.latitude},${destination.longitude}`,
        android: `geo:0,0?q=${destination.latitude},${destination.longitude}(${label})`
    });

    Linking.canOpenURL(url).then(supported => {
        if(supported){
            Linking.openURL(url);
        } else{
        // Fallback to Google Maps web
        const googleMapsUrl =`https://www.google.com/maps/dir/?api=1&destination=${destination.latitude},${destination.longitude}`;
        Linking.openURL(googleMapsUrl);
    }
    });
}

// Get current location or return cached location
getCurrentLocationCached() {
    return this.currentLocation;
}

// Check if location tracking is active
isLocationTrackingActive() {
    return this.isTracking;
 }
}

// Create and export singleton instance
const locationService = new LocationService();
export default locationService;