import { useState, useEffect } from 'react';
import { FileText, Download, X, Loader2 } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface Resource {
  id: string;
  title: string;
  description: string;
  file_url: string;
  file_name: string;
  category: string;
}

export default function FreeResources() {
  const [resources, setResources] = useState<Resource[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [selectedResource, setSelectedResource] = useState<Resource | null>(null);
  const [formData, setFormData] = useState({ name: '', email: '', phone: '' });
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    fetchResources();
  }, []);

  const fetchResources = async () => {
    setLoading(true);
    try {
      const { data } = await supabase.functions.invoke('get-digital-products');
      if (data?.products) {
        setResources(data.products);
      }
    } catch (error) {
      console.error('Error fetching resources:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = (resource: Resource) => {
    setSelectedResource(resource);
    setShowModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedResource) return;
    setIsSubmitting(true);

    try {
      const { error } = await supabase.functions.invoke('track-download', {
        body: {
          resourceName: selectedResource.title,
          resourceId: selectedResource.id,
          name: formData.name,
          email: formData.email,
          phone: formData.phone
        }
      });

      if (error) throw error;

      // Open the file URL in a new tab for download
      window.open(selectedResource.file_url, '_blank');
      
      alert(`Thank you! Your download of "${selectedResource.title}" will begin shortly.`);
      setShowModal(false);
      setFormData({ name: '', email: '', phone: '' });
    } catch (error) {
      console.error('Error tracking download:', error);
      alert('Error processing download. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <section id="resources" className="py-16 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <h2 className="text-4xl font-bold text-[#1a2332] mb-4">Free Resources</h2>
          <p className="text-xl text-gray-600">Download our proven templates and guides</p>
        </div>

        {loading ? (
          <div className="flex justify-center items-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-[#d4a574]" />
          </div>
        ) : resources.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-600">No resources available yet. Check back soon!</p>
          </div>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {resources.map((resource) => (
              <div key={resource.id} className="bg-gray-50 p-6 rounded-lg text-center hover:shadow-lg transition-shadow">
                <FileText size={48} className="mx-auto mb-4 text-[#d4a574]" />
                <h3 className="text-lg font-bold text-[#1a2332] mb-2">{resource.title}</h3>
                <p className="text-sm text-gray-600 mb-4">{resource.description}</p>
                <button onClick={() => handleDownload(resource)} className="bg-[#1a2332] text-white px-6 py-2 rounded-lg hover:bg-[#2a3d52] transition-colors flex items-center justify-center mx-auto">
                  <Download size={16} className="mr-2" />
                  Download
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {showModal && selectedResource && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-8 max-w-md w-full relative">
            <button onClick={() => setShowModal(false)} className="absolute top-4 right-4 text-gray-500 hover:text-gray-700">
              <X size={24} />
            </button>
            <h3 className="text-2xl font-bold text-[#1a2332] mb-4">Download {selectedResource.title}</h3>
            <p className="text-gray-600 mb-6">Enter your information to receive this free resource</p>
            <form onSubmit={handleSubmit}>
              <input 
                type="text" 
                placeholder="Full Name *" 
                required 
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-4 py-3 mb-4" 
              />
              <input 
                type="email" 
                placeholder="Email Address *" 
                required 
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-4 py-3 mb-4" 
              />
              <input 
                type="tel" 
                placeholder="Phone Number *" 
                required 
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-4 py-3 mb-4" 
              />
              <button 
                type="submit" 
                disabled={isSubmitting}
                className="w-full bg-[#d4a574] text-white py-3 rounded-lg font-semibold hover:bg-[#c49564] transition-colors disabled:opacity-50"
              >
                {isSubmitting ? 'Processing...' : 'Get Free Resource'}
              </button>
            </form>
          </div>
        </div>
      )}
    </section>
  );
}
