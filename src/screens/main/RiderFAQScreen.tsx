import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useTranslation } from 'react-i18next';

const RiderFAQScreen = ( { navigation } ) => {
  const { t } = useTranslation();
  const [expandedId, setExpandedId] = useState(null);

  const faqs = [
    {
      id: 1,
      question: t('faq.q1'),
      answer: t('faq.a1'),
    },
    {
      id: 2,
      question: t('faq.q2'),
      answer: t('faq.a2'),
    },
    {
      id: 3,
      question: t('faq.q3'),
      answer: t('faq.a3'),
    },
    {
      id: 4,
      question: t('faq.q4'),
      answer: t('faq.a4'),
    },
    {
      id: 5,
      question: t('faq.q5'),
      answer: t('faq.a5'),
    },
    {
      id: 6,
      question: t('faq.q6'),
      answer: t('faq.a6'),
    },
    {
      id: 7,
      question: t('faq.q7'),
      answer: t('faq.a7'),
    },
    {
      id: 8,
      question: t('faq.q8'),
      answer: t('faq.a8'),
    },
    {
      id: 9,
      question: t('faq.q9'),
      answer: t('faq.a9'),
    },
    {
      id: 10,
      question: t('faq.q10'),
      answer: t('faq.a10'),
    },
    {
      id: 11,
      question: t('faq.q11'),
      answer: t('faq.a11'),
    },
    {
      id: 12,
      question: t('faq.q12'),
      answer: t('faq.a12'),
    },
  ];

  const toggleExpand = (id) => {
    setExpandedId(expandedId === id ? null : id);
  };

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>{t('support.faq_title')}</Text>
      <Text style={styles.subtitle}>
        {t('support.faq_subtitle')}
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
        <Text style={styles.contactTitle}>{t('support.still_have_questions')}</Text>
        <Text style={styles.contactText}>
          {t('support.support_team_help')}
        </Text>
        <TouchableOpacity
            style={styles.contactButton}
            onPress={() => navigation.navigate('RiderContactSupport')}
            >
          <Ionicons name="chatbubble-outline" size={18} color="#fff" />
          <Text style={styles.contactButtonText}>{t('support.contact_title')}</Text>
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
