import storage from '@react-native-firebase/storage';
import { getAuth } from '@react-native-firebase/auth';

class StorageService {
  /**
   * Uploads a file to Firebase Storage and returns the download URL.
   * @param {string} path - The local file path.
   * @param {string} destination - The destination path in Firebase Storage.
   * @returns {Promise<string>} - The download URL of the uploaded file.
   */
  async uploadFile(path, destination) {
    try {
      const auth = getAuth();
      const user = auth.currentUser;

      if (!user) {
        throw new Error('User must be authenticated to upload files.');
      }

      const reference = storage().ref(destination);
      await reference.putFile(path);
      const url = await reference.getDownloadURL();
      return url;
    } catch (error) {
      console.error('Error uploading file to Firebase Storage:', error);
      throw error;
    }
  }

  /**
   * Uploads a profile photo for the current user.
   * @param {string} localPath - The local path of the profile photo.
   * @returns {Promise<string>} - The download URL of the uploaded profile photo.
   */
  async uploadProfilePhoto(localPath) {
    const auth = getAuth();
    const user = auth.currentUser;
    const destination = `users/${user.uid}/profile_photo.jpg`;
    return this.uploadFile(localPath, destination);
  }

  /**
   * Uploads a document for the current user.
   * @param {string} localPath - The local path of the document.
   * @param {string} documentType - The type of document (e.g., 'drivingLicense').
   * @returns {Promise<string>} - The download URL of the uploaded document.
   */
  async uploadDocument(localPath, documentType) {
    const auth = getAuth();
    const user = auth.currentUser;
    const extension = localPath.split('.').pop();
    const timestamp = Date.now();
    const destination = `users/${user.uid}/documents/${documentType}_${timestamp}.${extension}`;
    return this.uploadFile(localPath, destination);
  }
}

const storageService = new StorageService();
export default storageService;
