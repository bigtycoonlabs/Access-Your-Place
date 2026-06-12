import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { supabase } from '../lib/supabase';

export default function SubmitPropertyModal() {
  const [formData, setFormData] = useState({
    ownerName: '', email: '', phone: '', propertyAddress: '', city: '', state: '', zip: '', bedrooms: '', bathrooms: '', rent: '', utilities: '', notes: ''
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    
    try {
      const { data, error } = await supabase.functions.invoke('submit-lead', {
        body: {
          formType: 'Submit Property (Modal)',
          name: formData.ownerName,
          email: formData.email,
          phone: formData.phone,
          data: {
            propertyAddress: formData.propertyAddress,
            city: formData.city,
            state: formData.state,
            zip: formData.zip,
            bedrooms: formData.bedrooms,
            bathrooms: formData.bathrooms,
            rent: formData.rent,
            utilities: formData.utilities,
            notes: formData.notes
          }
        }
      });

      if (error) throw error;

      setSubmitted(true);
      setTimeout(() => {
        setSubmitted(false);
        setFormData({
          ownerName: '', email: '', phone: '', propertyAddress: '', city: '', state: '', zip: '', bedrooms: '', bathrooms: '', rent: '', utilities: '', notes: ''
        });
      }, 5000);
    } catch (error) {
      console.error('Error submitting property:', error);
      alert('Error submitting property. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog>
      <DialogTrigger asChild>
        <button id="submit-property-modal" className="hidden">Open</button>
      </DialogTrigger>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl">Submit Your Property</DialogTitle>
          <p className="text-sm text-gray-600">Join our network of landlords and property owners</p>
        </DialogHeader>
        {!submitted ? (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid md:grid-cols-3 gap-4">
              <div>
                <Label>Owner Name *</Label>
                <Input required value={formData.ownerName} onChange={(e) => setFormData({...formData, ownerName: e.target.value})} />
              </div>
              <div>
                <Label>Email *</Label>
                <Input type="email" required value={formData.email} onChange={(e) => setFormData({...formData, email: e.target.value})} />
              </div>
              <div>
                <Label>Phone *</Label>
                <Input required value={formData.phone} onChange={(e) => setFormData({...formData, phone: e.target.value})} />
              </div>
            </div>
            <div>
              <Label>Property Address *</Label>
              <Input required value={formData.propertyAddress} onChange={(e) => setFormData({...formData, propertyAddress: e.target.value})} />
            </div>
            <div className="grid md:grid-cols-3 gap-4">
              <div>
                <Label>City *</Label>
                <Input required value={formData.city} onChange={(e) => setFormData({...formData, city: e.target.value})} />
              </div>
              <div>
                <Label>State *</Label>
                <Input required value={formData.state} onChange={(e) => setFormData({...formData, state: e.target.value})} />
              </div>
              <div>
                <Label>ZIP Code *</Label>
                <Input required value={formData.zip} onChange={(e) => setFormData({...formData, zip: e.target.value})} />
              </div>
            </div>
            <div className="grid md:grid-cols-4 gap-4">
              <div>
                <Label>Bedrooms *</Label>
                <Input type="number" required value={formData.bedrooms} onChange={(e) => setFormData({...formData, bedrooms: e.target.value})} />
              </div>
              <div>
                <Label>Bathrooms *</Label>
                <Input type="number" step="0.5" required value={formData.bathrooms} onChange={(e) => setFormData({...formData, bathrooms: e.target.value})} />
              </div>
              <div>
                <Label>Monthly Rent *</Label>
                <Input type="number" required value={formData.rent} onChange={(e) => setFormData({...formData, rent: e.target.value})} placeholder="$" />
              </div>
              <div>
                <Label>Utilities Included?</Label>
                <Input value={formData.utilities} onChange={(e) => setFormData({...formData, utilities: e.target.value})} placeholder="Yes/No/Partial" />
              </div>
            </div>
            <div>
              <Label>Additional Notes</Label>
              <Textarea value={formData.notes} onChange={(e) => setFormData({...formData, notes: e.target.value})} rows={3} />
            </div>
            <Button type="submit" className="w-full" disabled={isSubmitting}>
              {isSubmitting ? 'Submitting...' : 'Submit Property'}
            </Button>
          </form>
        ) : (
          <div className="text-center py-8">
            <h3 className="text-xl font-semibold mb-2">Property Submitted!</h3>
            <p>Our team will review and contact you at {formData.email} within 48 hours.</p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
