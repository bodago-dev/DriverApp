import {
  getFirestore,
  doc,
  setDoc,
  getDoc,
  updateDoc,
  addDoc,
  collection,
  serverTimestamp,
  where,
  orderBy,
  limit,
  onSnapshot,
  query,
  writeBatch,
  getDocs
} from '@react-native-firebase/firestore';
import { getAuth } from '@react-native-firebase/auth';

class FirestoreService {
  constructor() {
    this.db = getFirestore();
  }

  // User Management
  async createUserProfile(userData) {
    try {
      const auth = getAuth();
      const user = auth.currentUser;
      if (!user) {
        throw new Error('No authenticated user found');
      }

      const userProfile = {
        uid: user.uid,
        phoneNumber: user.phoneNumber,
        ...userData,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      };

      await setDoc(doc(this.db, 'users', user.uid), userProfile);
      return { success: true, userProfile };
    } catch (error) {
      console.error('Error creating user profile:', error);
      return { success: false, error: error.message };
    }
  }

  async getUserProfile(userId) {
    try {
      const userDoc = await getDoc(doc(this.db, 'users', userId));

      if (userDoc.exists()) {
        return { success: true, userProfile: userDoc.data() };
      } else {
        return { success: false, error: 'User profile not found' };
      }
    } catch (error) {
      console.error('Error getting user profile:', error);
      return { success: false, error: error.message };
    }
  }

  async updateUserProfile(userId, updates) {
    try {
      const updatedData = {
        ...updates,
        updatedAt: serverTimestamp()
      };

      await updateDoc(doc(this.db, 'users', userId), updatedData);
      return { success: true };
    } catch (error) {
      console.error('Error updating user profile:', error);
      return { success: false, error: error.message };
    }
  }

  // Delivery Request Management
  async createDeliveryRequest(requestData) {
    try {
      const auth = getAuth();
      const user = auth.currentUser;
      if (!user) {
        throw new Error('No authenticated user found');
      }

      const deliveryRequest = {
        customerId: user.uid,
        customerPhone: user.phoneNumber,
        ...requestData,
        status: 'pending',
        createdAt: serverTimestamp(),
        expiresAt: new Date(Date.now() + 30000) // 30 seconds
      };

      const docRef = await addDoc(collection(this.db, 'delivery_requests'), deliveryRequest);

      return {
        success: true,
        requestId: docRef.id,
        deliveryRequest: { id: docRef.id, ...deliveryRequest }
      };
    } catch (error) {
      console.error('Error creating delivery request:', error);
      return { success: false, error: error.message };
    }
  }

  async getDeliveryRequest(requestId) {
    try {
      const requestDoc = await getDoc(doc(this.db, 'delivery_requests', requestId));

      if (requestDoc.exists()) {
        return {
          success: true,
          deliveryRequest: { id: requestDoc.id, ...requestDoc.data() }
        };
      } else {
        return { success: false, error: 'Delivery request not found' };
      }
    } catch (error) {
      console.error('Error getting delivery request:', error);
      return { success: false, error: error.message };
    }
  }

  async updateDeliveryRequestStatus(requestId, status, driverId = null) {
    try {
      const updateData = {
        status,
        updatedAt: serverTimestamp()
      };

      if (driverId) {
        updateData.driverId = driverId;
        updateData.acceptedAt = serverTimestamp();
      }

      await updateDoc(doc(this.db, 'delivery_requests', requestId), updateData);
      return { success: true };
    } catch (error) {
      console.error('Error updating delivery request status:', error);
      return { success: false, error: error.message };
    }
  }

  // Get nearby delivery requests for drivers
  async getNearbyDeliveryRequests(driverLocation, radiusKm = 5) {
    try {
      const q = query(
        collection(this.db, 'delivery_requests'),
        where('status', '==', 'pending'),
        where('expiresAt', '>', new Date())
      );

      const querySnapshot = await getDocs(q);
      const nearbyRequests = [];

      querySnapshot.forEach(doc => {
        const request = { id: doc.id, ...doc.data() };
        const distance = this.calculateDistance(
          driverLocation,
          request.pickupLocation
        );

        if (distance <= radiusKm) {
          nearbyRequests.push({ ...request, distance });
        }
      });

      return { success: true, requests: nearbyRequests };
    } catch (error) {
      console.error('Error getting nearby delivery requests:', error);
      return { success: false, error: error.message };
    }
  }

  // Delivery Management
  async createDelivery(deliveryData) {
    try {
      const delivery = {
        ...deliveryData,
        status: 'accepted',
        createdAt: serverTimestamp(),
        timeline: {
          accepted: serverTimestamp()
        }
      };

      const docRef = await addDoc(collection(this.db, 'deliveries'), delivery);

      return {
        success: true,
        deliveryId: docRef.id,
        delivery: { id: docRef.id, ...delivery }
      };
    } catch (error) {
      console.error('Error creating delivery:', error);
      return { success: false, error: error.message };
    }
  }

  async updateDeliveryStatus(deliveryId, status, additionalData = {}) {
    try {
      const updateData = {
        status,
        updatedAt: serverTimestamp(),
        ...additionalData
      };

      updateData[`timeline.${status}`] = serverTimestamp();
      await updateDoc(doc(this.db, 'deliveries', deliveryId), updateData);
      return { success: true };
    } catch (error) {
      console.error('Error updating delivery status:', error);
      return { success: false, error: error.message };
    }
  }

  async getDelivery(deliveryId) {
    try {
      const deliveryDoc = await getDoc(doc(this.db, 'deliveries', deliveryId));

      if (deliveryDoc.exists()) {
        return {
          success: true,
          delivery: { id: deliveryDoc.id, ...deliveryDoc.data() }
        };
      } else {
        return { success: false, error: 'Delivery not found' };
      }
    } catch (error) {
      console.error('Error getting delivery:', error);
      return { success: false, error: error.message };
    }
  }

