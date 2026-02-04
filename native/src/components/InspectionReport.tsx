import { useState, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Image, StyleSheet, Alert, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { format } from 'date-fns';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { Deal, getSignedFileUrl } from '../services/api';
import { colors } from '../constants/config';
import { getLogoBase64, companyBranding } from '../constants/branding';

interface InspectionReportProps {
  deal: Deal;
  onClose: () => void;
}

const damageCategories = [
  { id: 'shingle_damage', label: 'Shingle Damage', icon: 'layers' as const },
  { id: 'hail_damage', label: 'Hail Damage', icon: 'rainy' as const },
  { id: 'wind_damage', label: 'Wind Damage', icon: 'thunderstorm' as const },
  { id: 'flashing_damage', label: 'Flashing Damage', icon: 'flash' as const },
  { id: 'gutter_damage', label: 'Gutter Damage', icon: 'water' as const },
  { id: 'vent_damage', label: 'Vent/Pipe Damage', icon: 'funnel' as const },
  { id: 'general_wear', label: 'General Wear', icon: 'time' as const },
];

interface ImageWithUrl {
  original: string;
  signedUrl: string | null;
  selected: boolean;
  category: string;
}

export function InspectionReport({ deal, onClose }: InspectionReportProps) {
  const [images, setImages] = useState<ImageWithUrl[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [editingImageIndex, setEditingImageIndex] = useState<number | null>(null);
  const [logoBase64, setLogoBase64] = useState<string>('');

  // Load logo on mount
  useEffect(() => {
    getLogoBase64().then(setLogoBase64);
  }, []);

  useEffect(() => {
    const loadImages = async () => {
      if (!deal.inspection_images || deal.inspection_images.length === 0) {
        setLoading(false);
        return;
      }

      const loaded: ImageWithUrl[] = [];
      for (const img of deal.inspection_images) {
        const signedUrl = await getSignedFileUrl(img);
        loaded.push({
          original: img,
          signedUrl,
          selected: true,
          category: 'general_wear',
        });
      }
      setImages(loaded);
      setLoading(false);
    };

    loadImages();
  }, [deal.inspection_images]);

  const toggleImage = (index: number) => {
    setImages(prev => prev.map((img, i) =>
      i === index ? { ...img, selected: !img.selected } : img
    ));
  };

  const updateImageCategory = (index: number, category: string) => {
    setImages(prev => prev.map((img, i) =>
      i === index ? { ...img, category } : img
    ));
    setEditingImageIndex(null);
  };

  const generatePDF = async () => {
    setGenerating(true);

    const selectedImages = images.filter(img => img.selected && img.signedUrl);

    // Group images by category
    const imagesByCategory: Record<string, ImageWithUrl[]> = {};
    selectedImages.forEach(img => {
      if (!imagesByCategory[img.category]) {
        imagesByCategory[img.category] = [];
      }
      imagesByCategory[img.category].push(img);
    });

    const html = `
      <!DOCTYPE html>
      <html lang="en">
        <head>
          <meta charset="UTF-8">
          <title>Inspection Report - ${deal.homeowner_name}</title>
          <style>
            * { box-sizing: border-box; }
            body { 
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif; 
              padding: 40px; 
              max-width: 800px; 
              margin: 0 auto; 
              color: #333;
              line-height: 1.5;
            }
            .header { 
              text-align: center; 
              padding-bottom: 24px; 
              margin-bottom: 24px; 
              border-bottom: 3px solid #0F1E2E;
            }
            .logo-icon {
              width: 80px;
              height: 80px;
              margin: 0 auto 16px;
            }
            .logo { 
              font-size: 28px; 
              font-weight: bold; 
              color: #0F1E2E; 
              letter-spacing: 1px;
              margin-bottom: 4px;
            }
            .tagline { 
              color: #C9A24D; 
              font-size: 14px;
              font-weight: 500;
            }
            .report-title {
              text-align: center;
              font-size: 24px;
              margin: 32px 0;
              color: #0F1E2E;
              font-weight: bold;
            }
            .info-card { 
              background: #F5F5F5; 
              border-radius: 8px;
              padding: 24px;
              margin-bottom: 24px;
            }
            .info-grid {
              display: flex;
              flex-wrap: wrap;
              gap: 24px;
            }
            .info-item { 
              width: calc(50% - 12px);
            }
            .info-label { 
              font-size: 11px; 
              color: #666; 
              text-transform: uppercase;
              letter-spacing: 0.5px;
              margin-bottom: 4px;
            }
            .info-value { 
              font-size: 16px; 
              font-weight: 600;
              color: #111;
            }
            .damage-summary { 
              background: #FEF9E7; 
              padding: 20px 24px; 
              border-radius: 8px; 
              margin-bottom: 32px;
              border-left: 4px solid #C9A24D;
            }
            .damage-summary h3 { 
              margin: 0 0 12px 0; 
              color: #C9A24D; 
              font-size: 16px;
              font-weight: 600;
            }
            .damage-list { 
              margin: 0; 
              padding-left: 20px;
            }
            .damage-list li {
              margin-bottom: 6px;
              font-size: 14px;
              color: #333;
            }
            .damage-list li strong {
              color: #111;
            }
            .section-title {
              font-size: 20px;
              font-weight: bold;
              color: #0F1E2E;
              margin: 32px 0 16px;
            }
            .damage-category { 
              margin-bottom: 24px; 
              page-break-inside: avoid; 
            }
            .damage-category-header { 
              background: #0F1E2E; 
              color: white; 
              padding: 12px 16px; 
              border-radius: 8px 8px 0 0; 
              font-size: 15px;
              font-weight: 600;
            }
            .image-grid { 
              display: flex; 
              flex-wrap: wrap; 
              gap: 12px;
              padding: 16px;
              background: #F9FAFB;
              border: 1px solid #E5E7EB;
              border-top: none;
              border-radius: 0 0 8px 8px;
            }
            .image-item { 
              width: calc(50% - 6px);
              border-radius: 8px; 
              overflow: hidden;
              border: 1px solid #E5E7EB;
            }
            .image-item img { 
              width: 100%; 
              height: 180px; 
              object-fit: cover;
              display: block;
            }
            .footer { 
              margin-top: 40px; 
              padding-top: 20px; 
              border-top: 2px solid #E5E7EB; 
              text-align: center; 
            }
            .footer p {
              font-size: 12px;
              color: #666;
              margin: 8px 0;
            }
            .footer .company {
              font-weight: 600;
              color: #0F1E2E;
              font-size: 14px;
            }
          </style>
        </head>
        <body>
          <div class="header">
            ${logoBase64 ? `<img class="logo-icon" src="${logoBase64}" alt="Logo" />` : ''}
            <div class="logo">${companyBranding.name}</div>
            <div class="tagline">${companyBranding.tagline}</div>
          </div>
          
          <h1 class="report-title">Property Inspection Report</h1>
          
          <div class="info-card">
            <div class="info-grid">
              <div class="info-item">
                <div class="info-label">Property Owner</div>
                <div class="info-value">${deal.homeowner_name}</div>
              </div>
              <div class="info-item">
                <div class="info-label">Inspection Date</div>
                <div class="info-value">${format(new Date(), 'MMMM d, yyyy')}</div>
              </div>
              <div class="info-item">
                <div class="info-label">Property Address</div>
                <div class="info-value">${deal.address}${deal.city ? `, ${deal.city}` : ''}${deal.state ? `, ${deal.state}` : ''}${deal.zip_code ? ` ${deal.zip_code}` : ''}, United States</div>
              </div>
              <div class="info-item">
                <div class="info-label">Insurance Claim</div>
                <div class="info-value">${deal.claim_number || 'N/A'}<br/>${deal.insurance_company || ''}</div>
              </div>
            </div>
          </div>
          
          <div class="damage-summary">
            <h3>Damage Categories Identified</h3>
            <ul class="damage-list">
              ${Object.entries(imagesByCategory).map(([catId]) => {
                const cat = damageCategories.find(c => c.id === catId);
                const descriptions: Record<string, string> = {
                  'shingle_damage': 'Missing, cracked, or lifted shingles',
                  'hail_damage': 'Impact marks and dents from hail',
                  'wind_damage': 'Lifted or blown-off materials',
                  'flashing_damage': 'Damaged or missing flashing',
                  'gutter_damage': 'Dented or clogged gutters',
                  'vent_damage': 'Damaged vents or pipe boots',
                  'general_wear': 'General wear and aging'
                };
                return `<li><strong>${cat?.label || catId}:</strong> ${descriptions[catId] || ''}</li>`;
              }).join('')}
            </ul>
          </div>
          
          <h2 class="section-title">Photo Documentation</h2>
          
          ${Object.entries(imagesByCategory).map(([catId, catImages]) => {
            const catLabel = damageCategories.find(c => c.id === catId)?.label || catId;
            return `
              <div class="damage-category">
                <div class="damage-category-header">${catLabel}</div>
                <div class="image-grid">
                  ${catImages.map(img => `
                    <div class="image-item">
                      <img src="${img.signedUrl}" alt="${catLabel}" />
                    </div>
                  `).join('')}
                </div>
              </div>
            `;
          }).join('')}
          
          <div class="footer">
            <p class="company">Titan Prime Solutions</p>
            <p>This inspection was conducted by a certified representative.</p>
            <p>Report generated on ${format(new Date(), 'MMMM d, yyyy')}</p>
          </div>
        </body>
      </html>
    `;

    try {
      const { uri } = await Print.printToFileAsync({ html });
      await Sharing.shareAsync(uri, {
        mimeType: 'application/pdf',
        dialogTitle: `Inspection Report - ${deal.homeowner_name}`,
        UTI: 'com.adobe.pdf'
      });
    } catch (error) {
      console.error('PDF generation error:', error);
      Alert.alert('Error', 'Failed to generate PDF');
    } finally {
      setGenerating(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <View style={styles.fixedHeader}>
          <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
            <Ionicons name="close" size={24} color="#374151" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Inspection Report</Text>
          <View style={{ width: 40 }} />
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Loading inspection photos...</Text>
        </View>
      </View>
    );
  }

  if (images.length === 0) {
    return (
      <View style={styles.container}>
        <View style={styles.fixedHeader}>
          <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
            <Ionicons name="close" size={24} color="#374151" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Inspection Report</Text>
          <View style={{ width: 40 }} />
        </View>
        <View style={styles.emptyContainer}>
          <Ionicons name="images-outline" size={48} color="#9CA3AF" />
          <Text style={styles.emptyText}>No inspection photos available</Text>
          <Text style={styles.emptySubtext}>Upload inspection photos first</Text>
        </View>
      </View>
    );
  }

  const selectedCount = images.filter(img => img.selected).length;

  return (
    <View style={styles.container}>
      {/* Fixed Header */}
      <View style={styles.fixedHeader}>
        <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
          <Ionicons name="close" size={24} color="#374151" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Inspection Report</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {/* Property Info Card */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Ionicons name="home" size={18} color={colors.primary} />
            <Text style={styles.cardTitle}>Property Information</Text>
          </View>
          <View style={styles.infoGrid}>
            <View style={styles.infoItem}>
              <Text style={styles.infoLabel}>Homeowner</Text>
              <Text style={styles.infoValue}>{deal.homeowner_name}</Text>
            </View>
            <View style={styles.infoItem}>
              <Text style={styles.infoLabel}>Address</Text>
              <Text style={styles.infoValue}>{deal.address}</Text>
            </View>
            {deal.insurance_company && (
              <View style={styles.infoItem}>
                <Text style={styles.infoLabel}>Insurance</Text>
                <Text style={styles.infoValue}>{deal.insurance_company}</Text>
              </View>
            )}
            {deal.claim_number && (
              <View style={styles.infoItem}>
                <Text style={styles.infoLabel}>Claim #</Text>
                <Text style={styles.infoValue}>{deal.claim_number}</Text>
              </View>
            )}
          </View>
        </View>

        {/* Photos Selection */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Ionicons name="camera" size={18} color={colors.primary} />
            <Text style={styles.cardTitle}>Photos</Text>
            <Text style={styles.photoCount}>{selectedCount}/{images.length}</Text>
          </View>
          <Text style={styles.cardSubtext}>Tap image to select, tap label to change damage type</Text>

          <View style={styles.photoGrid}>
            {images.map((img, idx) => (
              <View key={idx} style={styles.photoItemContainer}>
                <TouchableOpacity
                  style={[styles.photoItem, img.selected && styles.photoItemSelected]}
                  onPress={() => toggleImage(idx)}
                >
                  {img.signedUrl ? (
                    <Image
                      source={{ uri: img.signedUrl }}
                      style={styles.photoImage}
                      resizeMode="cover"
                    />
                  ) : (
                    <View style={styles.photoPlaceholder}>
                      <Ionicons name="image-outline" size={24} color="#9CA3AF" />
                    </View>
                  )}
                  {img.selected && (
                    <View style={styles.photoCheck}>
                      <Ionicons name="checkmark-circle" size={20} color="#22C55E" />
                    </View>
                  )}
                </TouchableOpacity>

                {/* Damage Type Selector */}
                <TouchableOpacity
                  style={styles.damageTypeBtn}
                  onPress={() => setEditingImageIndex(editingImageIndex === idx ? null : idx)}
                >
                  <Text style={styles.damageTypeText} numberOfLines={1}>
                    {damageCategories.find(c => c.id === img.category)?.label || 'Select Type'}
                  </Text>
                  <Ionicons name="chevron-down" size={14} color="#6B7280" />
                </TouchableOpacity>

                {/* Dropdown */}
                {editingImageIndex === idx && (
                  <View style={styles.damageDropdown}>
                    {damageCategories.map(cat => (
                      <TouchableOpacity
                        key={cat.id}
                        style={[styles.damageOption, img.category === cat.id && styles.damageOptionSelected]}
                        onPress={() => updateImageCategory(idx, cat.id)}
                      >
                        <Text style={[styles.damageOptionText, img.category === cat.id && styles.damageOptionTextSelected]}>
                          {cat.label}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
              </View>
            ))}
          </View>
        </View>

        {/* Generate Button */}
        <TouchableOpacity
          style={[styles.generateButton, generating && styles.generateButtonDisabled]}
          onPress={generatePDF}
          disabled={generating || selectedCount === 0}
        >
          {generating ? (
            <ActivityIndicator size="small" color="#FFF" />
          ) : (
            <>
              <Ionicons name="document-text" size={20} color="#FFF" />
              <Text style={styles.generateButtonText}>Generate PDF Report</Text>
            </>
          )}
        </TouchableOpacity>

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },

  fixedHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 60,
    paddingBottom: 12,
    backgroundColor: '#FFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB'
  },
  closeBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F3F4F6',
    borderRadius: 20,
  },
  headerTitle: { fontSize: 18, fontWeight: '600', color: '#111827' },

  scrollView: { flex: 1 },

  loadingContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40 },
  loadingText: { marginTop: 12, color: '#6B7280', fontSize: 14 },
  emptyContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40 },
  emptyText: { marginTop: 12, fontSize: 16, fontWeight: '600', color: '#374151' },
  emptySubtext: { marginTop: 4, fontSize: 14, color: '#6B7280' },

  card: { backgroundColor: '#FFF', margin: 16, marginBottom: 0, borderRadius: 12, padding: 16, borderWidth: 1, borderColor: '#E5E7EB' },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  cardTitle: { fontSize: 16, fontWeight: '600', color: '#111827', flex: 1 },
  cardSubtext: { fontSize: 13, color: '#6B7280', marginBottom: 12 },

  infoGrid: { gap: 12 },
  infoItem: { flexDirection: 'row', justifyContent: 'space-between' },
  infoLabel: { fontSize: 13, color: '#6B7280' },
  infoValue: { fontSize: 14, color: '#111827', fontWeight: '500' },

  photoCount: { fontSize: 12, color: '#6B7280', backgroundColor: '#F3F4F6', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10 },
  photoGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  photoItemContainer: { width: '47%', marginBottom: 8 },
  photoItem: { aspectRatio: 1, borderRadius: 8, overflow: 'hidden', borderWidth: 2, borderColor: '#E5E7EB' },
  photoItemSelected: { borderColor: '#22C55E' },
  photoImage: { width: '100%', height: '100%' },
  photoPlaceholder: { flex: 1, backgroundColor: '#F3F4F6', alignItems: 'center', justifyContent: 'center' },
  photoCheck: { position: 'absolute', top: 6, right: 6, backgroundColor: '#FFF', borderRadius: 10 },

  damageTypeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 6,
    paddingHorizontal: 8,
    paddingVertical: 6,
    backgroundColor: '#F3F4F6',
    borderRadius: 6
  },
  damageTypeText: { fontSize: 11, color: '#374151', flex: 1 },

  damageDropdown: {
    position: 'absolute',
    top: '100%',
    left: 0,
    right: 0,
    backgroundColor: '#FFF',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    zIndex: 100,
    marginTop: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  damageOption: { paddingHorizontal: 10, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  damageOptionSelected: { backgroundColor: 'rgba(201, 162, 77, 0.1)' },
  damageOptionText: { fontSize: 12, color: '#374151' },
  damageOptionTextSelected: { color: colors.primary, fontWeight: '500' },

  generateButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, margin: 16, backgroundColor: colors.primary, paddingVertical: 16, borderRadius: 12 },
  generateButtonDisabled: { opacity: 0.6 },
  generateButtonText: { color: '#FFF', fontSize: 16, fontWeight: '600' },
});
