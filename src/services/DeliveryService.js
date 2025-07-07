 import {
     getFirestore,
     collection,
     doc,
     addDoc,
     updateDoc,
     onSnapshot,
     query,
     where,
     orderBy,
     serverTimestamp
 } from '@react-native-firebase/firestore';

 class DeliveryService {

 this.db = getFirestore();

 // Create delivery request
 async createDeliveryRequest(requestData) {
     try {
         const docRef = await addDoc(collection(this.db, 'delivery_requests'), {
             ...requestData,
             status: 'pending',
             createdAt: serverTimestamp(),
             expiresAt: newDate(Date.now()+30000)// 30 seconds
         });
         return docRef.id;
     } catch(error) {
         console.error('Error creating delivery request:', error);
         throw error;
     }
 }

 // Accept delivery request (driver)
 async acceptDeliveryRequest(requestId, driverId) {
     try {
         const requestRef = doc(this.db, 'delivery_requests', requestId);
         await updateDoc(requestRef, {
         status: 'accepted',
         driverId: driverId,
         acceptedAt: serverTimestamp()
     });

     // Create delivery document
     const deliveryRef = await addDoc(collection(this.db, 'deliveries'),{
         requestId: requestId,
         driverId: driverId,
         status: 'driver_assigned',
         createdAt: serverTimestamp(),
         statusHistory: [{
            status: 'driver_assigned',
            timestamp: serverTimestamp(),
            message: 'Driver has been assigned to your delivery'
         }]
     });
       return deliveryRef.id;
     } catch(error) {
         console.error('Error accepting delivery request:', error);
         throw error;
     }
 }

 // Update delivery status
 async updateDeliveryStatus(deliveryId, status, message= ''){
     try {
         const deliveryRef = doc(this.db, 'deliveries', deliveryId);
         await updateDoc(deliveryRef, {
             status: status,
             updatedAt: serverTimestamp(),
             statusHistory: arrayUnion({
             status: status,
             timestamp: serverTimestamp(),
             message: message
             })
         });
     } catch(error) {
         console.error('Error updating delivery status:',error);
         throw error;
     }
 }

 // Listen to delivery requests (for drivers)
 listenToDeliveryRequests(driverLocation, radius, callback){

 // In a real implementation, this would use geohashing for location queries
     const q = query(
         collection(this.db, 'delivery_requests'),
         where('status', '==', 'pending'),
         orderBy('createdAt', 'desc')
     );
     return onSnapshot(q, (snapshot) => {
         const requests = [];
         snapshot.forEach((doc) => {
         const data = doc.data();

         // Filter by distance (simplified)
         if(this.calculateDistance(driverLocation, data.pickupLocation) <= radius){
             requests.push({
                 id:doc.id,
                 ...data
             });
         }
        });
         callback(requests);
     });
 }

 // Listen to delivery updates (for customers)
 listenToDeliveryUpdates(deliveryId, callback) {
     const deliveryRef = doc(this.db, 'deliveries', deliveryId);
     return onSnapshot(deliveryRef, (doc) => {
         if(doc.exists()){
             callback({
                 id:doc.id,
                 ...doc.data()
             });
         }
     });
 }

 // Calculate distance between two points (simplified)
 calculateDistance(point1, point2) {
     const R = 6371;// Earth's radius in km
     const dLat = this.toRad(point2.latitude - point1.latitude);
     const dLon = this.toRad(point2.longitude - point1.longitude);
     const lat1 = this.toRad(point1.latitude);
     const lat2 = this.toRad(point2.latitude);

     const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
     Math.sin(dLon/2) * Math.sin(dLon/2) * Math.cos(lat1) * Math.cos(lat2);
     const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
     return R * c;
 }

     toRad(value) {
        return value * Math.PI / 180;
     }
 }

 export default newDeliveryService();