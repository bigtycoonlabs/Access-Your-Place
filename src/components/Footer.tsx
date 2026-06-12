import { Mail, MapPin, Facebook, Twitter, Linkedin, Instagram } from 'lucide-react';

export default function Footer() {
  return (
    <footer className="bg-[#0a0f1a] text-white pt-16 pb-8" role="contentinfo" aria-label="Site footer">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid md:grid-cols-4 gap-8 mb-12">
          <div>
            <h3 className="text-2xl font-bold text-[#d4a574] mb-4">Access Your Place</h3>
            <p className="text-gray-400 mb-2">
              The compliance-driven acquisition engine for rental arbitrage.
            </p>
            <p className="text-gray-500 text-sm mb-4">
              Powered by Set Up Your Place LLC
            </p>
            <div className="flex space-x-4" role="list" aria-label="Social media links">
              <a 
                href="#" 
                className="hover:text-[#d4a574] transition-colors focus:outline-none focus:ring-2 focus:ring-[#d4a574] rounded p-1"
                aria-label="Facebook"
                role="listitem"
              >
                <Facebook size={20} aria-hidden="true" />
              </a>
              <a 
                href="#" 
                className="hover:text-[#d4a574] transition-colors focus:outline-none focus:ring-2 focus:ring-[#d4a574] rounded p-1"
                aria-label="Twitter"
                role="listitem"
              >
                <Twitter size={20} aria-hidden="true" />
              </a>
              <a 
                href="#" 
                className="hover:text-[#d4a574] transition-colors focus:outline-none focus:ring-2 focus:ring-[#d4a574] rounded p-1"
                aria-label="LinkedIn"
                role="listitem"
              >
                <Linkedin size={20} aria-hidden="true" />
              </a>
              <a 
                href="#" 
                className="hover:text-[#d4a574] transition-colors focus:outline-none focus:ring-2 focus:ring-[#d4a574] rounded p-1"
                aria-label="Instagram"
                role="listitem"
              >
                <Instagram size={20} aria-hidden="true" />
              </a>
            </div>
          </div>

          <div>
            <h4 className="text-lg font-semibold mb-4" id="quick-links-heading">Quick Links</h4>
            <nav aria-labelledby="quick-links-heading">
              <ul className="space-y-2">
                <li>
                  <a 
                    href="/deals" 
                    className="text-gray-400 hover:text-[#d4a574] transition-colors focus:outline-none focus:ring-2 focus:ring-[#d4a574] rounded"
                  >
                    Deal Flow
                  </a>
                </li>
                <li>
                  <a 
                    href="/setup-services" 
                    className="text-gray-400 hover:text-[#d4a574] transition-colors focus:outline-none focus:ring-2 focus:ring-[#d4a574] rounded"
                  >
                    Setup Services
                  </a>
                </li>
                <li>
                  <a 
                    href="/knowledge-library" 
                    className="text-gray-400 hover:text-[#d4a574] transition-colors focus:outline-none focus:ring-2 focus:ring-[#d4a574] rounded"
                  >
                    Knowledge Library
                  </a>
                </li>
                <li>
                  <a 
                    href="/pricing" 
                    className="text-gray-400 hover:text-[#d4a574] transition-colors focus:outline-none focus:ring-2 focus:ring-[#d4a574] rounded"
                  >
                    Pricing
                  </a>
                </li>
                <li>
                  <a 
                    href="#resources" 
                    className="text-gray-400 hover:text-[#d4a574] transition-colors focus:outline-none focus:ring-2 focus:ring-[#d4a574] rounded"
                  >
                    Free Resources
                  </a>
                </li>
              </ul>
            </nav>
          </div>

          <div>
            <h4 className="text-lg font-semibold mb-4" id="partnerships-heading">Partnerships</h4>
            <nav aria-labelledby="partnerships-heading">
              <ul className="space-y-2">
                <li>
                  <a 
                    href="/landlord-partnership" 
                    className="text-gray-400 hover:text-[#d4a574] transition-colors focus:outline-none focus:ring-2 focus:ring-[#d4a574] rounded"
                  >
                    Landlord Partnership
                  </a>
                </li>
                <li>
                  <a 
                    href="/landlord-partnership#landlord-inquiry" 
                    className="text-gray-400 hover:text-[#d4a574] transition-colors focus:outline-none focus:ring-2 focus:ring-[#d4a574] rounded"
                  >
                    Community Inquiry
                  </a>
                </li>
                <li>
                  <a 
                    href="/investor/login" 
                    className="text-gray-400 hover:text-[#d4a574] transition-colors focus:outline-none focus:ring-2 focus:ring-[#d4a574] rounded"
                  >
                    Investor Portal
                  </a>
                </li>
                <li>
                  <a 
                    href="https://calendly.com/investyourplaces" 
                    target="_blank" 
                    rel="noopener noreferrer" 
                    className="text-gray-400 hover:text-[#d4a574] transition-colors focus:outline-none focus:ring-2 focus:ring-[#d4a574] rounded"
                    aria-label="Book Discovery Call (opens in new tab)"
                  >
                    Book Discovery Call
                  </a>
                </li>
                <li>
                  <a 
                    href="https://bigggtycoon.net" 
                    target="_blank" 
                    rel="noopener noreferrer" 
                    className="text-gray-400 hover:text-[#d4a574] transition-colors focus:outline-none focus:ring-2 focus:ring-[#d4a574] rounded flex items-center gap-1"
                    aria-label="TycoonLabs - Sister Company (opens in new tab)"
                  >
                    TycoonLabs
                    <span className="text-xs bg-purple-500/30 text-purple-300 px-1.5 py-0.5 rounded">Sister Co.</span>
                  </a>
                </li>
              </ul>
            </nav>
          </div>

          <div>
            <h4 className="text-lg font-semibold mb-4" id="contact-heading">Contact Us</h4>
            <address className="not-italic" aria-labelledby="contact-heading">
              <ul className="space-y-3">
                <li className="flex items-start">
                  <Mail size={18} className="mr-2 mt-1 text-[#d4a574] flex-shrink-0" aria-hidden="true" />
                  <a 
                    href="mailto:hello@accessyourplace.com" 
                    className="text-gray-400 hover:text-[#d4a574] transition-colors focus:outline-none focus:ring-2 focus:ring-[#d4a574] rounded"
                  >
                    hello@accessyourplace.com
                  </a>
                </li>
                <li className="flex items-start">
                  <MapPin size={18} className="mr-2 mt-1 text-[#d4a574] flex-shrink-0" aria-hidden="true" />
                  <span className="text-gray-400 text-sm">
                    1150 NW 72nd Ave., Tower I Suite 455, Miami, FL 33126
                  </span>
                </li>
              </ul>
            </address>
          </div>
        </div>

        {/* TOS Disclaimer */}
        <div className="bg-amber-900/20 border border-amber-600/30 rounded-lg p-4 mb-8">
          <p className="text-amber-200 text-sm text-center">
            <strong>Important:</strong> Unauthorized landlord outreach before formal Success Team introduction is a violation of our Terms of Service and grounds for immediate platform ban.
          </p>
        </div>

        <div className="border-t border-gray-800 pt-8 text-center text-gray-400">
          <p>
            &copy; {new Date().getFullYear()} Access Your Place. All rights reserved. |{' '}
            <a 
              href="/privacy-policy" 
              className="hover:text-[#d4a574] focus:outline-none focus:ring-2 focus:ring-[#d4a574] rounded"
            >
              Privacy Policy
            </a>{' '}
            |{' '}
            <a 
              href="/terms-of-service" 
              className="hover:text-[#d4a574] focus:outline-none focus:ring-2 focus:ring-[#d4a574] rounded"
            >
              Terms of Service
            </a>
          </p>
        </div>
      </div>
    </footer>
  );
}
