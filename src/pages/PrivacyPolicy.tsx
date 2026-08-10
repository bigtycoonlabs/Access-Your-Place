import { ArrowLeft, Shield, Eye, Lock, Database, UserCheck, Globe, Mail, Phone, MapPin } from 'lucide-react';
import { Link } from 'react-router-dom';
import Footer from '@/components/Footer';
import SEO, { getBreadcrumbSchema } from '@/components/SEO';

export default function PrivacyPolicy() {
  const breadcrumbSchema = getBreadcrumbSchema([
    { name: 'Home', url: '/' },
    { name: 'Privacy Policy', url: '/privacy-policy' }
  ]);

  return (
    <div className="min-h-screen bg-gray-50">
      <SEO 
        title="Privacy Policy - Access Your Place"
        description="Privacy Policy for Access Your Place. Learn how we collect, use, and protect your personal information when using our rental arbitrage investment platform."
        keywords="privacy policy, data protection, personal information, CCPA, data security, Access Your Place privacy"
        canonicalUrl="/privacy-policy"
        ogType="website"
        structuredData={breadcrumbSchema}
      />

      {/* Header */}
      <header className="bg-[#1a365d] text-white py-6">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <Link 
            to="/" 
            className="inline-flex items-center text-[#d4a574] hover:text-white transition-colors mb-4"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Home
          </Link>
          <div className="flex items-center gap-3">
            <Shield className="w-10 h-10 text-[#d4a574]" />
            <div>
              <h1 className="text-3xl font-bold">Privacy Policy</h1>
              <p className="text-gray-300">Set Up Your Place LLC d/b/a Access Your Place</p>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="bg-white rounded-xl shadow-lg p-8 md:p-12">
          {/* Effective Date & Entity Info */}
          <div className="bg-green-50 border border-green-200 rounded-lg p-6 mb-8">
            <p className="text-sm text-green-800">
              <strong>Effective Date:</strong> January 23, 2026
            </p>
            <p className="text-sm text-green-800 mt-1">
              <strong>Entity:</strong> Set Up Your Place LLC d/b/a Access Your Place (a Cooper Family Inc. Company)
            </p>
            <p className="text-sm text-green-800 mt-1">
              <strong>Corporate Address:</strong> 1150 NW 72nd Ave, Tower I, Suite 455, Miami, FL 33126
            </p>
            <p className="text-sm text-green-800 mt-1">
              <strong>Email:</strong> privacy@accessyourplace.com
            </p>
          </div>

          {/* Introduction */}
          <section className="mb-10">
            <p className="text-gray-700 leading-relaxed">
              Access Your Place ("AYP," "we," "us," or "our") is committed to protecting your privacy and ensuring the security of your personal information. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our website, operator portal, and services. Please read this policy carefully to understand our practices regarding your personal data.
            </p>
          </section>

          {/* Section 1 */}
          <section className="mb-10">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-[#1a365d] rounded-full flex items-center justify-center">
                <Database className="w-5 h-5 text-white" />
              </div>
              <h2 className="text-2xl font-bold text-[#1a365d]">1. Information We Collect</h2>
            </div>
            <div className="prose prose-gray max-w-none pl-13">
              <h3 className="text-lg font-semibold text-gray-800 mb-3">Personal Information You Provide</h3>
              <p className="text-gray-700 mb-4">When you create an account, make inquiries, or use our services, we may collect:</p>
              <ul className="space-y-2 text-gray-700 mb-6">
                <li className="flex items-start">
                  <span className="w-2 h-2 bg-[#d4a574] rounded-full mt-2 mr-3 flex-shrink-0"></span>
                  <span><strong>Identity Information:</strong> Full name, email address, phone number, mailing address</span>
                </li>
                <li className="flex items-start">
                  <span className="w-2 h-2 bg-[#d4a574] rounded-full mt-2 mr-3 flex-shrink-0"></span>
                  <span><strong>Business Information:</strong> Company name, business entity type, EIN/Tax ID (for corporate applications)</span>
                </li>
                <li className="flex items-start">
                  <span className="w-2 h-2 bg-[#d4a574] rounded-full mt-2 mr-3 flex-shrink-0"></span>
                  <span><strong>Financial Information:</strong> Payment card details (processed securely via Stripe), bank account information for ACH payments</span>
                </li>
                <li className="flex items-start">
                  <span className="w-2 h-2 bg-[#d4a574] rounded-full mt-2 mr-3 flex-shrink-0"></span>
                  <span><strong>Investment Preferences:</strong> Target markets, property types, budget ranges, investment goals</span>
                </li>
                <li className="flex items-start">
                  <span className="w-2 h-2 bg-[#d4a574] rounded-full mt-2 mr-3 flex-shrink-0"></span>
                  <span><strong>Communication Records:</strong> Messages, emails, call recordings (with consent), support tickets</span>
                </li>
              </ul>

              <h3 className="text-lg font-semibold text-gray-800 mb-3">Information Collected Automatically</h3>
              <p className="text-gray-700 mb-4">When you access our platform, we automatically collect:</p>
              <ul className="space-y-2 text-gray-700">
                <li className="flex items-start">
                  <span className="w-2 h-2 bg-[#d4a574] rounded-full mt-2 mr-3 flex-shrink-0"></span>
                  <span><strong>Device Information:</strong> IP address, browser type, operating system, device identifiers</span>
                </li>
                <li className="flex items-start">
                  <span className="w-2 h-2 bg-[#d4a574] rounded-full mt-2 mr-3 flex-shrink-0"></span>
                  <span><strong>Usage Data:</strong> Pages visited, features used, time spent on platform, click patterns</span>
                </li>
                <li className="flex items-start">
                  <span className="w-2 h-2 bg-[#d4a574] rounded-full mt-2 mr-3 flex-shrink-0"></span>
                  <span><strong>Location Data:</strong> General geographic location based on IP address</span>
                </li>
                <li className="flex items-start">
                  <span className="w-2 h-2 bg-[#d4a574] rounded-full mt-2 mr-3 flex-shrink-0"></span>
                  <span><strong>Cookies and Tracking:</strong> Session cookies, authentication tokens, analytics data</span>
                </li>
              </ul>
            </div>
          </section>

          {/* Section 2 */}
          <section className="mb-10">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-[#1a365d] rounded-full flex items-center justify-center">
                <Eye className="w-5 h-5 text-white" />
              </div>
              <h2 className="text-2xl font-bold text-[#1a365d]">2. How We Use Your Information</h2>
            </div>
            <div className="prose prose-gray max-w-none pl-13">
              <p className="text-gray-700 mb-4">We use your personal information for the following purposes:</p>
              <ul className="space-y-3 text-gray-700">
                <li className="flex items-start">
                  <span className="w-2 h-2 bg-[#d4a574] rounded-full mt-2 mr-3 flex-shrink-0"></span>
                  <span><strong>Service Delivery:</strong> To provide acquisition services, process transactions, and manage your investor account</span>
                </li>
                <li className="flex items-start">
                  <span className="w-2 h-2 bg-[#d4a574] rounded-full mt-2 mr-3 flex-shrink-0"></span>
                  <span><strong>Deal Matching:</strong> To identify and present investment opportunities that match your preferences</span>
                </li>
                <li className="flex items-start">
                  <span className="w-2 h-2 bg-[#d4a574] rounded-full mt-2 mr-3 flex-shrink-0"></span>
                  <span><strong>Communication:</strong> To send deal alerts, service updates, newsletters (with consent), and respond to inquiries</span>
                </li>
                <li className="flex items-start">
                  <span className="w-2 h-2 bg-[#d4a574] rounded-full mt-2 mr-3 flex-shrink-0"></span>
                  <span><strong>Platform Improvement:</strong> To analyze usage patterns and improve our services, features, and user experience</span>
                </li>
                <li className="flex items-start">
                  <span className="w-2 h-2 bg-[#d4a574] rounded-full mt-2 mr-3 flex-shrink-0"></span>
                  <span><strong>Security:</strong> To detect, prevent, and address fraud, unauthorized access, and other security issues</span>
                </li>
                <li className="flex items-start">
                  <span className="w-2 h-2 bg-[#d4a574] rounded-full mt-2 mr-3 flex-shrink-0"></span>
                  <span><strong>Legal Compliance:</strong> To comply with applicable laws, regulations, and legal processes</span>
                </li>
              </ul>
            </div>
          </section>

          {/* Section 3 */}
          <section className="mb-10">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-[#1a365d] rounded-full flex items-center justify-center">
                <Globe className="w-5 h-5 text-white" />
              </div>
              <h2 className="text-2xl font-bold text-[#1a365d]">3. Information Sharing and Disclosure</h2>
            </div>
            <div className="prose prose-gray max-w-none pl-13">
              <p className="text-gray-700 mb-4">We may share your information with:</p>
              <ul className="space-y-3 text-gray-700">
                <li className="flex items-start">
                  <span className="w-2 h-2 bg-[#d4a574] rounded-full mt-2 mr-3 flex-shrink-0"></span>
                  <span><strong>Landlords and Property Managers:</strong> When you proceed with an acquisition, we share necessary information to facilitate the application and lease process</span>
                </li>
                <li className="flex items-start">
                  <span className="w-2 h-2 bg-[#d4a574] rounded-full mt-2 mr-3 flex-shrink-0"></span>
                  <span><strong>Service Providers:</strong> Third-party vendors who assist with payment processing (Stripe), email delivery (Resend), SMS notifications (Twilio), and analytics</span>
                </li>
                <li className="flex items-start">
                  <span className="w-2 h-2 bg-[#d4a574] rounded-full mt-2 mr-3 flex-shrink-0"></span>
                  <span><strong>Vetted Partners:</strong> With your consent, we may connect you with co-hosting managers, vendors, or consultants in our network</span>
                </li>
                <li className="flex items-start">
                  <span className="w-2 h-2 bg-[#d4a574] rounded-full mt-2 mr-3 flex-shrink-0"></span>
                  <span><strong>Legal Requirements:</strong> When required by law, court order, or government request, or to protect our rights and safety</span>
                </li>
                <li className="flex items-start">
                  <span className="w-2 h-2 bg-[#d4a574] rounded-full mt-2 mr-3 flex-shrink-0"></span>
                  <span><strong>Business Transfers:</strong> In connection with a merger, acquisition, or sale of assets, your information may be transferred to the acquiring entity</span>
                </li>
              </ul>
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mt-4">
                <p className="text-blue-800 text-sm">
                  <strong>Note:</strong> We never sell your personal information to third parties for marketing purposes.
                </p>
              </div>
            </div>
          </section>

          {/* Section 4 */}
          <section className="mb-10">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-[#1a365d] rounded-full flex items-center justify-center">
                <Lock className="w-5 h-5 text-white" />
              </div>
              <h2 className="text-2xl font-bold text-[#1a365d]">4. Data Security</h2>
            </div>
            <div className="prose prose-gray max-w-none pl-13">
              <p className="text-gray-700 mb-4">We implement robust security measures to protect your data:</p>
              <ul className="space-y-3 text-gray-700">
                <li className="flex items-start">
                  <span className="w-2 h-2 bg-[#d4a574] rounded-full mt-2 mr-3 flex-shrink-0"></span>
                  <span><strong>Encryption:</strong> All data transmitted to and from our platform is encrypted using TLS/SSL protocols</span>
                </li>
                <li className="flex items-start">
                  <span className="w-2 h-2 bg-[#d4a574] rounded-full mt-2 mr-3 flex-shrink-0"></span>
                  <span><strong>Secure Storage:</strong> Personal data is stored on secure servers with encryption at rest</span>
                </li>
                <li className="flex items-start">
                  <span className="w-2 h-2 bg-[#d4a574] rounded-full mt-2 mr-3 flex-shrink-0"></span>
                  <span><strong>Access Controls:</strong> Strict access controls limit employee access to personal data on a need-to-know basis</span>
                </li>
                <li className="flex items-start">
                  <span className="w-2 h-2 bg-[#d4a574] rounded-full mt-2 mr-3 flex-shrink-0"></span>
                  <span><strong>Payment Security:</strong> Payment information is processed by PCI-DSS compliant payment processors (Stripe)</span>
                </li>
                <li className="flex items-start">
                  <span className="w-2 h-2 bg-[#d4a574] rounded-full mt-2 mr-3 flex-shrink-0"></span>
                  <span><strong>Regular Audits:</strong> We conduct regular security assessments and vulnerability testing</span>
                </li>
                <li className="flex items-start">
                  <span className="w-2 h-2 bg-[#d4a574] rounded-full mt-2 mr-3 flex-shrink-0"></span>
                  <span><strong>Incident Response:</strong> We maintain procedures to detect, respond to, and recover from security incidents</span>
                </li>
              </ul>
            </div>
          </section>

          {/* Section 5 */}
          <section className="mb-10">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-[#1a365d] rounded-full flex items-center justify-center">
                <UserCheck className="w-5 h-5 text-white" />
              </div>
              <h2 className="text-2xl font-bold text-[#1a365d]">5. Your Rights and Choices</h2>
            </div>
            <div className="prose prose-gray max-w-none pl-13">
              <p className="text-gray-700 mb-4">You have the following rights regarding your personal information:</p>
              <ul className="space-y-3 text-gray-700">
                <li className="flex items-start">
                  <span className="w-2 h-2 bg-[#d4a574] rounded-full mt-2 mr-3 flex-shrink-0"></span>
                  <span><strong>Access:</strong> Request a copy of the personal information we hold about you</span>
                </li>
                <li className="flex items-start">
                  <span className="w-2 h-2 bg-[#d4a574] rounded-full mt-2 mr-3 flex-shrink-0"></span>
                  <span><strong>Correction:</strong> Request correction of inaccurate or incomplete information</span>
                </li>
                <li className="flex items-start">
                  <span className="w-2 h-2 bg-[#d4a574] rounded-full mt-2 mr-3 flex-shrink-0"></span>
                  <span><strong>Deletion:</strong> Request deletion of your personal information (subject to legal retention requirements)</span>
                </li>
                <li className="flex items-start">
                  <span className="w-2 h-2 bg-[#d4a574] rounded-full mt-2 mr-3 flex-shrink-0"></span>
                  <span><strong>Portability:</strong> Request a copy of your data in a portable, machine-readable format</span>
                </li>
                <li className="flex items-start">
                  <span className="w-2 h-2 bg-[#d4a574] rounded-full mt-2 mr-3 flex-shrink-0"></span>
                  <span><strong>Opt-Out:</strong> Unsubscribe from marketing communications at any time via email preferences or by contacting us</span>
                </li>
                <li className="flex items-start">
                  <span className="w-2 h-2 bg-[#d4a574] rounded-full mt-2 mr-3 flex-shrink-0"></span>
                  <span><strong>Cookie Preferences:</strong> Manage cookie settings through your browser or our cookie consent tool</span>
                </li>
              </ul>
              <p className="text-gray-700 mt-4">
                To exercise any of these rights, please contact us at <a href="mailto:privacy@accessyourplace.com" className="text-[#1a365d] underline">privacy@accessyourplace.com</a>. We will respond to your request within 30 days.
              </p>
            </div>
          </section>

          {/* Section 6 */}
          <section className="mb-10">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-[#1a365d] rounded-full flex items-center justify-center text-white font-bold">6</div>
              <h2 className="text-2xl font-bold text-[#1a365d]">Data Retention</h2>
            </div>
            <div className="prose prose-gray max-w-none pl-13">
              <p className="text-gray-700 mb-4">We retain your personal information for as long as necessary to:</p>
              <ul className="space-y-2 text-gray-700">
                <li className="flex items-start">
                  <span className="w-2 h-2 bg-[#d4a574] rounded-full mt-2 mr-3 flex-shrink-0"></span>
                  <span>Provide our services and maintain your account</span>
                </li>
                <li className="flex items-start">
                  <span className="w-2 h-2 bg-[#d4a574] rounded-full mt-2 mr-3 flex-shrink-0"></span>
                  <span>Comply with legal obligations (e.g., tax records, transaction history)</span>
                </li>
                <li className="flex items-start">
                  <span className="w-2 h-2 bg-[#d4a574] rounded-full mt-2 mr-3 flex-shrink-0"></span>
                  <span>Resolve disputes and enforce our agreements</span>
                </li>
                <li className="flex items-start">
                  <span className="w-2 h-2 bg-[#d4a574] rounded-full mt-2 mr-3 flex-shrink-0"></span>
                  <span>Maintain business records as required by law</span>
                </li>
              </ul>
              <p className="text-gray-700 mt-4">
                When data is no longer needed, we securely delete or anonymize it in accordance with our data retention policies.
              </p>
            </div>
          </section>

          {/* Section 7 */}
          <section className="mb-10">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-[#1a365d] rounded-full flex items-center justify-center text-white font-bold">7</div>
              <h2 className="text-2xl font-bold text-[#1a365d]">Cookies and Tracking Technologies</h2>
            </div>
            <div className="prose prose-gray max-w-none pl-13">
              <p className="text-gray-700 mb-4">We use cookies and similar technologies to:</p>
              <ul className="space-y-2 text-gray-700">
                <li className="flex items-start">
                  <span className="w-2 h-2 bg-[#d4a574] rounded-full mt-2 mr-3 flex-shrink-0"></span>
                  <span><strong>Essential Cookies:</strong> Enable core functionality like authentication and security</span>
                </li>
                <li className="flex items-start">
                  <span className="w-2 h-2 bg-[#d4a574] rounded-full mt-2 mr-3 flex-shrink-0"></span>
                  <span><strong>Analytics Cookies:</strong> Understand how visitors use our platform to improve performance</span>
                </li>
                <li className="flex items-start">
                  <span className="w-2 h-2 bg-[#d4a574] rounded-full mt-2 mr-3 flex-shrink-0"></span>
                  <span><strong>Preference Cookies:</strong> Remember your settings and preferences</span>
                </li>
              </ul>
              <p className="text-gray-700 mt-4">
                You can manage cookie preferences through your browser settings. Note that disabling certain cookies may affect platform functionality.
              </p>
            </div>
          </section>

          {/* Section 8 */}
          <section className="mb-10">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-[#1a365d] rounded-full flex items-center justify-center text-white font-bold">8</div>
              <h2 className="text-2xl font-bold text-[#1a365d]">Children's Privacy</h2>
            </div>
            <div className="prose prose-gray max-w-none pl-13">
              <p className="text-gray-700">
                Our services are not intended for individuals under 18 years of age. We do not knowingly collect personal information from children. If we become aware that we have collected information from a child under 18, we will take steps to delete that information promptly.
              </p>
            </div>
          </section>

          {/* Section 9 */}
          <section className="mb-10">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-[#1a365d] rounded-full flex items-center justify-center text-white font-bold">9</div>
              <h2 className="text-2xl font-bold text-[#1a365d]">California Privacy Rights (CCPA)</h2>
            </div>
            <div className="prose prose-gray max-w-none pl-13">
              <p className="text-gray-700 mb-4">
                If you are a California resident, you have additional rights under the California Consumer Privacy Act (CCPA):
              </p>
              <ul className="space-y-2 text-gray-700">
                <li className="flex items-start">
                  <span className="w-2 h-2 bg-[#d4a574] rounded-full mt-2 mr-3 flex-shrink-0"></span>
                  <span>Right to know what personal information is collected, used, shared, or sold</span>
                </li>
                <li className="flex items-start">
                  <span className="w-2 h-2 bg-[#d4a574] rounded-full mt-2 mr-3 flex-shrink-0"></span>
                  <span>Right to delete personal information held by businesses</span>
                </li>
                <li className="flex items-start">
                  <span className="w-2 h-2 bg-[#d4a574] rounded-full mt-2 mr-3 flex-shrink-0"></span>
                  <span>Right to opt-out of the sale of personal information (we do not sell personal information)</span>
                </li>
                <li className="flex items-start">
                  <span className="w-2 h-2 bg-[#d4a574] rounded-full mt-2 mr-3 flex-shrink-0"></span>
                  <span>Right to non-discrimination for exercising CCPA rights</span>
                </li>
              </ul>
            </div>
          </section>

          {/* Section 10 */}
          <section className="mb-10">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-[#1a365d] rounded-full flex items-center justify-center text-white font-bold">10</div>
              <h2 className="text-2xl font-bold text-[#1a365d]">Changes to This Policy</h2>
            </div>
            <div className="prose prose-gray max-w-none pl-13">
              <p className="text-gray-700">
                We may update this Privacy Policy from time to time to reflect changes in our practices or legal requirements. We will notify you of material changes by posting the updated policy on our website and, for registered users, via email notification. Your continued use of our services after such changes constitutes acceptance of the updated policy.
              </p>
            </div>
          </section>

          {/* Contact Information */}
          <section className="bg-[#1a365d] text-white rounded-xl p-8 mt-12">
            <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
              <Shield className="w-6 h-6 text-[#d4a574]" />
              Contact Us About Privacy
            </h2>
            <p className="text-gray-300 mb-6">
              If you have questions, concerns, or requests regarding this Privacy Policy or our data practices, please contact us:
            </p>
            <div className="grid md:grid-cols-3 gap-6">
              <div className="flex items-start gap-3">
                <Mail className="w-5 h-5 text-[#d4a574] mt-1" />
                <div>
                  <p className="font-semibold">Privacy Inquiries</p>
                  <a href="mailto:privacy@accessyourplace.com" className="text-[#d4a574] hover:underline">
                    privacy@accessyourplace.com
                  </a>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Phone className="w-5 h-5 text-[#d4a574] mt-1" />
                <div>
                  <p className="font-semibold">Phone</p>
                  <a href="tel:+13055551234" className="text-[#d4a574] hover:underline">
                    (305) 555-1234
                  </a>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <MapPin className="w-5 h-5 text-[#d4a574] mt-1" />
                <div>
                  <p className="font-semibold">Address</p>
                  <p className="text-gray-300 text-sm">
                    1150 NW 72nd Ave<br />
                    Tower I, Suite 455<br />
                    Miami, FL 33126
                  </p>
                </div>
              </div>
            </div>
          </section>

          {/* Links to Related Policies */}
          <div className="mt-8 p-6 bg-gray-100 rounded-lg">
            <h3 className="font-semibold text-gray-800 mb-3">Related Documents</h3>
            <div className="flex flex-wrap gap-4">
              <Link 
                to="/terms-of-service" 
                className="text-[#1a365d] hover:text-[#d4a574] underline transition-colors"
              >
                Terms of Service
              </Link>
            </div>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