  // Get user's delivery history
  async getUserDeliveries(userId, role = 'customer', limitCount = 20) {
    try {
      const field = role === 'customer' ? 'customerId' : 'driverId';
      const q = query(
        collection(this.db, 'deliveries'),
        where(field, '==', userId),
//        orderBy('createdAt', 'desc'),
        limit(limitCount)
      );

      const querySnapshot = await getDocs(q);
      const deliveryList = [];

      querySnapshot.forEach(doc => {
        deliveryList.push({ id: doc.id, ...doc.data() });
      });

      return { success: true, deliveries: deliveryList };
    } catch (error) {
      console.error('Error getting user deliveries:', error);
      return { success: false, error: error.message };
    }
  }

  // Driver Location Management
  async updateDriverLocation(driverId, location) {
    try {
      const locationData = {
        latitude: location.latitude,
        longitude: location.longitude,
        timestamp: serverTimestamp(),
        online: true
      };

      await setDoc(doc(this.db, 'driver_locations', driverId), locationData);
      return { success: true };
    } catch (error) {
      console.error('Error updating driver location:', error);
      return { success: false, error: error.message };
    }
  }

  async getDriverLocation(driverId) {
    try {
      const locationDoc = await getDoc(doc(this.db, 'driver_locations', driverId));

      if (locationDoc.exists()) {
        return {
          success: true,
          location: locationDoc.data()
        };
      } else {
        return { success: false, error: 'Driver location not found' };
      }
    } catch (error) {
      console.error('Error getting driver location:', error);
      return { success: false, error: error.message };
    }
  }

  async setDriverOnlineStatus(driverId, isOnline) {
    try {
      await updateDoc(doc(this.db, 'driver_locations', driverId), {
        online: isOnline,
        timestamp: serverTimestamp()
      });

      return { success: true };
    } catch (error) {
      console.error('Error setting driver online status:', error);
      return { success: false, error: error.message };
    }
  }

  // Real-time Listeners
  subscribeToDeliveryUpdates(deliveryId, callback) {
    return onSnapshot(
      doc(this.db, 'deliveries', deliveryId),
      (doc) => {
        if (doc.exists()) {
          callback({ id: doc.id, ...doc.data() });
        }
      },
      (error) => {
        console.error('Error in delivery subscription:', error);
        callback(null, error);
      }
    );
  }

  subscribeToDriverLocation(driverId, callback) {
    return onSnapshot(
      doc(this.db, 'driver_locations', driverId),
      (doc) => {
        if (doc.exists()) {
          callback(doc.data());
        }
      },
      (error) => {
        console.error('Error in driver location subscription:', error);
        callback(null, error);
      }
    );
  }

  subscribeToDeliveryRequests(driverLocation, callback) {
    return onSnapshot(
      query(
        collection(this.db, 'delivery_requests'),
        where('status', '==', 'pending')
      ),
      (snapshot) => {
        const requests = [];
        snapshot.forEach(doc => {
          const request = { id: doc.id, ...doc.data() };
          const distance = this.calculateDistance(
            driverLocation,
            request.pickupLocation
          );

          if (distance <= 5) {
            requests.push({ ...request, distance });
          }
        });
        callback(requests);
      },
      (error) => {
        console.error('Error in delivery requests subscription:', error);
        callback([], error);
      }
    );
  }

  // Payment Management
  async createPaymentRecord(paymentData) {
    try {
      const payment = {
        ...paymentData,
        status: 'pending',
        createdAt: serverTimestamp()
      };

      const docRef = await addDoc(collection(this.db, 'payments'), payment);

      return {
        success: true,
        paymentId: docRef.id,
        payment: { id: docRef.id, ...payment }
      };
    } catch (error) {
      console.error('Error creating payment record:', error);
      return { success: false, error: error.message };
    }
  }

  async updatePaymentStatus(paymentId, status, transactionData = {}) {
    try {
      const updateData = {
        status,
        updatedAt: serverTimestamp(),
        ...transactionData
      };

      await updateDoc(doc(this.db, 'payments', paymentId), updateData);
      return { success: true };
    } catch (error) {
      console.error('Error updating payment status:', error);
      return { success: false, error: error.message };
    }
  }

  // Utility Functions
  calculateDistance(location1, location2) {
    const R = 6371; // Earth's radius in kilometers
    const dLat = this.toRadians(location2.latitude - location1.latitude);
    const dLon = this.toRadians(location2.longitude - location1.longitude);

    const a =
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(this.toRadians(location1.latitude)) *
      Math.cos(this.toRadians(location2.latitude)) *
      Math.sin(dLon/2) * Math.sin(dLon/2);

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    const distance = R * c;
    return distance;
  }

  toRadians(degrees) {
    return degrees * (Math.PI/180);
  }

  // Batch Operations
  async batchUpdate(operations) {
    try {
      const batch = writeBatch(this.db);

      operations.forEach(operation => {
        const { type, collectionName, docId, data } = operation;
        const docRef = doc(this.db, collectionName, docId);

        switch (type) {
          case 'set':
            batch.set(docRef, data);
            break;
          case 'update':
            batch.update(docRef, data);
            break;
          case 'delete':
            batch.delete(docRef);
            break;
        }
      });

      await batch.commit();
      return { success: true };
    } catch (error) {
      console.error('Error in batch update:', error);
      return { success: false, error: error.message };
    }
  }
}

// Create and export singleton instance
const firestoreService = new FirestoreService();
export default firestoreService;