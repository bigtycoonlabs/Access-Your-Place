import { ArrowLeft, FileText, Scale, Shield, AlertTriangle, Phone, Mail, MapPin } from 'lucide-react';
import { Link } from 'react-router-dom';
import Footer from '@/components/Footer';
import SEO, { getBreadcrumbSchema } from '@/components/SEO';

export default function TermsOfService() {
  const breadcrumbSchema = getBreadcrumbSchema([
    { name: 'Home', url: '/' },
    { name: 'Terms of Service', url: '/terms-of-service' }
  ]);

  return (
    <div className="min-h-screen bg-gray-50">
      <SEO 
        title="Terms of Service - Access Your Place"
        description="Terms of Service for Access Your Place rental arbitrage platform. Read our policies on acquisition services, payment terms, refund policy, and user responsibilities."
        keywords="terms of service, rental arbitrage terms, AYP terms, user agreement, legal terms"
        canonicalUrl="/terms-of-service"
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
            <FileText className="w-10 h-10 text-[#d4a574]" />
            <div>
              <h1 className="text-3xl font-bold">Terms of Service</h1>
              <p className="text-gray-300">Set Up Your Place LLC d/b/a Access Your Place</p>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="bg-white rounded-xl shadow-lg p-8 md:p-12">
          {/* Effective Date & Entity Info */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 mb-8">
            <p className="text-sm text-blue-800">
              <strong>Effective Date:</strong> January 23, 2026
            </p>
            <p className="text-sm text-blue-800 mt-1">
              <strong>Entity:</strong> Set Up Your Place LLC d/b/a Access Your Place (a Cooper Family Inc. Company)
            </p>
            <p className="text-sm text-blue-800 mt-1">
              <strong>Corporate Address:</strong> 1150 NW 72nd Ave, Tower I, Suite 455, Miami, FL 33126
            </p>
            <p className="text-sm text-blue-800 mt-1">
              <strong>Email:</strong> success@accessyourplace.com
            </p>
          </div>

          {/* Section 1 */}
          <section className="mb-10">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-[#1a365d] rounded-full flex items-center justify-center text-white font-bold">1</div>
              <h2 className="text-2xl font-bold text-[#1a365d]">Scope of Service: The Acquisition Engine</h2>
            </div>
            <div className="prose prose-gray max-w-none pl-13">
              <p className="text-gray-700 mb-4">
                Access Your Place ("AYP," "we," or the "Company") operates strictly as an acquisition and launch engine for the rental arbitrage and corporate housing industry. Our services are designed to facilitate the sourcing, negotiation, and physical setup of furnished rental operations.
              </p>
              <ul className="space-y-3 text-gray-700">
                <li className="flex items-start">
                  <span className="w-2 h-2 bg-[#d4a574] rounded-full mt-2 mr-3 flex-shrink-0"></span>
                  <span><strong>No Portfolio Management:</strong> AYP does not provide ongoing property or portfolio management services for investors.</span>
                </li>
                <li className="flex items-start">
                  <span className="w-2 h-2 bg-[#d4a574] rounded-full mt-2 mr-3 flex-shrink-0"></span>
                  <span><strong>Acquisition & Launch Focus:</strong> Our Acquisition Team handles property sourcing and master lease negotiations, while our Setup Team manages administrative and physical property launches.</span>
                </li>
                <li className="flex items-start">
                  <span className="w-2 h-2 bg-[#d4a574] rounded-full mt-2 mr-3 flex-shrink-0"></span>
                  <span><strong>Management Independence:</strong> We aim to provide services that empower investors to build their own internal management engines rather than relying on AYP or third-party managers for long-term operations.</span>
                </li>
                <li className="flex items-start">
                  <span className="w-2 h-2 bg-[#d4a574] rounded-full mt-2 mr-3 flex-shrink-0"></span>
                  <span><strong>Third-Party Referrals:</strong> Upon request, AYP staff may connect investors with vetted vendors or co-hosting managers within the AYP network who have a proven track record.</span>
                </li>
                <li className="flex items-start">
                  <span className="w-2 h-2 bg-[#d4a574] rounded-full mt-2 mr-3 flex-shrink-0"></span>
                  <span><strong>Consultation Goal:</strong> Our preferred consulting model is to help investors build their own internal teams, develop custom Standard Operating Procedures (SOPs), and operate their portfolios under their own unique brand.</span>
                </li>
                <li className="flex items-start">
                  <span className="w-2 h-2 bg-[#d4a574] rounded-full mt-2 mr-3 flex-shrink-0"></span>
                  <span><strong>Direct Booking & Strategy:</strong> We encourage clients to move beyond reliance on single Online Travel Agencies (OTAs) and focus on direct booking and multi-platform lead generation to create businesses with intrinsic scalable value.</span>
                </li>
              </ul>
            </div>
          </section>

          {/* Section 2 */}
          <section className="mb-10">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-[#1a365d] rounded-full flex items-center justify-center text-white font-bold">2</div>
              <h2 className="text-2xl font-bold text-[#1a365d]">Communication Protocol & Landlord Outreach</h2>
            </div>
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-4">
              <div className="flex items-start">
                <AlertTriangle className="w-5 h-5 text-amber-600 mt-0.5 mr-2 flex-shrink-0" />
                <p className="text-amber-800 text-sm">
                  <strong>Important:</strong> Unauthorized contact with landlords can jeopardize deals for you and other investors.
                </p>
              </div>
            </div>
            <div className="prose prose-gray max-w-none pl-13">
              <p className="text-gray-700 mb-4">
                To protect the integrity of our proprietary landlord relationships and the success of pending transactions, AYP enforces a strict communication protocol:
              </p>
              <ul className="space-y-3 text-gray-700">
                <li className="flex items-start">
                  <span className="w-2 h-2 bg-[#d4a574] rounded-full mt-2 mr-3 flex-shrink-0"></span>
                  <span><strong>Unauthorized Outreach Prohibited:</strong> Reaching out to landlords or apartment communities before an Acquisition Manager has made a formal connection is a direct violation of these Terms of Service.</span>
                </li>
                <li className="flex items-start">
                  <span className="w-2 h-2 bg-[#d4a574] rounded-full mt-2 mr-3 flex-shrink-0"></span>
                  <span><strong>Deal Integrity:</strong> Unauthorized contact can jeopardize the deal for the individual investor and negatively impact other investors currently in progress with acquisitions at the same community.</span>
                </li>
                <li className="flex items-start">
                  <span className="w-2 h-2 bg-[#d4a574] rounded-full mt-2 mr-3 flex-shrink-0"></span>
                  <span><strong>Protocol Following Payment:</strong> Upon moving forward with a deal, investors receive these Terms of Service again for review and pay their activation fee. Following payment, the investor receives an Acquisition Agreement outlining the service, property address, and expected landlord fees.</span>
                </li>
                <li className="flex items-start">
                  <span className="w-2 h-2 bg-[#d4a574] rounded-full mt-2 mr-3 flex-shrink-0"></span>
                  <span><strong>Application & Direct Contact:</strong> Once the Acquisition Agreement is signed and the corporate application is submitted, the client is permitted to contact the landlord or community for screening updates on behalf of their company.</span>
                </li>
                <li className="flex items-start">
                  <span className="w-2 h-2 bg-[#d4a574] rounded-full mt-2 mr-3 flex-shrink-0"></span>
                  <span><strong>Success Team Mediation:</strong> The Success Team can facilitate formal introductions upon application submission and will monitor the process alongside the Acquisition Manager to provide the investor with status updates.</span>
                </li>
                <li className="flex items-start">
                  <span className="w-2 h-2 bg-[#d4a574] rounded-full mt-2 mr-3 flex-shrink-0"></span>
                  <span><strong>Information Requests:</strong> Landlords will typically request any additional information through the AYP Success Team; the Acquisition Manager will then work with the investor to compile and submit the necessary data.</span>
                </li>
              </ul>
            </div>
          </section>

          {/* Section 3 */}
          <section className="mb-10">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-[#1a365d] rounded-full flex items-center justify-center text-white font-bold">3</div>
              <h2 className="text-2xl font-bold text-[#1a365d]">Classification of Operations & Acquisition Fees</h2>
            </div>
            <div className="prose prose-gray max-w-none pl-13">
              <h3 className="text-lg font-semibold text-gray-800 mb-3">AYP Approved Deals</h3>
              <p className="text-gray-700 mb-4">Opportunities sourced and vetted by the AYP team:</p>
              <div className="bg-gray-50 rounded-lg p-4 mb-4">
                <ul className="space-y-2 text-gray-700">
                  <li className="flex justify-between items-center border-b border-gray-200 pb-2">
                    <span>Empty Property Acquisition</span>
                    <span className="font-semibold text-[#1a365d]">$2,500</span>
                  </li>
                  <li className="flex justify-between items-center border-b border-gray-200 pb-2">
                    <span>Furnished Operations</span>
                    <span className="font-semibold text-[#1a365d]">Starting at $3,000</span>
                  </li>
                  <li className="flex justify-between items-center">
                    <span>Leasehold/Turnkey Varieties</span>
                    <span className="font-semibold text-[#1a365d]">$3,000 - $12,000</span>
                  </li>
                </ul>
              </div>
              <h3 className="text-lg font-semibold text-gray-800 mb-3">Third-Party Seller Deals</h3>
              <p className="text-gray-700">
                Independent listings where fees are set by the seller (capped by AYP at $15,000). AYP Credits cannot be applied to these deals.
              </p>
            </div>
          </section>

          {/* Section 4 */}
          <section className="mb-10">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-[#1a365d] rounded-full flex items-center justify-center text-white font-bold">4</div>
              <h2 className="text-2xl font-bold text-[#1a365d]">VIP Corporate Sublease Program</h2>
            </div>
            <div className="prose prose-gray max-w-none pl-13">
              <p className="text-gray-700 mb-4">
                For clients who do not qualify for a lease independently, AYP offers a Master Lease structure:
              </p>
              <ul className="space-y-3 text-gray-700">
                <li className="flex items-start">
                  <span className="w-2 h-2 bg-[#d4a574] rounded-full mt-2 mr-3 flex-shrink-0"></span>
                  <span><strong>Master Lease:</strong> AYP acquires the lease with landlord permission and subleases it to the client.</span>
                </li>
                <li className="flex items-start">
                  <span className="w-2 h-2 bg-[#d4a574] rounded-full mt-2 mr-3 flex-shrink-0"></span>
                  <span><strong>Client Responsibilities:</strong> Clients pay rent and community fees directly to the property and manage maintenance requests with community staff.</span>
                </li>
                <li className="flex items-start">
                  <span className="w-2 h-2 bg-[#d4a574] rounded-full mt-2 mr-3 flex-shrink-0"></span>
                  <span><strong>Right of Reversion:</strong> AYP reserves the right to reclaim the operation if a client default triggers eviction proceedings, protecting AYP's liability and credit standing with the landlord.</span>
                </li>
              </ul>
            </div>
          </section>

          {/* Section 5 */}
          <section className="mb-10">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-[#1a365d] rounded-full flex items-center justify-center text-white font-bold">5</div>
              <h2 className="text-2xl font-bold text-[#1a365d]">First Right of Refusal</h2>
            </div>
            <div className="prose prose-gray max-w-none pl-13">
              <p className="text-gray-700 mb-4">
                When an investor submits an acquisition request and it is approved by our team:
              </p>
              <ul className="space-y-3 text-gray-700">
                <li className="flex items-start">
                  <span className="w-2 h-2 bg-[#d4a574] rounded-full mt-2 mr-3 flex-shrink-0"></span>
                  <span><strong>24-Hour Window:</strong> The requesting investor receives a 24-hour first right of refusal to secure the deal.</span>
                </li>
                <li className="flex items-start">
                  <span className="w-2 h-2 bg-[#d4a574] rounded-full mt-2 mr-3 flex-shrink-0"></span>
                  <span><strong>Expiration:</strong> If the investor does not proceed within 24 hours, the deal becomes available to all qualified investors on the platform.</span>
                </li>
                <li className="flex items-start">
                  <span className="w-2 h-2 bg-[#d4a574] rounded-full mt-2 mr-3 flex-shrink-0"></span>
                  <span><strong>Notification:</strong> Investors will receive email and SMS notifications when their first right of refusal is activated and when it is about to expire.</span>
                </li>
              </ul>
            </div>
          </section>

          {/* Section 6 */}
          <section className="mb-10">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-[#1a365d] rounded-full flex items-center justify-center text-white font-bold">6</div>
              <h2 className="text-2xl font-bold text-[#1a365d]">Payment Terms & Refund Policy</h2>
            </div>
            <div className="prose prose-gray max-w-none pl-13">
              <ul className="space-y-3 text-gray-700">
                <li className="flex items-start">
                  <span className="w-2 h-2 bg-[#d4a574] rounded-full mt-2 mr-3 flex-shrink-0"></span>
                  <span><strong>Activation Fee:</strong> All acquisition fees are due upon acceptance of a deal and before the Acquisition Agreement is issued.</span>
                </li>
                <li className="flex items-start">
                  <span className="w-2 h-2 bg-[#d4a574] rounded-full mt-2 mr-3 flex-shrink-0"></span>
                  <span><strong>Non-Refundable:</strong> Acquisition fees are non-refundable once the Acquisition Agreement has been signed and the property address has been revealed.</span>
                </li>
                <li className="flex items-start">
                  <span className="w-2 h-2 bg-[#d4a574] rounded-full mt-2 mr-3 flex-shrink-0"></span>
                  <span><strong>Deal Replacement:</strong> If a deal falls through due to landlord rejection or circumstances outside the investor's control, AYP will work to find a replacement property at no additional acquisition fee.</span>
                </li>
                <li className="flex items-start">
                  <span className="w-2 h-2 bg-[#d4a574] rounded-full mt-2 mr-3 flex-shrink-0"></span>
                  <span><strong>AYP Credits:</strong> Credits earned through referrals or promotions can be applied to AYP Approved Deals only and have no cash value.</span>
                </li>
              </ul>
            </div>
          </section>

          {/* Section 7 */}
          <section className="mb-10">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-[#1a365d] rounded-full flex items-center justify-center text-white font-bold">7</div>
              <h2 className="text-2xl font-bold text-[#1a365d]">Limitation of Liability</h2>
            </div>
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
              <div className="flex items-start">
                <Scale className="w-5 h-5 text-red-600 mt-0.5 mr-2 flex-shrink-0" />
                <p className="text-red-800 text-sm">
                  <strong>Please read this section carefully.</strong> It affects your legal rights.
                </p>
              </div>
            </div>
            <div className="prose prose-gray max-w-none pl-13">
              <ul className="space-y-3 text-gray-700">
                <li className="flex items-start">
                  <span className="w-2 h-2 bg-[#d4a574] rounded-full mt-2 mr-3 flex-shrink-0"></span>
                  <span><strong>No Guarantee of Results:</strong> AYP does not guarantee any specific financial outcomes, occupancy rates, or revenue projections. All projections provided are estimates based on market data and are not guarantees.</span>
                </li>
                <li className="flex items-start">
                  <span className="w-2 h-2 bg-[#d4a574] rounded-full mt-2 mr-3 flex-shrink-0"></span>
                  <span><strong>Investment Risk:</strong> Rental arbitrage and corporate housing investments carry inherent risks. Investors are solely responsible for their investment decisions and outcomes.</span>
                </li>
                <li className="flex items-start">
                  <span className="w-2 h-2 bg-[#d4a574] rounded-full mt-2 mr-3 flex-shrink-0"></span>
                  <span><strong>Maximum Liability:</strong> AYP's total liability for any claims arising from our services shall not exceed the total fees paid by the investor for the specific deal in question.</span>
                </li>
                <li className="flex items-start">
                  <span className="w-2 h-2 bg-[#d4a574] rounded-full mt-2 mr-3 flex-shrink-0"></span>
                  <span><strong>Indemnification:</strong> Investors agree to indemnify and hold harmless AYP, its officers, employees, and affiliates from any claims, damages, or expenses arising from the investor's operation of acquired properties.</span>
                </li>
              </ul>
            </div>
          </section>

          {/* Section 8 */}
          <section className="mb-10">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-[#1a365d] rounded-full flex items-center justify-center text-white font-bold">8</div>
              <h2 className="text-2xl font-bold text-[#1a365d]">Intellectual Property & Confidentiality</h2>
            </div>
            <div className="prose prose-gray max-w-none pl-13">
              <ul className="space-y-3 text-gray-700">
                <li className="flex items-start">
                  <span className="w-2 h-2 bg-[#d4a574] rounded-full mt-2 mr-3 flex-shrink-0"></span>
                  <span><strong>Proprietary Information:</strong> All deal information, landlord contacts, market research, and operational strategies provided by AYP are proprietary and confidential.</span>
                </li>
                <li className="flex items-start">
                  <span className="w-2 h-2 bg-[#d4a574] rounded-full mt-2 mr-3 flex-shrink-0"></span>
                  <span><strong>Non-Disclosure:</strong> Investors agree not to share deal information, landlord contacts, or AYP methodologies with third parties without written consent.</span>
                </li>
                <li className="flex items-start">
                  <span className="w-2 h-2 bg-[#d4a574] rounded-full mt-2 mr-3 flex-shrink-0"></span>
                  <span><strong>Platform Content:</strong> All content on the AYP platform, including text, graphics, logos, and software, is the property of AYP and protected by intellectual property laws.</span>
                </li>
              </ul>
            </div>
          </section>

          {/* Section 9 */}
          <section className="mb-10">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-[#1a365d] rounded-full flex items-center justify-center text-white font-bold">9</div>
              <h2 className="text-2xl font-bold text-[#1a365d]">Dispute Resolution</h2>
            </div>
            <div className="prose prose-gray max-w-none pl-13">
              <ul className="space-y-3 text-gray-700">
                <li className="flex items-start">
                  <span className="w-2 h-2 bg-[#d4a574] rounded-full mt-2 mr-3 flex-shrink-0"></span>
                  <span><strong>Mediation First:</strong> Any disputes arising from these Terms or our services shall first be submitted to mediation in Miami-Dade County, Florida.</span>
                </li>
                <li className="flex items-start">
                  <span className="w-2 h-2 bg-[#d4a574] rounded-full mt-2 mr-3 flex-shrink-0"></span>
                  <span><strong>Arbitration:</strong> If mediation fails, disputes shall be resolved through binding arbitration in accordance with the rules of the American Arbitration Association.</span>
                </li>
                <li className="flex items-start">
                  <span className="w-2 h-2 bg-[#d4a574] rounded-full mt-2 mr-3 flex-shrink-0"></span>
                  <span><strong>Governing Law:</strong> These Terms shall be governed by the laws of the State of Florida without regard to conflict of law principles.</span>
                </li>
              </ul>
            </div>
          </section>

          {/* Section 10 */}
          <section className="mb-10">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-[#1a365d] rounded-full flex items-center justify-center text-white font-bold">10</div>
              <h2 className="text-2xl font-bold text-[#1a365d]">Modifications to Terms</h2>
            </div>
            <div className="prose prose-gray max-w-none pl-13">
              <p className="text-gray-700">
                AYP reserves the right to modify these Terms of Service at any time. Material changes will be communicated to registered investors via email at least 30 days before taking effect. Continued use of our services after such modifications constitutes acceptance of the updated Terms.
              </p>
            </div>
          </section>

          {/* Contact Information */}
          <section className="bg-[#1a365d] text-white rounded-xl p-8 mt-12">
            <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
              <Shield className="w-6 h-6 text-[#d4a574]" />
              Contact Information
            </h2>
            <p className="text-gray-300 mb-6">
              For questions about these Terms of Service, please contact us:
            </p>
            <div className="grid md:grid-cols-3 gap-6">
              <div className="flex items-start gap-3">
                <Mail className="w-5 h-5 text-[#d4a574] mt-1" />
                <div>
                  <p className="font-semibold">Email</p>
                  <a href="mailto:success@accessyourplace.com" className="text-[#d4a574] hover:underline">
                    success@accessyourplace.com
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

          {/* Acceptance */}
          <div className="mt-8 p-6 bg-gray-100 rounded-lg text-center">
            <p className="text-gray-600 text-sm">
              By creating an account, making a purchase, or using our services, you acknowledge that you have read, understood, and agree to be bound by these Terms of Service.
            </p>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
