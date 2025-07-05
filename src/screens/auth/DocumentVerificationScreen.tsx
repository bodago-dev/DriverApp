import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';

const DocumentVerificationScreen = ({ route, navigation }) => {
  const { driverProfile, vehicleInfo } = route.params;
  
  const [documents, setDocuments] = useState({
    drivingLicense: null,
    vehicleRegistration: null,
    nationalId: null,
    insuranceDocument: null,
  });
  
  const [isLoading, setIsLoading] = useState(false);

  const documentTypes = [
    { 
      id: 'drivingLicense', 
      name: 'Driving License', 
      icon: 'card-outline',
      required: true,
      description: 'Valid driving license (front and back)'
    },
    { 
      id: 'vehicleRegistration', 
      name: 'Vehicle Registration', 
      icon: 'document-text-outline',
      required: true,
      description: 'Vehicle registration card or document'
    },
    { 
      id: 'nationalId', 
      name: 'National ID / Passport', 
      icon: 'person-outline',
      required: true,
      description: 'National ID card or passport'
    },
    { 
      id: 'insuranceDocument', 
      name: 'Insurance Document', 
      icon: 'shield-checkmark-outline',
      required: false,
      description: 'Vehicle insurance document (if available)'
    },
  ];

  const handleUploadDocument = (documentId) => {
    // In a real app, this would open the camera or file picker
    // For demo purposes, we'll simulate uploading a document
    
    Alert.alert(
      'Upload Document',
      'Choose upload method',
      [
        {
          text: 'Take Photo',
          onPress: () => simulateDocumentUpload(documentId, 'camera'),
        },
        {
          text: 'Choose from Gallery',
          onPress: () => simulateDocumentUpload(documentId, 'gallery'),
        },
        {
          text: 'Cancel',
          style: 'cancel',
        },
      ]
    );
  };

  const simulateDocumentUpload = (documentId, source) => {
    // Simulate document upload
    const updatedDocuments = { ...documents };
    updatedDocuments[documentId] = {
      id: `${documentId}_${Date.now()}`,
      name: `${documentTypes.find(doc => doc.id === documentId).name}.jpg`,
      source,
      uploadDate: new Date().toISOString(),
    };
    
    setDocuments(updatedDocuments);
  };

  const handleSubmit = () => {
    // Check if all required documents are uploaded
    const missingRequiredDocuments = documentTypes
      .filter(doc => doc.required && !documents[doc.id])
      .map(doc => doc.name);
    
    if (missingRequiredDocuments.length > 0) {
      Alert.alert(
        'Missing Documents',
        `Please upload the following required documents:\n${missingRequiredDocuments.join('\n')}`,
      );
      return;
    }

    setIsLoading(true);

    // Simulate API call to submit documents
    setTimeout(() => {
      setIsLoading(false);
      
      // Show success message and navigate to verification pending screen
      Alert.alert(
        'Documents Submitted',
        'Your documents have been submitted for verification. This process may take 1-2 business days. We will notify you once your account is approved.',
        [
          {
            text: 'OK',
            onPress: () => {
              // In a real app, this would navigate to a verification pending screen
              // For demo purposes, we'll navigate to the main app
              // navigation.navigate('Home');
              navigation.reset({
                index: 0,
                routes: [{ name: 'Main' }],
              });
            },
          },
        ]
      );
    }, 2000);
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContainer}>
        <Text style={styles.title}>Document Verification</Text>
        <Text style={styles.subtitle}>
          Upload the required documents to verify your account
        </Text>

        <View style={styles.documentsContainer}>
          {documentTypes.map((document) => (
            <View key={document.id} style={styles.documentCard}>
              <View style={styles.documentHeader}>
                <View style={styles.documentIconContainer}>
                  <Ionicons name={document.icon} size={24} color="#0066cc" />
                </View>
                <View style={styles.documentInfo}>
                  <Text style={styles.documentName}>
                    {document.name}
                    {document.required && <Text style={styles.required}> *</Text>}
                  </Text>
                  <Text style={styles.documentDescription}>{document.description}</Text>
                </View>
              </View>
              
              {documents[document.id] ? (
                <View style={styles.uploadedDocument}>
                  <View style={styles.uploadedDocumentInfo}>
                    <Ionicons name="checkmark-circle" size={20} color="#4caf50" />
                    <Text style={styles.uploadedDocumentName}>{documents[document.id].name}</Text>
                  </View>
                  <TouchableOpacity 
                    style={styles.reuploadButton}
                    onPress={() => handleUploadDocument(document.id)}>
                    <Text style={styles.reuploadButtonText}>Re-upload</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <TouchableOpacity 
                  style={styles.uploadButton}
                  onPress={() => handleUploadDocument(document.id)}>
                  <Ionicons name="cloud-upload-outline" size={18} color="#0066cc" />
                  <Text style={styles.uploadButtonText}>Upload Document</Text>
                </TouchableOpacity>
              )}
            </View>
          ))}
        </View>

        <View style={styles.infoContainer}>
          <Ionicons name="information-circle-outline" size={20} color="#0066cc" />
          <Text style={styles.infoText}>
            All documents must be clear, legible, and valid. Verification may take 1-2 business days.
          </Text>
        </View>

        <TouchableOpacity
          style={[styles.button, isLoading && styles.buttonDisabled]}
          onPress={handleSubmit}
          disabled={isLoading}>
          <Text style={styles.buttonText}>
            {isLoading ? 'Submitting...' : 'Submit Documents'}
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  scrollContainer: {
    flexGrow: 1,
    padding: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    textAlign: 'center',
    marginBottom: 10,
    marginTop: 20,
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 30,
  },
  documentsContainer: {
    marginBottom: 20,
  },
  documentCard: {
    backgroundColor: '#f9f9f9',
    borderRadius: 8,
    padding: 15,
    marginBottom: 15,
    borderWidth: 1,
    borderColor: '#eee',
  },
  documentHeader: {
    flexDirection: 'row',
    marginBottom: 12,
  },
  documentIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#e6f2ff',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  documentInfo: {
    flex: 1,
  },
  documentName: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333',
    marginBottom: 4,
  },
  documentDescription: {
    fontSize: 13,
    color: '#666',
  },
  required: {
    color: '#f44336',
  },
  uploadButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#e6f2ff',
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: '#cce5ff',
  },
  uploadButtonText: {
    color: '#0066cc',
    fontSize: 14,
    fontWeight: '500',
    marginLeft: 8,
  },
  uploadedDocument: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#f0f7ff',
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: '#cce5ff',
  },
  uploadedDocumentInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  uploadedDocumentName: {
    fontSize: 14,
    color: '#333',
    marginLeft: 8,
  },
  reuploadButton: {
    backgroundColor: '#fff',
    borderRadius: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: '#ddd',
  },
  reuploadButtonText: {
    fontSize: 12,
    color: '#666',
  },
  infoContainer: {
    flexDirection: 'row',
    backgroundColor: '#e6f2ff',
    borderRadius: 8,
    padding: 12,
    marginBottom: 20,
  },
  infoText: {
    fontSize: 13,
    color: '#333',
    marginLeft: 8,
    flex: 1,
  },
  button: {
    backgroundColor: '#0066cc',
    borderRadius: 8,
    height: 50,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  buttonDisabled: {
    backgroundColor: '#99ccff',
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default DocumentVerificationScreen;
