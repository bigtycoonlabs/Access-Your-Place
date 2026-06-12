import { useLocation, Link } from "react-router-dom";
import { useEffect } from "react";
import SEO from "@/components/SEO";
import { Home, Search, ArrowLeft, HelpCircle, BookOpen, Building2 } from "lucide-react";
import { Button } from "@/components/ui/button";

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    console.error(
      "404 Error: User attempted to access non-existent route:",
      location.pathname
    );
  }, [location.pathname]);

  const suggestedLinks = [
    { icon: Home, label: "Home", href: "/", description: "Return to the homepage" },
    { icon: Building2, label: "Property Deals", href: "/deals", description: "Browse available properties" },
    { icon: BookOpen, label: "Knowledge Library", href: "/knowledge-library", description: "Read our guides and articles" },
    { icon: HelpCircle, label: "Contact Support", href: "mailto:support@accessyourplace.com", description: "Get help from our team" },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#1a365d] via-[#2d5a87] to-[#1a365d] flex items-center justify-center p-4">
      <SEO 
        title="Page Not Found (404)"
        description="The page you're looking for doesn't exist or has been moved. Return to Access Your Place to find rental arbitrage opportunities."
        noIndex={true}
      />
      
      <div className="max-w-2xl w-full">
        <div className="text-center mb-8">
          {/* Animated 404 */}
          <div className="relative inline-block">
            <h1 className="text-[150px] md:text-[200px] font-bold text-white/10 leading-none select-none">
              404
            </h1>
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-center">
                <Search className="w-16 h-16 md:w-24 md:h-24 text-[#d4a574] mx-auto mb-4 animate-pulse" />
                <p className="text-white text-xl md:text-2xl font-semibold">Page Not Found</p>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-2xl p-8 md:p-12">
          <div className="text-center mb-8">
            <h2 className="text-2xl font-bold text-[#1a365d] mb-3">
              Oops! This page doesn't exist
            </h2>
            <p className="text-gray-600">
              The page <code className="bg-gray-100 px-2 py-1 rounded text-sm">{location.pathname}</code> couldn't be found.
              It may have been moved or deleted.
            </p>
          </div>

          {/* Quick Actions */}
          <div className="grid sm:grid-cols-2 gap-4 mb-8">
            {suggestedLinks.map((link) => {
              const Icon = link.icon;
              const isExternal = link.href.startsWith('mailto:');
              const LinkComponent = isExternal ? 'a' : Link;
              const linkProps = isExternal 
                ? { href: link.href } 
                : { to: link.href };
              
              return (
                <LinkComponent
                  key={link.label}
                  {...linkProps}
                  className="flex items-start gap-4 p-4 rounded-xl border border-gray-200 hover:border-[#d4a574] hover:bg-amber-50/50 transition-all group"
                >
                  <div className="p-2 bg-[#d4a574]/10 rounded-lg group-hover:bg-[#d4a574]/20 transition-colors">
                    <Icon className="w-5 h-5 text-[#d4a574]" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-[#1a365d] group-hover:text-[#d4a574] transition-colors">
                      {link.label}
                    </h3>
                    <p className="text-sm text-gray-500">{link.description}</p>
                  </div>
                </LinkComponent>
              );
            })}
          </div>

          {/* Primary CTA */}
          <div className="text-center">
            <Link to="/">
              <Button size="lg" className="bg-[#d4a574] hover:bg-[#c49464] text-white">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Homepage
              </Button>
            </Link>
          </div>

          {/* Search Suggestion */}
          <div className="mt-8 pt-8 border-t border-gray-200 text-center">
            <p className="text-sm text-gray-500">
              Looking for something specific? Try searching our{" "}
              <Link to="/knowledge-library" className="text-[#d4a574] hover:underline">
                Knowledge Library
              </Link>{" "}
              or{" "}
              <Link to="/deals" className="text-[#d4a574] hover:underline">
                Property Deals
              </Link>
              .
            </p>
          </div>
        </div>

        {/* Footer */}
        <p className="text-center text-white/60 text-sm mt-6">
          Need help?{" "}
          <a href="mailto:support@accessyourplace.com" className="text-[#d4a574] hover:underline">
            Contact our support team
          </a>
        </p>
      </div>
    </div>
  );
};

export default NotFound;
