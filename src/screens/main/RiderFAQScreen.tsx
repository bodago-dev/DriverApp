import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';

const RiderFAQScreen = () => {
  const [expandedId, setExpandedId] = useState(null);

  const faqs = [
    {
      id: 1,
      question: 'How do I accept a delivery request?',
      answer:
        'When a new delivery request comes in, you will receive a notification. Tap on the notification or go to the Deliveries tab to see the request details. If you want to accept it, tap the "Accept" button. You have a limited time to respond.',
    },
    {
      id: 2,
      question: 'How are my earnings calculated?',
      answer:
        'Your earnings are calculated based on the distance traveled, vehicle type used, and time taken. Each delivery has a base fare plus distance charges. You can view the estimated earnings before accepting a delivery.',
    },
    {
      id: 3,
      question: 'When do I get paid?',
      answer:
        'Payments are processed weekly, typically on Fridays. Your earnings are transferred to your registered mobile money account (M-Pesa, Mixx by Yas, or Airtel Money). You can view your payment history in the Earnings section.',
    },
    {
      id: 4,
      question: 'What are the vehicle requirements?',
      answer:
        'You need a valid vehicle (Boda Boda, Bajaji, or Guta) with proper registration and insurance. Your vehicle must be in good condition and pass our verification process. You will need to provide vehicle documents during onboarding.',
    },
    {
      id: 5,
      question: 'What documents do I need to provide?',
      answer:
        'You need to provide: valid national ID, driver\'s license, vehicle registration, insurance certificate, and a clear profile photo. All documents must be valid and legible.',
    },
    {
      id: 6,
      question: 'How do I navigate to a delivery location?',
      answer:
        'Once you accept a delivery, tap the "Start Navigation" button to open the navigation screen. The app will show you the route to the pickup location, and then to the drop-off location. You can use the in-app navigation or switch to Google Maps.',
    },
    {
      id: 7,
      question: 'What if I need to cancel a delivery?',
      answer:
        'You can cancel a delivery before you arrive at the pickup location. However, cancellations may affect your acceptance rating. Try to avoid cancellations as much as possible.',
    },
    {
      id: 8,
      question: 'How do I update my vehicle information?',
      answer:
        'Go to your Profile screen and tap "Edit Profile". You can update your vehicle details there. If you change your vehicle, you will need to provide new vehicle documents for verification.',
    },
    {
      id: 9,
      question: 'What should I do if a customer complains?',
      answer:
        'If a customer files a complaint, our support team will contact you to investigate. Always maintain professionalism and follow the delivery instructions carefully. Repeated complaints may affect your account status.',
    },
    {
      id: 10,
      question: 'How do I contact support?',
      answer:
        'You can reach our support team via phone at +255 712 863 555 or email at support@bodago.co.tz. We are available 24/7 for urgent issues. Use the "Contact Support" option in the Help & Support section.',
    },
    {
      id: 11,
      question: 'Can I work part-time or full-time?',
      answer:
        'Yes! You can work whenever you want. Simply toggle your availability status in the app. When you are online, you will receive delivery requests. When offline, you won\'t receive any requests.',
    },
    {
      id: 12,
      question: 'What if I have an accident during delivery?',
      answer:
        'If you have an accident, immediately contact our support team at +255 712 863 555. Take photos of the damage and get the customer\'s contact information. Our team will guide you through the claims process.',
    },
  ];

  const toggleExpand = (id) => {
    setExpandedId(expandedId === id ? null : id);
  };

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>Frequently Asked Questions</Text>
      <Text style={styles.subtitle}>
        Find answers to common questions about earning with BodaGo
      </Text>

      <View style={styles.faqContainer}>
        {faqs.map((faq, index) => (
          <View key={faq.id}>
            <TouchableOpacity
              style={styles.faqItem}
              onPress={() => toggleExpand(faq.id)}
            >
              <View style={styles.faqHeader}>
                <Text style={styles.faqQuestion}>{faq.question}</Text>
                <Ionicons
                  name={
                    expandedId === faq.id
                      ? 'chevron-up'
                      : 'chevron-down'
                  }
                  size={20}
                  color="#0066cc"
                />
              </View>
            </TouchableOpacity>

            {expandedId === faq.id && (
              <View style={styles.faqAnswerContainer}>
                <Text style={styles.faqAnswer}>{faq.answer}</Text>
              </View>
            )}

            {index < faqs.length - 1 && <View style={styles.divider} />}
          </View>
        ))}
      </View>

      {/* Still Have Questions Section */}
      <View style={styles.contactSection}>
        <Ionicons name="help-circle-outline" size={32} color="#0066cc" />
        <Text style={styles.contactTitle}>Still have questions?</Text>
        <Text style={styles.contactText}>
          Our support team is here to help. Contact us anytime.
        </Text>
        <TouchableOpacity style={styles.contactButton}>
          <Ionicons name="chatbubble-outline" size={18} color="#fff" />
          <Text style={styles.contactButtonText}>Contact Support</Text>
        </TouchableOpacity>
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
  faqContainer: {
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
  faqItem: {
    paddingHorizontal: 15,
    paddingVertical: 15,
  },
  faqHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  faqQuestion: {
    fontSize: 15,
    fontWeight: '600',
    color: '#333',
    flex: 1,
    marginRight: 10,
  },
  faqAnswerContainer: {
    paddingHorizontal: 15,
    paddingBottom: 15,
    backgroundColor: '#f9f9f9',
  },
  faqAnswer: {
    fontSize: 14,
    color: '#666',
    lineHeight: 22,
  },
  divider: {
    height: 1,
    backgroundColor: '#f0f0f0',
  },
  contactSection: {
    backgroundColor: '#fff',
    borderRadius: 10,
    marginHorizontal: 15,
    marginBottom: 30,
    paddingVertical: 30,
    paddingHorizontal: 20,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  contactTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginTop: 15,
    marginBottom: 10,
  },
  contactText: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginBottom: 20,
  },
  contactButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0066cc',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
  },
  contactButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 8,
  },
});

export default RiderFAQScreen;
