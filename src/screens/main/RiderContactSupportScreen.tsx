import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
  Linking,
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';

const RiderContactSupportScreen = () => {
  const [selectedMethod, setSelectedMethod] = useState(null);
  const [message, setMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const contactMethods = [
    {
      id: 'phone',
      title: 'Call Us',
      description: '24/7 Support Line',
      icon: 'call',
      value: '+255 712 863 555',
    },
    {
      id: 'email',
      title: 'Email Us',
      description: 'We reply within 2 hours',
      icon: 'mail',
      value: 'support@bodago.co.tz',
    },
    {
      id: 'whatsapp',
      title: 'WhatsApp',
      description: 'Quick response',
      icon: 'logo-whatsapp',
      value: '+255 712 863 555',
    },
    {
      id: 'chat',
      title: 'Live Chat',
      description: 'Chat with our team',
      icon: 'chatbubble',
      value: 'Available 9 AM - 6 PM',
    },
  ];

  const handleCallSupport = () => {
    Linking.openURL('tel:+255712863555').catch((err) =>
      console.error('Failed to call:', err)
    );
  };

  const handleEmailSupport = () => {
    Linking.openURL('mailto:support@bodago.co.tz').catch((err) =>
      console.error('Failed to email:', err)
    );
  };

  const handleWhatsApp = () => {
    Linking.openURL('https://wa.me/255712863555').catch((err) =>
      console.error('Failed to open WhatsApp:', err)
    );
  };

  const handleSendMessage = async () => {
    if (!message.trim()) {
      Alert.alert('Error', 'Please enter your message');
      return;
    }

    setIsLoading(true);
    try {
      // Simulate sending message
      await new Promise((resolve) => setTimeout(resolve, 1500));
      Alert.alert(
        'Success',
        'Your message has been sent. We will get back to you soon.'
      );
      setMessage('');
      setSelectedMethod(null);
    } catch (error) {
      Alert.alert('Error', 'Failed to send message. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>Contact Support</Text>
      <Text style={styles.subtitle}>
        Choose how you'd like to reach us
      </Text>

      {/* Contact Methods */}
      <View style={styles.methodsContainer}>
        {contactMethods.map((method) => (
          <TouchableOpacity
            key={method.id}
            style={[
              styles.methodCard,
              selectedMethod === method.id && styles.methodCardSelected,
            ]}
            onPress={() => {
              if (method.id === 'phone') {
                handleCallSupport();
              } else if (method.id === 'email') {
                handleEmailSupport();
              } else if (method.id === 'whatsapp') {
                handleWhatsApp();
              } else {
                setSelectedMethod(method.id);
              }
            }}
          >
            <Ionicons
              name={method.icon}
              size={28}
              color={selectedMethod === method.id ? '#fff' : '#0066cc'}
            />
            <Text
              style={[
                styles.methodTitle,
                selectedMethod === method.id && styles.methodTitleSelected,
              ]}
            >
              {method.title}
            </Text>
            <Text
              style={[
                styles.methodDescription,
                selectedMethod === method.id && styles.methodDescriptionSelected,
              ]}
            >
              {method.description}
            </Text>
            <Text
              style={[
                styles.methodValue,
                selectedMethod === method.id && styles.methodValueSelected,
              ]}
            >
              {method.value}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Message Form */}
      {selectedMethod === 'chat' && (
        <View style={styles.formContainer}>
          <Text style={styles.formTitle}>Send us a message</Text>
          <TextInput
            style={styles.messageInput}
            placeholder="Describe your issue or question..."
            placeholderTextColor="#999"
            multiline
            numberOfLines={6}
            value={message}
            onChangeText={setMessage}
            editable={!isLoading}
            textAlignVertical="top"
          />
          <TouchableOpacity
            style={[styles.sendButton, isLoading && styles.sendButtonDisabled]}
            onPress={handleSendMessage}
            disabled={isLoading}
          >
            {isLoading ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <>
                <Ionicons name="send" size={18} color="#fff" />
                <Text style={styles.sendButtonText}>Send Message</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      )}

      {/* Quick Links */}
      <View style={styles.quickLinksContainer}>
        <Text style={styles.quickLinksTitle}>Quick Links</Text>
        <TouchableOpacity style={styles.quickLink}>
          <Ionicons name="help-circle-outline" size={20} color="#0066cc" />
          <Text style={styles.quickLinkText}>View FAQ</Text>
          <Ionicons name="chevron-forward" size={18} color="#ccc" />
        </TouchableOpacity>
        <TouchableOpacity style={styles.quickLink}>
          <Ionicons name="document-text-outline" size={20} color="#0066cc" />
          <Text style={styles.quickLinkText}>Terms & Conditions</Text>
          <Ionicons name="chevron-forward" size={18} color="#ccc" />
        </TouchableOpacity>
        <TouchableOpacity style={styles.quickLink}>
          <Ionicons name="shield-checkmark-outline" size={20} color="#0066cc" />
          <Text style={styles.quickLinkText}>Privacy Policy</Text>
          <Ionicons name="chevron-forward" size={18} color="#ccc" />
        </TouchableOpacity>
      </View>

      {/* Info Box */}
      <View style={styles.infoBox}>
        <Ionicons name="information-circle-outline" size={20} color="#0066cc" />
        <Text style={styles.infoText}>
          Our support team typically responds within 2 hours during business
          hours. For urgent issues, please call our 24/7 support line.
        </Text>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
    marginTop: 20,
    marginHorizontal: 20,
  },
  subtitle: {
    fontSize: 14,
    color: '#666',
    marginBottom: 20,
    marginHorizontal: 20,
  },
  methodsContainer: {
    marginHorizontal: 15,
    marginBottom: 20,
  },
  methodCard: {
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 15,
    marginBottom: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#f0f0f0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  methodCardSelected: {
    backgroundColor: '#0066cc',
    borderColor: '#0066cc',
  },
  methodTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginTop: 10,
    marginBottom: 4,
  },
  methodTitleSelected: {
    color: '#fff',
  },
  methodDescription: {
    fontSize: 12,
    color: '#999',
    marginBottom: 6,
  },
  methodDescriptionSelected: {
    color: '#e6f2ff',
  },
  methodValue: {
    fontSize: 13,
    color: '#0066cc',
    fontWeight: '500',
  },
  methodValueSelected: {
    color: '#fff',
  },
  formContainer: {
    backgroundColor: '#fff',
    borderRadius: 10,
    marginHorizontal: 15,
    marginBottom: 20,
    padding: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  formTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 15,
  },
  messageInput: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    color: '#333',
    marginBottom: 15,
    minHeight: 120,
  },
  sendButton: {
    flexDirection: 'row',
    backgroundColor: '#0066cc',
    borderRadius: 8,
    padding: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendButtonDisabled: {
    backgroundColor: '#99ccff',
  },
  sendButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 8,
  },
  quickLinksContainer: {
    backgroundColor: '#fff',
    borderRadius: 10,
    marginHorizontal: 15,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
    overflow: 'hidden',
  },
  quickLinksTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    paddingHorizontal: 15,
    paddingTop: 15,
    marginBottom: 10,
  },
  quickLink: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 15,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  quickLinkText: {
    fontSize: 14,
    color: '#333',
    flex: 1,
    marginLeft: 12,
  },
  infoBox: {
    flexDirection: 'row',
    backgroundColor: '#e6f2ff',
    borderRadius: 8,
    padding: 15,
    marginHorizontal: 15,
    marginBottom: 30,
    alignItems: 'flex-start',
  },
  infoText: {
    fontSize: 13,
    color: '#0066cc',
    marginLeft: 10,
    flex: 1,
  },
});

export default RiderContactSupportScreen;
