import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  Linking,
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useTranslation } from 'react-i18next';

const RiderAboutScreen = ({ navigation }) => {
  const { t } = useTranslation();
  const handleOpenLink = (url) => {
    Linking.openURL(url).catch((err) =>
      console.error('Failed to open URL:', err)
    );
  };

  const handleCallSupport = () => {
    Linking.openURL('tel:+255712863555').catch((err) =>
      console.error('Failed to call:', err)
    );
  };

  const handleEmailSupport = () => {
    Linking.openURL('mailto:riders@bodago.co.tz').catch((err) =>
      console.error('Failed to email:', err)
    );
  };

  return (
    <ScrollView style={styles.container}>
      {/* Logo Section */}
      <View style={styles.logoContainer}>
        <Image
          source={require('../../assets/splash_logo.png')}
          style={styles.logo}
          resizeMode="contain"
        />
      </View>

      {/* App Version */}
      <View style={styles.versionContainer}>
        <Text style={styles.versionText}>{t('profile.version')} 1.0.0</Text>
        <Text style={styles.tagline}>{t('about.tagline')}</Text>
      </View>

      {/* About Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{t('about.about_title')}</Text>
        <Text style={styles.sectionContent}>
          {t('about.about_content')}
        </Text>
      </View>

      {/* Why Become a Rider Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{t('about.why_title')}</Text>
        <View style={styles.featureList}>
          <View style={styles.featureItem}>
            <Ionicons name="checkmark-circle" size={20} color="#0066cc" />
            <Text style={styles.featureText}>{t('about.competitive_earnings')}</Text>
          </View>
          <View style={styles.featureItem}>
            <Ionicons name="checkmark-circle" size={20} color="#0066cc" />
            <Text style={styles.featureText}>{t('about.flexible_hours')}</Text>
          </View>
          <View style={styles.featureItem}>
            <Ionicons name="checkmark-circle" size={20} color="#0066cc" />
            <Text style={styles.featureText}>{t('about.weekly_payouts')}</Text>
          </View>
          <View style={styles.featureItem}>
            <Ionicons name="checkmark-circle" size={20} color="#0066cc" />
            <Text style={styles.featureText}>{t('about.support_247')}</Text>
          </View>
          <View style={styles.featureItem}>
            <Ionicons name="checkmark-circle" size={20} color="#0066cc" />
            <Text style={styles.featureText}>{t('about.bonus_opportunities')}</Text>
          </View>
        </View>
      </View>

      {/* How It Works Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{t('about.how_it_works')}</Text>
        <View style={styles.stepList}>
          <View style={styles.stepItem}>
            <View style={styles.stepNumber}>
              <Text style={styles.stepNumberText}>1</Text>
            </View>
            <View style={styles.stepContent}>
              <Text style={styles.stepTitle}>{t('about.step1_title')}</Text>
              <Text style={styles.stepDesc}>{t('about.step1_desc')}</Text>
            </View>
          </View>
          <View style={styles.stepItem}>
            <View style={styles.stepNumber}>
              <Text style={styles.stepNumberText}>2</Text>
            </View>
            <View style={styles.stepContent}>
              <Text style={styles.stepTitle}>{t('about.step2_title')}</Text>
              <Text style={styles.stepDesc}>{t('about.step2_desc')}</Text>
            </View>
          </View>
          <View style={styles.stepItem}>
            <View style={styles.stepNumber}>
              <Text style={styles.stepNumberText}>3</Text>
            </View>
            <View style={styles.stepContent}>
              <Text style={styles.stepTitle}>{t('about.step3_title')}</Text>
              <Text style={styles.stepDesc}>{t('about.step3_desc')}</Text>
            </View>
          </View>
          <View style={styles.stepItem}>
            <View style={styles.stepNumber}>
              <Text style={styles.stepNumberText}>4</Text>
            </View>
            <View style={styles.stepContent}>
              <Text style={styles.stepTitle}>{t('about.step4_title')}</Text>
              <Text style={styles.stepDesc}>{t('about.step4_desc')}</Text>
            </View>
          </View>
        </View>
      </View>

      {/* Vehicle Types Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{t('about.vehicles_supported')}</Text>
        <View style={styles.vehicleList}>
          <View style={styles.vehicleItem}>
            <Ionicons name="bicycle" size={24} color="#0066cc" />
            <View style={styles.vehicleContent}>
              <Text style={styles.vehicleTitle}>Bodaboda</Text>
              <Text style={styles.vehicleDesc}>{t('about.boda_desc')}</Text>
            </View>
          </View>
          <View style={styles.vehicleItem}>
            <Ionicons name="car" size={24} color="#0066cc" />
            <View style={styles.vehicleContent}>
              <Text style={styles.vehicleTitle}>Bajaji</Text>
              <Text style={styles.vehicleDesc}>{t('about.bajaji_desc')}</Text>
            </View>
          </View>
          <View style={styles.vehicleItem}>
            <Ionicons name="car" size={24} color="#0066cc" />
            <View style={styles.vehicleContent}>
              <Text style={styles.vehicleTitle}>Guta</Text>
              <Text style={styles.vehicleDesc}>{t('about.guta_desc')}</Text>
            </View>
          </View>
        </View>
      </View>

      {/* Contact Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{t('about.contact_us')}</Text>
        <TouchableOpacity
          style={styles.contactItem}
          onPress={handleCallSupport}
        >
          <Ionicons name="call" size={20} color="#0066cc" />
          <View style={styles.contactContent}>
            <Text style={styles.contactLabel}>{t('about.phone')}</Text>
            <Text style={styles.contactValue}>+255 712 863 555</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color="#ccc" />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.contactItem}
          onPress={handleEmailSupport}
        >
          <Ionicons name="mail" size={20} color="#0066cc" />
          <View style={styles.contactContent}>
            <Text style={styles.contactLabel}>{t('about.email')}</Text>
            <Text style={styles.contactValue}>riders@bodago.co.tz</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color="#ccc" />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.contactItem}
          onPress={() => handleOpenLink('https://bodago.co.tz')}
        >
          <Ionicons name="globe" size={20} color="#0066cc" />
          <View style={styles.contactContent}>
            <Text style={styles.contactLabel}>{t('about.website')}</Text>
            <Text style={styles.contactValue}>bodago.co.tz</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color="#ccc" />
        </TouchableOpacity>
      </View>

      {/* Legal Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{t('about.legal')}</Text>
        <TouchableOpacity
          style={styles.linkItem}
          onPress={() => navigation.navigate('TermsOfService')}
        >
          <Text style={styles.linkText}>{t('profile.terms')}</Text>
          <Ionicons name="chevron-forward" size={18} color="#ccc" />
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.linkItem}
          onPress={() => navigation.navigate('PrivacyPolicy')}
        >
          <Text style={styles.linkText}>{t('profile.privacy')}</Text>
          <Ionicons name="chevron-forward" size={18} color="#ccc" />
        </TouchableOpacity>
      </View>

      {/* Footer */}
      <View style={styles.footer}>
        <Text style={styles.footerText}>{t('profile.copyright')}</Text>
        <Text style={styles.footerText}>{t('about.built_for_africa')}</Text>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  logoContainer: {
    alignItems: 'center',
    paddingVertical: 5,
    backgroundColor: '#fff',
  },
  logo: {
    width: 150,
    height: 150,
  },
  versionContainer: {
    alignItems: 'center',
    paddingVertical: 5,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  appName: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#0066cc',
    marginBottom: 5,
  },
  versionText: {
    fontSize: 14,
    color: '#999',
    marginBottom: 3,
  },
  tagline: {
    fontSize: 14,
    color: '#666',
    fontStyle: 'italic',
  },
  section: {
    backgroundColor: '#fff',
    marginTop: 15,
    paddingHorizontal: 20,
    paddingVertical: 20,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 15,
  },
  sectionContent: {
    fontSize: 14,
    color: '#666',
    lineHeight: 22,
  },
  featureList: {
    marginTop: 10,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  featureText: {
    fontSize: 14,
    color: '#333',
    marginLeft: 12,
  },
  stepList: {
    marginTop: 10,
  },
  stepItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 18,
  },
  stepNumber: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#0066cc',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 15,
  },
  stepNumberText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  stepContent: {
    flex: 1,
  },
  stepTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  stepDesc: {
    fontSize: 12,
    color: '#999',
  },
  vehicleList: {
    marginTop: 10,
  },
  vehicleItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  vehicleContent: {
    marginLeft: 15,
    flex: 1,
  },
  vehicleTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 3,
  },
  vehicleDesc: {
    fontSize: 12,
    color: '#999',
  },
  contactItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  contactContent: {
    marginLeft: 15,
    flex: 1,
  },
  contactLabel: {
    fontSize: 12,
    color: '#999',
    marginBottom: 3,
  },
  contactValue: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333',
  },
  linkItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  linkText: {
    fontSize: 14,
    color: '#0066cc',
    fontWeight: '500',
  },
  footer: {
    alignItems: 'center',
    paddingVertical: 30,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
    marginTop: 15,
  },
  footerText: {
    fontSize: 12,
    color: '#999',
    marginBottom: 5,
  },
});

export default RiderAboutScreen;
