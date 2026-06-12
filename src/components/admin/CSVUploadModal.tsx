import { useState, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/hooks/use-toast';
import { Upload, FileText, Loader2, CheckCircle, AlertCircle, Download } from 'lucide-react';

interface Props {
  open: boolean;
  onClose: () => void;
  onImported: () => void;
}

export function CSVUploadModal({ open, onClose, onImported }: Props) {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<any[]>([]);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<{ imported: number; skipped: number } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const parseCSV = (text: string) => {
    const lines = text.split('\n').filter(l => l.trim());
    const headers = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/['"]/g, ''));
    const rows = lines.slice(1).map(line => {
      const values = line.split(',').map(v => v.trim().replace(/['"]/g, ''));
      const obj: any = {};
      headers.forEach((h, i) => { obj[h] = values[i] || ''; });
      return obj;
    });
    return rows;
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setFile(f);
    setResult(null);

    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      const rows = parseCSV(text);
      setPreview(rows.slice(0, 5));
    };
    reader.readAsText(f);
  };

  const handleImport = async () => {
    if (!file) return;
    setImporting(true);

    const reader = new FileReader();
    reader.onload = async (ev) => {
      const text = ev.target?.result as string;
      const rows = parseCSV(text);

      const investors = rows.map(row => ({
        email: row.email || row.e_mail || row['email address'],
        full_name: row.full_name || row.name || `${row.first_name || ''} ${row.last_name || ''}`.trim(),
        phone: row.phone || row.telephone || row.mobile,
        company_name: row.company || row.company_name || row.organization,
        investment_budget_min: parseInt(row.budget_min || row.min_budget || '0') || 0,
        investment_budget_max: parseInt(row.budget_max || row.max_budget || '0') || 0,
        preferred_markets: (row.markets || row.preferred_markets || '').split(';').map((m: string) => m.trim()).filter(Boolean),
        source: 'csv_import',
        activity_level: 'new'
      })).filter(i => i.email && i.full_name);

      const { data, error } = await supabase.functions.invoke('manage-investor-crm', {
        body: { action: 'import_csv', investors }
      });

      setImporting(false);

      if (error) {
        toast({ title: 'Import failed', description: error.message, variant: 'destructive' });
      } else {
        setResult({ imported: data.imported, skipped: data.skipped });
        toast({ title: `Imported ${data.imported} investors` });
        if (data.imported > 0) {
          setTimeout(() => { onImported(); onClose(); setFile(null); setPreview([]); setResult(null); }, 2000);
        }
      }
    };
    reader.readAsText(file);
  };

  const downloadTemplate = () => {
    const csv = 'email,full_name,phone,company_name,budget_min,budget_max,markets\njohn@example.com,John Smith,555-1234,ABC Investments,100000,500000,Austin;Miami\njane@example.com,Jane Doe,555-5678,XYZ Holdings,200000,1000000,Denver;Phoenix';
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'investor_import_template.csv';
    a.click();
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Upload className="w-5 h-5 text-[#d4a574]" />
            Import Investors from CSV
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <p className="text-sm text-gray-600">Upload a CSV file with investor contacts</p>
            <Button variant="outline" size="sm" onClick={downloadTemplate}>
              <Download className="w-4 h-4 mr-2" />Download Template
            </Button>
          </div>

          <div className="border-2 border-dashed rounded-lg p-8 text-center cursor-pointer hover:border-[#d4a574] transition-colors" onClick={() => fileRef.current?.click()}>
            <Input ref={fileRef} type="file" accept=".csv" onChange={handleFileChange} className="hidden" />
            {file ? (
              <div className="flex items-center justify-center gap-2">
                <FileText className="w-8 h-8 text-[#d4a574]" />
                <div><p className="font-medium">{file.name}</p><p className="text-sm text-gray-500">{(file.size / 1024).toFixed(1)} KB</p></div>
              </div>
            ) : (
              <div><Upload className="w-12 h-12 mx-auto text-gray-400 mb-2" /><p className="text-gray-600">Click to select CSV file</p><p className="text-xs text-gray-400 mt-1">Required: email, full_name</p></div>
            )}
          </div>

          {preview.length > 0 && (
            <div>
              <p className="text-sm font-medium mb-2">Preview (first 5 rows):</p>
              <div className="border rounded overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="bg-gray-50"><tr>{Object.keys(preview[0]).slice(0, 5).map(k => <th key={k} className="p-2 text-left">{k}</th>)}</tr></thead>
                  <tbody>{preview.map((row, i) => <tr key={i} className="border-t">{Object.values(row).slice(0, 5).map((v: any, j) => <td key={j} className="p-2">{v}</td>)}</tr>)}</tbody>
                </table>
              </div>
            </div>
          )}

          {result && (
            <div className={`p-3 rounded-lg flex items-center gap-2 ${result.skipped > 0 ? 'bg-yellow-50' : 'bg-green-50'}`}>
              <CheckCircle className="w-5 h-5 text-green-600" />
              <p><strong>{result.imported}</strong> imported, <strong>{result.skipped}</strong> skipped (duplicates)</p>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={importing}>Cancel</Button>
          <Button onClick={handleImport} disabled={importing || !file} className="bg-[#d4a574]">
            {importing ? <><Loader2 className="w-4 h-4 animate-spin mr-2" />Importing...</> : <><Upload className="w-4 h-4 mr-2" />Import Investors</>}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
