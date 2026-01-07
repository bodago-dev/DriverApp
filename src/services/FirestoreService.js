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
import { arrayUnion } from '@react-native-firebase/firestore'; // Import arrayUnion if it's used elsewhere, but not strictly needed for the new function


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

  // Admin method to activate rider
  async activateRiderProfile(riderId) {
      try {
          const updateData = {
              verificationStatus: 'active',
              activatedAt: serverTimestamp(),
              updatedAt: serverTimestamp()
          };

          await updateDoc(doc(this.db, 'users', riderId), updateData);
          return { success: true };
      } catch (error) {
          console.error('Error activating rider profile:', error);
          return { success: false, error: error.message };
      }
  }

  // Admin method to deactivate/suspend rider
  async deactivateRiderProfile(riderId, reason = '') {
      try {
          const updateData = {
              verificationStatus: 'suspended',
              deactivatedAt: serverTimestamp(),
              deactivationReason: reason,
              updatedAt: serverTimestamp()
          };

          await updateDoc(doc(this.db, 'users', riderId), updateData);
          return { success: true };
      } catch (error) {
          console.error('Error deactivating rider profile:', error);
          return { success: false, error: error.message };
      }
  }

  // Get riders by verification status (for admin panel)
  async getRidersByStatus(status, limitCount = 50) {
      try {
          const q = query(
              collection(this.db, 'users'),
              where('role', '==', 'rider'),
              where('verificationStatus', '==', status),
              orderBy('createdAt', 'desc'),
              limit(limitCount)
          );

          const querySnapshot = await getDocs(q);
          const riders = [];

          querySnapshot.forEach(doc => {
              riders.push({ id: doc.id, ...doc.data() });
          });

          return { success: true, riders };
      } catch (error) {
          console.error('Error getting riders by status:', error);
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
        expiresAt: new Date(Date.now() + 300000) // 300 seconds
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
        status: 'pending',
        createdAt: serverTimestamp(),
        timeline: {
          pending: serverTimestamp()
        }
      };

      const docRef = await addDoc(collection(this.db, 'deliveries'), delivery);

      // Add searching status update
      await this.updateDeliveryStatus(docRef.id, 'searching');

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

  // Update delivery status
  async updateDeliveryStatus(deliveryId, status, additionalData = {}) {
    try {
      const batch = writeBatch(this.db);

      // 1. Update delivery document
      const deliveryRef = doc(this.db, 'deliveries', deliveryId);
      batch.update(deliveryRef, {
        status,
        updatedAt: serverTimestamp(),
        [`timeline.${status}`]: serverTimestamp(),
        ...additionalData
      });

      // 2. If we have a requestId, update the corresponding request
      if (additionalData.requestId) {
        const requestRef = doc(this.db, 'delivery_requests', additionalData.requestId);
        const requestStatus = this.mapDeliveryStatusToRequestStatus(status);

        batch.update(requestRef, {
          status: requestStatus,
          updatedAt: serverTimestamp()
        });
      }

      await batch.commit();
      return { success: true };
    } catch (error) {
      console.error('Error updating delivery status:', error);
      return { success: false, error: error.message };
    }
  }

  // Enhanced status mapping
  mapDeliveryStatusToRequestStatus(deliveryStatus) {
    const statusMap = {
      'accepted': 'accepted',
      'driver_assigned': 'accepted',
      'arrived_pickup': 'in_progress',
      'in_transit': 'in_progress',
      'arrived_dropoff': 'in_progress',
      'delivered': 'completed',
      'cancelled': 'cancelled',
      'failed': 'failed'
    };

    return statusMap[deliveryStatus] || deliveryStatus;
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
  async getUserDeliveries(userId, role = 'driver', limitCount = 20) {
    try {
      const field = role === 'driver' ? 'driverId' : 'customerId';
      const q = query(
        collection(this.db, 'deliveries'),
        where(field, '==', userId),
        orderBy('createdAt', 'desc'),
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
  async assignDriverToDelivery(deliveryId, driverId) {
    try {
      const updateData = {
        driverId,
        status: 'accepted',
        updatedAt: serverTimestamp(),
        [`timeline.accepted`]: serverTimestamp()
      };

      await updateDoc(doc(this.db, 'deliveries', deliveryId), updateData);
      return { success: true };
    } catch (error) {
      console.error('Error assigning driver:', error);
      return { success: false, error: error.message };
    }
  }

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
      const locationData = {
        online: isOnline,
        timestamp: serverTimestamp()
      };

      // Use setDoc with merge instead of updateDoc
      await setDoc(doc(this.db, 'driver_locations', driverId), locationData, { merge: true });
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

  subscribeToDeliveryRequests(driverLocation, vehicleType = null, callback) {
    if (!driverLocation) {
      console.log('Driver location not available');
      callback([], new Error('Driver location not available'));
      return () => {};
    }

    console.log('Driver location and vehicle type:', driverLocation, vehicleType);

    return onSnapshot(
      query(
        collection(this.db, 'delivery_requests'),
        where('status', '==', 'pending'),
        where('expiresAt', '>', new Date()),
      ),
      (snapshot) => {
        const requests = [];
        snapshot.forEach(doc => {
          const request = { id: doc.id, ...doc.data() };

          // Handle different pickup location formats
          let pickupCoords = null;

          // Case 1: Coordinates are in a nested coordinates object
          if (request.pickupLocation?.coordinates) {
            pickupCoords = request.pickupLocation.coordinates;
          }
          // Case 2: Direct GeoPoint or {latitude, longitude} object
          else if (request.pickupLocation) {
            pickupCoords = request.pickupLocation;
          }

          // Handle Firestore GeoPoint if needed
          if (pickupCoords && typeof pickupCoords.latitude === 'function') {
            pickupCoords = {
              latitude: pickupCoords.latitude(),
              longitude: pickupCoords.longitude()
            };
          }

          // Verify we have valid coordinates
          if (pickupCoords &&
              typeof pickupCoords.latitude === 'number' &&
              typeof pickupCoords.longitude === 'number') {

            // Check vehicle type compatibility
            const isVehicleCompatible = this.isVehicleTypeCompatible(
              vehicleType,
              request.selectedVehicle.id
            );

            if (isVehicleCompatible) {
              const distance = this.calculateDistance(
                driverLocation,
                pickupCoords
              );

              console.log("Distance calculated:", distance);
              if (distance <= 5) { // 5km radius
                requests.push({
                  ...request,
                  distance,
                  pickupLocation: {
                    address: request.pickupLocation.address || request.pickupAddress || 'Address not available',
                    coordinates: pickupCoords
                  }
                });
              }
            }
          } else {
            console.warn('Invalid pickup location format:', request.pickupLocation);
          }
        });
        callback(requests);
        console.log("Filtered requests by vehicle type:", requests);
      },
      (error) => {
        console.error('Delivery request subscription error:', error);
        if (error.code === 'failed-precondition') {
          callback([], new Error('Server configuration in progress. Please try again shortly.'));
        } else {
          callback([], error);
        }
      }
    );
  }

  // Vehicle type compatibility check - exact matching only
  isVehicleTypeCompatible(driverVehicleType, requestVehicleType) {
    // If no vehicle type filtering is needed (driverVehicleType is null),
    // or if the request doesn't specify a vehicle type, show all requests
    if (!driverVehicleType || !requestVehicleType) {
      return true;
    }

    // Normalize vehicle types for comparison
    const normalizedDriverType = driverVehicleType.toLowerCase().trim();
    const normalizedRequestType = requestVehicleType.toLowerCase().trim();

    // For exact matching, we only show requests that exactly match the driver's vehicle type
    return normalizedDriverType === normalizedRequestType;
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

  // Payment Management
  async getPaymentByDeliveryId(deliveryId) {
    try {
      const q = query(
        collection(this.db, 'payments'),
        where('deliveryId', '==', deliveryId),
        limit(1)
      );

      const querySnapshot = await getDocs(q);

      if (!querySnapshot.empty) {
        const doc = querySnapshot.docs[0];
        return { success: true, payment: { id: doc.id, ...doc.data() } };
      } else {
        return { success: false, error: 'Payment record not found for this delivery' };
      }
    } catch (error) {
      console.error('Error getting payment by delivery ID:', error);
      return { success: false, error: error.message };
    }
  }

  async completeDeliveryAndPayment(deliveryId, paymentMethod) {
    try {
      const batch = writeBatch(this.db);

      // 1. Update delivery status to 'delivered'
      const deliveryRef = doc(this.db, 'deliveries', deliveryId);
      batch.update(deliveryRef, {
        status: 'delivered',
        updatedAt: serverTimestamp(),
        'timeline.delivered': serverTimestamp()
      });

      // 2. Update payment status to 'paid' if it's a cash payment
      if (paymentMethod === 'cash') {
        const paymentResult = await this.getPaymentByDeliveryId(deliveryId);
        if (paymentResult.success) {
          const paymentRef = doc(this.db, 'payments', paymentResult.payment.id);
          batch.update(paymentRef, {
            status: 'paid',
            updatedAt: serverTimestamp(),
            paymentDate: serverTimestamp()
          });
        } else {
          // Log a warning, but don't fail the delivery completion if payment record is missing
          console.warn(`Payment record not found for cash delivery ${deliveryId}. Delivery status will still be updated.`);
        }
      }
      // For other payment methods (e.g., mpesa, airtelmoney), we assume the payment is handled
      // and updated to 'paid' by a separate system/webhook before this point.

      await batch.commit();
      return { success: true };
    } catch (error) {
      console.error('Error completing delivery and payment:', error);
      return { success: false, error: error.message };
    }
  }

  // Utility Functions
  calculateDistance(location1, location2) {
    console.log('Calculating distance between:', location1, location2);

    // Verify both locations have numbers
    if (typeof location1.latitude !== 'number' || typeof location1.longitude !== 'number' ||
        typeof location2.latitude !== 'number' || typeof location2.longitude !== 'number') {
      console.error('Invalid location coordinates:', { location1, location2 });
      return NaN;
    }

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

    console.log('Distance result:', distance);
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