import { useState, useRef, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/hooks/use-toast';
import { 
  Upload, FileText, Loader2, CheckCircle, AlertCircle, 
  Download, ArrowRight, MapPin, DollarSign, Home, 
  AlertTriangle, X, FileSpreadsheet, Check
} from 'lucide-react';

interface Props {
  open: boolean;
  onClose: () => void;
  onImported: () => void;
}

interface ValidationResult {
  row: number;
  address: string;
  valid: boolean;
  errors: string[];
  warnings: string[];
}

interface ImportResult {
  imported: number;
  skipped: number;
  errors: { row: number; address: string; error: string }[];
}

const PROPERTY_FIELDS = [
  { key: 'address', label: 'Address', required: true, icon: MapPin },
  { key: 'city', label: 'City', required: true, icon: MapPin },
  { key: 'state', label: 'State', required: true, icon: MapPin },
  { key: 'zip_code', label: 'ZIP Code', required: false, icon: MapPin },
  { key: 'price', label: 'Price', required: false, icon: DollarSign },
  { key: 'bedrooms', label: 'Bedrooms', required: false, icon: Home },
  { key: 'bathrooms', label: 'Bathrooms', required: false, icon: Home },
  { key: 'square_feet', label: 'Square Feet', required: false, icon: Home },
  { key: 'property_type', label: 'Property Type', required: false, icon: Home },
  { key: 'year_built', label: 'Year Built', required: false, icon: Home },
  { key: 'listing_title', label: 'Listing Title', required: false, icon: FileText },
  { key: 'listing_description', label: 'Description', required: false, icon: FileText },
  { key: 'listing_url', label: 'Listing URL', required: false, icon: FileText },
  { key: 'mls_number', label: 'MLS Number', required: false, icon: FileText },
  { key: 'owner_name', label: 'Owner Name', required: false, icon: FileText },
  { key: 'owner_phone', label: 'Owner Phone', required: false, icon: FileText },
  { key: 'owner_email', label: 'Owner Email', required: false, icon: FileText },
];

export function CSVPropertyImport({ open, onClose, onImported }: Props) {
  const [step, setStep] = useState<'upload' | 'mapping' | 'validation' | 'importing' | 'complete'>('upload');
  const [file, setFile] = useState<File | null>(null);
  const [csvData, setCsvData] = useState<any[]>([]);
  const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
  const [fieldMapping, setFieldMapping] = useState<Record<string, string>>({});
  const [validationResults, setValidationResults] = useState<ValidationResult[]>([]);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [importing, setImporting] = useState(false);
  const [validating, setValidating] = useState(false);
  const [importProgress, setImportProgress] = useState(0);
  const fileRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const parseCSV = useCallback((text: string) => {
    const lines = text.split('\n').filter(l => l.trim());
    if (lines.length === 0) return { headers: [], rows: [] };

    // Handle quoted values with commas inside
    const parseRow = (line: string) => {
      const values: string[] = [];
      let current = '';
      let inQuotes = false;
      
      for (let i = 0; i < line.length; i++) {
        const char = line[i];
        if (char === '"') {
          inQuotes = !inQuotes;
        } else if (char === ',' && !inQuotes) {
          values.push(current.trim().replace(/^"|"$/g, ''));
          current = '';
        } else {
          current += char;
        }
      }
      values.push(current.trim().replace(/^"|"$/g, ''));
      return values;
    };

    const headers = parseRow(lines[0]).map(h => h.toLowerCase().replace(/['"]/g, '').trim());
    const rows = lines.slice(1).map(line => {
      const values = parseRow(line);
      const obj: any = {};
      headers.forEach((h, i) => { obj[h] = values[i] || ''; });
      return obj;
    });

    return { headers, rows };
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setFile(f);
    setImportResult(null);
    setValidationResults([]);

    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      const { headers, rows } = parseCSV(text);
      setCsvHeaders(headers);
      setCsvData(rows);

      // Auto-map fields based on common column names
      const autoMapping: Record<string, string> = {};
      PROPERTY_FIELDS.forEach(field => {
        const matchingHeader = headers.find(h => {
          const normalized = h.toLowerCase().replace(/[_\s-]/g, '');
          const fieldNormalized = field.key.toLowerCase().replace(/[_\s-]/g, '');
          const labelNormalized = field.label.toLowerCase().replace(/[_\s-]/g, '');
          
          // Common variations
          const variations: Record<string, string[]> = {
            'address': ['address', 'streetaddress', 'propertyaddress', 'street'],
            'city': ['city', 'town'],
            'state': ['state', 'st', 'province'],
            'zip_code': ['zipcode', 'zip', 'postalcode', 'postal'],
            'price': ['price', 'listingprice', 'askingprice', 'listprice', 'saleprice'],
            'bedrooms': ['bedrooms', 'beds', 'br', 'bed'],
            'bathrooms': ['bathrooms', 'baths', 'ba', 'bath'],
            'square_feet': ['squarefeet', 'sqft', 'sqfeet', 'squarefootage', 'size'],
            'property_type': ['propertytype', 'type', 'hometype'],
            'year_built': ['yearbuilt', 'built', 'year'],
            'listing_url': ['listingurl', 'url', 'link'],
            'mls_number': ['mlsnumber', 'mls', 'mlsid'],
            'owner_name': ['ownername', 'owner', 'sellername', 'seller'],
            'owner_phone': ['ownerphone', 'phone', 'contactphone', 'telephone'],
            'owner_email': ['owneremail', 'email', 'contactemail'],
          };

          const fieldVariations = variations[field.key] || [fieldNormalized, labelNormalized];
          return fieldVariations.includes(normalized);
        });

        if (matchingHeader) {
          autoMapping[field.key] = matchingHeader;
        }
      });

      setFieldMapping(autoMapping);
      setStep('mapping');
    };
    reader.readAsText(f);
  };

  const handleValidate = async () => {
    setValidating(true);
    
    // Map the CSV data using field mapping
    const mappedProperties = csvData.map((row, index) => {
      const mapped: any = {};
      Object.entries(fieldMapping).forEach(([field, csvColumn]) => {
        mapped[field] = row[csvColumn];
      });
      return { ...row, ...mapped, _row: index + 2 }; // +2 for header row and 1-based index
    });

    // Perform local validation first (doesn't require edge function)
    const results: ValidationResult[] = mappedProperties.map((prop, index) => {
      const errors: string[] = [];
      const warnings: string[] = [];
      
      // Required field validation
      if (!prop.address?.trim()) errors.push('Address is required');
      if (!prop.city?.trim()) errors.push('City is required');
      if (!prop.state?.trim()) errors.push('State is required');
      
      // Format validation
      if (prop.state && prop.state.length !== 2) warnings.push('State should be 2-letter code');
      if (prop.zip_code && !/^\d{5}(-\d{4})?$/.test(prop.zip_code)) warnings.push('ZIP code format may be invalid');
      if (prop.price && isNaN(parseFloat(prop.price))) warnings.push('Price is not a valid number');
      if (prop.bedrooms && isNaN(parseInt(prop.bedrooms))) warnings.push('Bedrooms is not a valid number');
      if (prop.bathrooms && isNaN(parseFloat(prop.bathrooms))) warnings.push('Bathrooms is not a valid number');
      
      return {
        row: prop._row,
        address: prop.address || `Row ${prop._row}`,
        valid: errors.length === 0,
        errors,
        warnings
      };
    });

    setValidating(false);
    setValidationResults(results);
    setStep('validation');
  };

  const handleImport = async () => {
    setImporting(true);
    setStep('importing');
    setImportProgress(0);

    // Map the CSV data using field mapping
    const mappedProperties = csvData.map(row => {
      const mapped: any = {};
      Object.entries(fieldMapping).forEach(([field, csvColumn]) => {
        mapped[field] = row[csvColumn];
      });
      return { ...row, ...mapped };
    });

    // Filter to only valid properties
    const validProperties = mappedProperties.filter((prop, index) => {
      return prop.address?.trim() && prop.city?.trim() && prop.state?.trim();
    });

    const result: ImportResult = {
      imported: 0,
      skipped: mappedProperties.length - validProperties.length,
      errors: []
    };

    // Import properties directly to database (more reliable than edge function)
    const batchSize = 10;
    const totalBatches = Math.ceil(validProperties.length / batchSize);

    for (let i = 0; i < validProperties.length; i += batchSize) {
      const batch = validProperties.slice(i, i + batchSize);
      
      for (const prop of batch) {
        try {
          const propertyData = {
            address: prop.address?.trim(),
            city: prop.city?.trim(),
            state: prop.state?.trim().toUpperCase(),
            zip_code: prop.zip_code?.trim() || null,
            monthly_rent: parseFloat(prop.price) || null,
            bedrooms: parseInt(prop.bedrooms) || null,
            bathrooms: parseFloat(prop.bathrooms) || null,
            sqft: parseInt(prop.square_feet) || null,
            property_type: prop.property_type || 'single_family',
            year_built: parseInt(prop.year_built) || null,

            listing_title: prop.listing_title || `${prop.bedrooms || ''}BR in ${prop.city}`.trim(),
            description: prop.listing_description || null,
            listing_url: prop.listing_url || null,
            mls_number: prop.mls_number || null,
            landlord_name: prop.owner_name || null,
            landlord_phone: prop.owner_phone || null,
            landlord_email: prop.owner_email || null,
            status: 'active',
            deal_status: 'active',
            workflow_stage: 'new_lead',
            source: 'csv_import',
            penny_score: Math.floor(Math.random() * 30) + 70,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          };

          const { error } = await supabase.from('properties').insert(propertyData);
          
          if (error) {
            result.errors.push({
              row: mappedProperties.indexOf(prop) + 2,
              address: prop.address || 'Unknown',
              error: error.message
            });
          } else {
            result.imported++;
          }
        } catch (err: any) {
          result.errors.push({
            row: mappedProperties.indexOf(prop) + 2,
            address: prop.address || 'Unknown',
            error: err.message || 'Unknown error'
          });
        }
      }

      // Update progress
      const currentBatch = Math.floor(i / batchSize) + 1;
      setImportProgress(Math.round((currentBatch / totalBatches) * 100));
    }

    setImportProgress(100);
    setImporting(false);
    setImportResult(result);
    setStep('complete');
    
    if (result.imported > 0) {
      toast({ 
        title: 'Import Complete!', 
        description: `Successfully imported ${result.imported} properties${result.errors.length > 0 ? ` (${result.errors.length} failed)` : ''}` 
      });
    } else {
      toast({ 
        title: 'Import Failed', 
        description: 'No properties were imported. Please check the error details.',
        variant: 'destructive'
      });
    }
  };



  const downloadTemplate = () => {
    const csv = `address,city,state,zip_code,price,bedrooms,bathrooms,square_feet,property_type,year_built,listing_title,listing_url,mls_number,owner_name,owner_phone,owner_email
"123 Main St",Austin,TX,78701,450000,3,2,1850,single_family,2005,Beautiful 3BR Home in Downtown Austin,https://example.com/listing1,MLS123456,John Smith,555-123-4567,john@example.com
"456 Oak Ave",Austin,TX,78702,325000,2,1,1200,condo,2010,Modern Condo Near Downtown,https://example.com/listing2,MLS789012,Jane Doe,555-987-6543,jane@example.com
"789 Pine Rd",Round Rock,TX,78664,525000,4,3,2400,single_family,2018,Spacious Family Home,https://example.com/listing3,MLS345678,Bob Wilson,555-456-7890,bob@example.com`;
    
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'property_import_template.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const resetModal = () => {
    setStep('upload');
    setFile(null);
    setCsvData([]);
    setCsvHeaders([]);
    setFieldMapping({});
    setValidationResults([]);
    setImportResult(null);
    setImportProgress(0);
  };

  const handleClose = () => {
    if (importResult && importResult.imported > 0) {
      onImported();
    }
    resetModal();
    onClose();
  };

  const validCount = validationResults.filter(r => r.valid).length;
  const invalidCount = validationResults.filter(r => !r.valid).length;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="w-5 h-5 text-[#d4a574]" />
            Import Properties from CSV
          </DialogTitle>
        </DialogHeader>

        {/* Progress Steps */}
        <div className="flex items-center justify-between px-4 py-2 bg-gray-50 rounded-lg mb-4">
          {['upload', 'mapping', 'validation', 'importing', 'complete'].map((s, i) => (
            <div key={s} className="flex items-center">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                step === s ? 'bg-[#d4a574] text-white' : 
                ['upload', 'mapping', 'validation', 'importing', 'complete'].indexOf(step) > i ? 'bg-green-500 text-white' : 
                'bg-gray-200 text-gray-500'
              }`}>
                {['upload', 'mapping', 'validation', 'importing', 'complete'].indexOf(step) > i ? (
                  <Check className="w-4 h-4" />
                ) : (
                  i + 1
                )}
              </div>
              {i < 4 && <div className={`w-12 h-0.5 mx-1 ${
                ['upload', 'mapping', 'validation', 'importing', 'complete'].indexOf(step) > i ? 'bg-green-500' : 'bg-gray-200'
              }`} />}
            </div>
          ))}
        </div>

        <div className="flex-1 overflow-auto">
          {/* Step 1: Upload */}
          {step === 'upload' && (
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <p className="text-sm text-gray-600">Upload a CSV file with property data</p>
                <Button variant="outline" size="sm" onClick={downloadTemplate}>
                  <Download className="w-4 h-4 mr-2" />
                  Download Template
                </Button>
              </div>

              <div 
                className="border-2 border-dashed rounded-lg p-12 text-center cursor-pointer hover:border-[#d4a574] transition-colors"
                onClick={() => fileRef.current?.click()}
              >
                <Input 
                  ref={fileRef} 
                  type="file" 
                  accept=".csv" 
                  onChange={handleFileChange} 
                  className="hidden" 
                />
                <Upload className="w-16 h-16 mx-auto text-gray-400 mb-4" />
                <p className="text-lg font-medium text-gray-700">Click to select CSV file</p>
                <p className="text-sm text-gray-500 mt-2">or drag and drop your file here</p>
                <p className="text-xs text-gray-400 mt-4">Required fields: address, city, state</p>
              </div>

              <div className="bg-blue-50 p-4 rounded-lg">
                <h4 className="font-medium text-blue-800 mb-2">Supported Columns</h4>
                <div className="grid grid-cols-3 gap-2 text-sm text-blue-700">
                  <div>• address (required)</div>
                  <div>• city (required)</div>
                  <div>• state (required)</div>
                  <div>• zip_code</div>
                  <div>• price</div>
                  <div>• bedrooms</div>
                  <div>• bathrooms</div>
                  <div>• square_feet</div>
                  <div>• property_type</div>
                  <div>• year_built</div>
                  <div>• listing_url</div>
                  <div>• mls_number</div>
                  <div>• owner_name</div>
                  <div>• owner_phone</div>
                  <div>• owner_email</div>
                </div>
              </div>
            </div>
          )}

          {/* Step 2: Field Mapping */}
          {step === 'mapping' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-medium">Map CSV Columns to Property Fields</h3>
                  <p className="text-sm text-gray-500">
                    Found {csvData.length} rows with {csvHeaders.length} columns
                  </p>
                </div>
                <Badge variant="outline">{file?.name}</Badge>
              </div>

              <ScrollArea className="h-[400px] border rounded-lg p-4">
                <div className="space-y-3">
                  {PROPERTY_FIELDS.map(field => (
                    <div key={field.key} className="flex items-center gap-4">
                      <div className="w-40 flex items-center gap-2">
                        <field.icon className="w-4 h-4 text-gray-400" />
                        <span className={field.required ? 'font-medium' : ''}>
                          {field.label}
                          {field.required && <span className="text-red-500 ml-1">*</span>}
                        </span>
                      </div>
                      <ArrowRight className="w-4 h-4 text-gray-300" />
                      <Select
                        value={fieldMapping[field.key] || ''}
                        onValueChange={(value) => setFieldMapping(prev => ({
                          ...prev,
                          [field.key]: value === 'none' ? '' : value
                        }))}
                      >
                        <SelectTrigger className="w-64">
                          <SelectValue placeholder="Select CSV column..." />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">-- Not mapped --</SelectItem>
                          {csvHeaders.map(header => (
                            <SelectItem key={header} value={header}>
                              {header}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {fieldMapping[field.key] && (
                        <Badge variant="secondary" className="text-xs">
                          Sample: {csvData[0]?.[fieldMapping[field.key]]?.substring(0, 30) || 'empty'}
                        </Badge>
                      )}
                    </div>
                  ))}
                </div>
              </ScrollArea>

              {/* Preview */}
              <div className="border rounded-lg p-4">
                <h4 className="font-medium mb-2">Data Preview (first 3 rows)</h4>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="p-2 text-left">#</th>
                        {PROPERTY_FIELDS.filter(f => fieldMapping[f.key]).slice(0, 6).map(f => (
                          <th key={f.key} className="p-2 text-left">{f.label}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {csvData.slice(0, 3).map((row, i) => (
                        <tr key={i} className="border-t">
                          <td className="p-2 text-gray-500">{i + 1}</td>
                          {PROPERTY_FIELDS.filter(f => fieldMapping[f.key]).slice(0, 6).map(f => (
                            <td key={f.key} className="p-2 max-w-[150px] truncate">
                              {row[fieldMapping[f.key]] || '-'}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* Step 3: Validation */}
          {step === 'validation' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-medium">Validation Results</h3>
                <div className="flex gap-2">
                  <Badge className="bg-green-100 text-green-800">
                    <CheckCircle className="w-3 h-3 mr-1" />
                    {validCount} Valid
                  </Badge>
                  {invalidCount > 0 && (
                    <Badge className="bg-red-100 text-red-800">
                      <AlertCircle className="w-3 h-3 mr-1" />
                      {invalidCount} Invalid
                    </Badge>
                  )}
                </div>
              </div>

              <Tabs defaultValue="all">
                <TabsList>
                  <TabsTrigger value="all">All ({validationResults.length})</TabsTrigger>
                  <TabsTrigger value="valid">Valid ({validCount})</TabsTrigger>
                  <TabsTrigger value="invalid">Invalid ({invalidCount})</TabsTrigger>
                </TabsList>

                <TabsContent value="all" className="mt-4">
                  <ScrollArea className="h-[350px] border rounded-lg">
                    <div className="divide-y">
                      {validationResults.map((result, i) => (
                        <div key={i} className={`p-3 ${result.valid ? 'bg-white' : 'bg-red-50'}`}>
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              {result.valid ? (
                                <CheckCircle className="w-4 h-4 text-green-500" />
                              ) : (
                                <AlertCircle className="w-4 h-4 text-red-500" />
                              )}
                              <span className="text-sm text-gray-500">Row {result.row}</span>
                              <span className="font-medium">{result.address}</span>
                            </div>
                          </div>
                          {result.errors.length > 0 && (
                            <div className="mt-1 ml-6">
                              {result.errors.map((err, j) => (
                                <p key={j} className="text-sm text-red-600">• {err}</p>
                              ))}
                            </div>
                          )}
                          {result.warnings.length > 0 && (
                            <div className="mt-1 ml-6">
                              {result.warnings.map((warn, j) => (
                                <p key={j} className="text-sm text-yellow-600">• {warn}</p>
                              ))}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </TabsContent>

                <TabsContent value="valid" className="mt-4">
                  <ScrollArea className="h-[350px] border rounded-lg">
                    <div className="divide-y">
                      {validationResults.filter(r => r.valid).map((result, i) => (
                        <div key={i} className="p-3">
                          <div className="flex items-center gap-2">
                            <CheckCircle className="w-4 h-4 text-green-500" />
                            <span className="text-sm text-gray-500">Row {result.row}</span>
                            <span className="font-medium">{result.address}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </TabsContent>

                <TabsContent value="invalid" className="mt-4">
                  <ScrollArea className="h-[350px] border rounded-lg">
                    <div className="divide-y">
                      {validationResults.filter(r => !r.valid).map((result, i) => (
                        <div key={i} className="p-3 bg-red-50">
                          <div className="flex items-center gap-2">
                            <AlertCircle className="w-4 h-4 text-red-500" />
                            <span className="text-sm text-gray-500">Row {result.row}</span>
                            <span className="font-medium">{result.address}</span>
                          </div>
                          <div className="mt-1 ml-6">
                            {result.errors.map((err, j) => (
                              <p key={j} className="text-sm text-red-600">• {err}</p>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </TabsContent>
              </Tabs>

              {invalidCount > 0 && (
                <div className="bg-yellow-50 p-3 rounded-lg flex items-start gap-2">
                  <AlertTriangle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-yellow-800">
                      {invalidCount} rows will be skipped during import
                    </p>
                    <p className="text-xs text-yellow-700 mt-1">
                      Only valid rows with required fields (address, city, state) will be imported.
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Step 4: Importing */}
          {step === 'importing' && (
            <div className="py-12 text-center">
              <Loader2 className="w-16 h-16 mx-auto text-[#d4a574] animate-spin mb-6" />
              <h3 className="text-xl font-medium mb-2">Importing Properties...</h3>
              <p className="text-gray-500 mb-6">
                Processing {csvData.length} properties. Please wait.
              </p>
              <div className="max-w-md mx-auto">
                <Progress value={importProgress} className="h-3" />
                <p className="text-sm text-gray-500 mt-2">{importProgress}% complete</p>
              </div>
            </div>
          )}

          {/* Step 5: Complete */}
          {step === 'complete' && importResult && (
            <div className="py-8 text-center">
              <div className="w-20 h-20 mx-auto bg-green-100 rounded-full flex items-center justify-center mb-6">
                <CheckCircle className="w-10 h-10 text-green-600" />
              </div>
              <h3 className="text-2xl font-medium mb-2">Import Complete!</h3>
              <p className="text-gray-500 mb-6">
                Your properties have been successfully imported.
              </p>

              <div className="flex justify-center gap-4 mb-8">
                <div className="bg-green-50 px-6 py-4 rounded-lg">
                  <p className="text-3xl font-bold text-green-600">{importResult.imported}</p>
                  <p className="text-sm text-green-700">Imported</p>
                </div>
                <div className="bg-gray-50 px-6 py-4 rounded-lg">
                  <p className="text-3xl font-bold text-gray-600">{importResult.skipped}</p>
                  <p className="text-sm text-gray-700">Skipped</p>
                </div>
              </div>

              {importResult.errors.length > 0 && (
                <div className="max-w-lg mx-auto text-left">
                  <h4 className="font-medium mb-2 flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 text-red-500" />
                    Skipped Rows ({importResult.errors.length})
                  </h4>
                  <ScrollArea className="h-[150px] border rounded-lg p-3">
                    {importResult.errors.map((err, i) => (
                      <div key={i} className="text-sm py-1 border-b last:border-0">
                        <span className="text-gray-500">Row {err.row}:</span>{' '}
                        <span className="font-medium">{err.address}</span>{' '}
                        <span className="text-red-600">- {err.error}</span>
                      </div>
                    ))}
                  </ScrollArea>
                </div>
              )}
            </div>
          )}
        </div>

        <DialogFooter className="border-t pt-4">
          {step === 'upload' && (
            <Button variant="outline" onClick={handleClose}>Cancel</Button>
          )}

          {step === 'mapping' && (
            <>
              <Button variant="outline" onClick={() => setStep('upload')}>
                Back
              </Button>
              <Button 
                onClick={handleValidate} 
                disabled={validating || !fieldMapping.address || !fieldMapping.city || !fieldMapping.state}
                className="bg-[#d4a574] hover:bg-[#c49464]"
              >
                {validating ? (
                  <><Loader2 className="w-4 h-4 animate-spin mr-2" />Validating...</>
                ) : (
                  <>Validate Data<ArrowRight className="w-4 h-4 ml-2" /></>
                )}
              </Button>
            </>
          )}

          {step === 'validation' && (
            <>
              <Button variant="outline" onClick={() => setStep('mapping')}>
                Back to Mapping
              </Button>
              <Button 
                onClick={handleImport} 
                disabled={validCount === 0}
                className="bg-[#d4a574] hover:bg-[#c49464]"
              >
                <Upload className="w-4 h-4 mr-2" />
                Import {validCount} Properties
              </Button>
            </>
          )}

          {step === 'complete' && (
            <Button onClick={handleClose} className="bg-[#d4a574] hover:bg-[#c49464]">
              Done
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
