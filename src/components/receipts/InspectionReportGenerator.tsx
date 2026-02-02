import { useState, useEffect } from 'react';
import { Deal, getSignedFileUrl } from '@/integrations/aws/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { SecureImage } from '@/components/ui/SecureImage';
import { FileText, Download, Image as ImageIcon, Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';

interface InspectionReportGeneratorProps {
  deal: Deal;
  onSave?: () => void;
}

// Damage categories for categorizing images
const damageCategories = [
  { id: 'shingle_damage', label: 'Shingle Damage', description: 'Missing, cracked, or lifted shingles' },
  { id: 'hail_damage', label: 'Hail Damage', description: 'Impact marks and dents from hail' },
  { id: 'wind_damage', label: 'Wind Damage', description: 'Lifted or blown-off materials' },
  { id: 'flashing_damage', label: 'Flashing Damage', description: 'Damaged or missing flashing' },
  { id: 'gutter_damage', label: 'Gutter Damage', description: 'Dents, holes, or detachment' },
  { id: 'vent_damage', label: 'Vent/Pipe Damage', description: 'Damaged vents or pipe boots' },
  { id: 'fascia_soffit', label: 'Fascia/Soffit Damage', description: 'Damage to fascia or soffit boards' },
  { id: 'general_wear', label: 'General Wear', description: 'Age-related deterioration' },
  { id: 'other', label: 'Other Damage', description: 'Other types of damage' },
];

interface ImageSelection {
  url: string;
  selected: boolean;
  category: string;
}

export function InspectionReportGenerator({ deal, onSave }: InspectionReportGeneratorProps) {
  const [imageSelections, setImageSelections] = useState<ImageSelection[]>(() =>
    (deal.inspection_images || []).map(url => ({
      url,
      selected: true,
      category: 'general_wear'
    }))
  );
  const [selectedCategories, setSelectedCategories] = useState<string[]>(['shingle_damage', 'hail_damage', 'wind_damage']);
  const [isPrinting, setIsPrinting] = useState(false);
  const [logoBase64, setLogoBase64] = useState<string>('');

  const inspectionImages = deal.inspection_images || [];

  // Load logo as base64 on mount
  useEffect(() => {
    const loadLogo = async () => {
      try {
        const response = await fetch('/logo.png');
        const blob = await response.blob();
        const reader = new FileReader();
        reader.onloadend = () => {
          setLogoBase64(reader.result as string);
        };
        reader.readAsDataURL(blob);
      } catch (e) {
        console.error('Failed to load logo:', e);
      }
    };
    loadLogo();
  }, []);

  if (inspectionImages.length === 0) {
    return (
      <Card className="border-dashed">
        <CardContent className="pt-6 text-center">
          <ImageIcon className="w-8 h-8 mx-auto text-muted-foreground mb-2" />
          <p className="text-sm text-muted-foreground">
            No inspection photos available. Upload inspection photos first.
          </p>
        </CardContent>
      </Card>
    );
  }

  const toggleImageSelection = (index: number) => {
    setImageSelections(prev => prev.map((img, i) =>
      i === index ? { ...img, selected: !img.selected } : img
    ));
  };

  const updateImageCategory = (index: number, category: string) => {
    setImageSelections(prev => prev.map((img, i) =>
      i === index ? { ...img, category } : img
    ));
  };

  const toggleCategory = (categoryId: string) => {
    setSelectedCategories(prev =>
      prev.includes(categoryId)
        ? prev.filter(c => c !== categoryId)
        : [...prev, categoryId]
    );
  };

  const selectedImages = imageSelections.filter(img => img.selected);

  // Convert image URL to base64
  const imageToBase64 = async (url: string): Promise<string> => {
    try {
      // Get signed URL first
      const signedUrl = await getSignedFileUrl(url);
      if (!signedUrl) return url;

      const response = await fetch(signedUrl);
      const blob = await response.blob();
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
    } catch (e) {
      console.error('Failed to convert image to base64:', e);
      return url;
    }
  };

  const generateReportHtml = (resolvedImages: Record<string, string>): string => {
    const groupedImages: Record<string, ImageSelection[]> = {};

    selectedImages.forEach(img => {
      if (!groupedImages[img.category]) {
        groupedImages[img.category] = [];
      }
      groupedImages[img.category].push(img);
    });

    const categoryLabels: Record<string, string> = {};
    damageCategories.forEach(cat => {
      categoryLabels[cat.id] = cat.label;
    });

    let imagesHtml = '';
    Object.entries(groupedImages).forEach(([category, images]) => {
      imagesHtml += `
        <div class="damage-category">
          <h3>${categoryLabels[category] || category}</h3>
          <div class="image-grid">
            ${images.map((img, i) => `
              <div class="image-item">
                <img src="${resolvedImages[img.url] || img.url}" alt="Damage ${i + 1}" />
                <p class="image-caption">Photo ${i + 1}</p>
              </div>
            `).join('')}
          </div>
        </div>
      `;
    });

    return `
      <!DOCTYPE html>
      <html lang="en">
        <head>
          <title>Inspection Report - ${deal.homeowner_name}</title>
          <style>
            body { 
              font-family: Arial, sans-serif; 
              padding: 40px; 
              max-width: 900px; 
              margin: 0 auto; 
              color: #333;
              background: #fff;
            }
            .header { 
              text-align: center; 
              border-bottom: 2px solid #0F1E2E; 
              padding-bottom: 20px; 
              margin-bottom: 30px; 
            }
            .logo { 
              font-size: 28px; 
              font-weight: bold; 
              color: #0F1E2E; 
              margin-bottom: 5px;
            }
            .subtitle { 
              color: #C9A24D; 
              font-size: 14px; 
              margin-bottom: 10px;
            }
            .logo-img { 
              max-width: 200px; 
              max-height: 80px; 
              margin-bottom: 10px; 
            }
            .report-title {
              text-align: center;
              font-size: 24px;
              margin: 0 0 30px;
              color: #0F1E2E;
              font-weight: bold;
            }
            .info-grid { 
              display: grid; 
              grid-template-columns: 1fr 1fr; 
              gap: 20px; 
              margin-bottom: 30px; 
              padding: 20px; 
              background: #f9f9f9; 
              border-radius: 8px; 
            }
            .info-item { padding: 10px 0; }
            .info-label { 
              font-size: 12px; 
              color: #666; 
              text-transform: uppercase; 
            }
            .info-value { 
              font-size: 16px; 
              font-weight: 600; 
            }
            .damage-summary { 
              background: #fff3cd; 
              padding: 20px; 
              border-radius: 8px; 
              margin-bottom: 30px; 
            }
            .damage-summary h3 { 
              margin-top: 0; 
              color: #856404; 
            }
            .damage-summary ul { 
              margin: 0; 
              padding-left: 20px; 
            }
            .damage-category { 
              margin-bottom: 30px; 
              page-break-inside: avoid; 
            }
            .damage-category h3 { 
              background: #0F1E2E; 
              color: white; 
              padding: 10px 15px; 
              border-radius: 4px; 
              margin-bottom: 15px; 
            }
            .image-grid { 
              display: grid; 
              grid-template-columns: repeat(2, 1fr); 
              gap: 15px; 
            }
            .image-item { 
              border: 1px solid #ddd; 
              border-radius: 8px; 
              overflow: hidden; 
            }
            .image-item img { 
              width: 100%; 
              height: 200px; 
              object-fit: cover; 
            }
            .image-caption { 
              padding: 8px; 
              text-align: center; 
              font-size: 12px; 
              background: #f5f5f5; 
              margin: 0; 
            }
            .footer { 
              margin-top: 40px; 
              text-align: center; 
              font-size: 12px; 
              color: #666; 
              border-top: 1px solid #ddd; 
              padding-top: 20px; 
            }
            @media print {
              body { padding: 20px; }
              .damage-category { page-break-inside: avoid; }
            }
          </style>
        </head>
        <body>
          <div class="header">
            ${logoBase64 ? `<img src="${logoBase64}" alt="Titan Prime Solutions" class="logo-img" />` : ''}
            <div class="logo">TITAN PRIME SOLUTIONS</div>
            <div class="subtitle">Professional Roofing & Construction</div>
          </div>
          
          <div class="report-title">Property Inspection Report</div>
          
          <div class="info-grid">
            <div class="info-item">
              <div class="info-label">Property Owner</div>
              <div class="info-value">${deal.homeowner_name}</div>
            </div>
            <div class="info-item">
              <div class="info-label">Inspection Date</div>
              <div class="info-value">${deal.inspection_date ? format(new Date(deal.inspection_date), 'MMMM d, yyyy') : format(new Date(), 'MMMM d, yyyy')}</div>
            </div>
            <div class="info-item">
              <div class="info-label">Property Address</div>
              <div class="info-value">${deal.address}</div>
              <div style="font-size: 14px; color: #666;">${deal.city || ''}, ${deal.state || ''} ${deal.zip_code || ''}</div>
            </div>
            <div class="info-item">
              <div class="info-label">Insurance Claim</div>
              <div class="info-value">${deal.claim_number || 'Pending'}</div>
              <div style="font-size: 14px; color: #666;">${deal.insurance_company || 'N/A'}</div>
            </div>
          </div>
          
          <div class="damage-summary">
            <h3>Damage Categories Identified</h3>
            <ul>
              ${selectedCategories.map(catId => {
                const cat = damageCategories.find(c => c.id === catId);
                return cat ? `<li><strong>${cat.label}:</strong> ${cat.description}</li>` : '';
              }).join('')}
            </ul>
          </div>
          
          <h2>Photo Documentation</h2>
          ${imagesHtml}
          
          <div class="footer">
            <p>Titan Prime Solutions</p>
            <p>This inspection report documents damage observed during the property inspection.</p>
            <p>Report generated on ${format(new Date(), 'MMMM d, yyyy h:mm a')}</p>
          </div>
        </body>
      </html>
    `;
  };

  const handleDownload = async () => {
    if (isPrinting) return;
    setIsPrinting(true);

    try {
      toast.info('Preparing report with images...');

      // Convert all selected images to base64
      const resolvedImages: Record<string, string> = {};
      for (const img of selectedImages) {
        try {
          resolvedImages[img.url] = await imageToBase64(img.url);
        } catch (e) {
          console.error('Failed to convert image:', e);
          resolvedImages[img.url] = img.url; // Use original URL as fallback
        }
      }

      const html = generateReportHtml(resolvedImages);
      const filename = `Inspection-Report-${deal.homeowner_name.replace(/\s+/g, '-')}.html`;

      const blob = new Blob([html], { type: 'text/html;charset=utf-8' });

      // Try Web Share API first (works on iOS Safari and PWA)
      try {
        const file = new File([blob], filename, { type: 'text/html' });
        if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
          await navigator.share({
            files: [file],
            title: 'Inspection Report',
          });
          toast.success('Report shared');
          return;
        }
      } catch (shareError) {
        // Web Share API not supported or failed, continue to fallback
        console.log('Web Share not available, using download fallback');
      }

      // Fallback for desktop, Android, and when Web Share fails
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      link.style.display = 'none';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setTimeout(() => URL.revokeObjectURL(url), 100);
      toast.success('Report downloaded');
    } catch (error) {
      console.error('Error generating report:', error);
      toast.error('Failed to generate report');
    } finally {
      setIsPrinting(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <FileText className="w-5 h-5" />
          Inspection Report Generator
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Damage Categories Selection */}
        <div className="space-y-3">
          <Label>Damage Categories (for report)</Label>
          <div className="grid grid-cols-2 gap-2">
            {damageCategories.map(cat => (
              <div
                key={cat.id}
                className="flex items-center space-x-2 p-2 border rounded-lg hover:bg-muted cursor-pointer"
                onClick={() => toggleCategory(cat.id)}
              >
                <Checkbox
                  checked={selectedCategories.includes(cat.id)}
                  onCheckedChange={() => toggleCategory(cat.id)}
                />
                <div className="flex-1">
                  <p className="text-sm font-medium">{cat.label}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Image Selection */}
        <div className="space-y-3">
          <Label>Select Photos to Include ({selectedImages.length} selected)</Label>
          <div className="grid grid-cols-3 gap-3">
            {imageSelections.map((img, index) => (
              <div
                key={index}
                className={`relative border-2 rounded-lg overflow-hidden cursor-pointer transition-all ${
                  img.selected ? 'border-primary ring-2 ring-primary/20' : 'border-muted'
                }`}
                onClick={() => toggleImageSelection(index)}
              >
                <SecureImage
                  src={img.url}
                  alt={`Inspection ${index + 1}`}
                  className="w-full h-24 object-cover"
                />
                <div className="absolute top-2 right-2">
                  <Checkbox checked={img.selected} />
                </div>
                {img.selected && (
                  <select
                    className="w-full text-xs p-1 bg-muted"
                    value={img.category}
                    onChange={(e) => {
                      e.stopPropagation();
                      updateImageCategory(index, e.target.value);
                    }}
                    onClick={(e) => e.stopPropagation()}
                  >
                    {damageCategories.map(cat => (
                      <option key={cat.id} value={cat.id}>{cat.label}</option>
                    ))}
                  </select>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-3">
          <Button
            onClick={handleDownload}
            disabled={selectedImages.length === 0 || isPrinting}
            className="flex-1 gap-2"
          >
            {isPrinting ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Download className="w-4 h-4" />
            )}
            {isPrinting ? 'Preparing...' : 'Download Report'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
