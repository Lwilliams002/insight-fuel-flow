import { useState, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, TextInput, StyleSheet, Alert, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { format } from 'date-fns';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system';
import { Deal, uploadFile, dealsApi } from '../services/api';
import { colors } from '../constants/config';
import { getLogoBase64, companyBranding } from '../constants/branding';
import { SignaturePad } from './SignaturePad';

export type ReceiptType = 'acv' | 'deductible' | 'depreciation';

type IoniconsName = React.ComponentProps<typeof Ionicons>['name'];

interface PaymentReceiptProps {
  deal: Deal;
  repName: string;
  type: ReceiptType;
  onClose: () => void;
  onSave?: (receiptData: ReceiptData) => void;
}

interface ReceiptData {
  type: ReceiptType;
  amount: number;
  paymentMethod: string;
  checkNumber: string;
  datePaid: string;
  receiptUrl?: string;
}

const receiptConfig: Record<ReceiptType, { title: string; description: string; fieldLabel: string; icon: IoniconsName }> = {
  acv: {
    title: 'ACV Payment Receipt',
    description: 'Actual Cash Value Payment',
    fieldLabel: 'ACV Amount',
    icon: 'cash',
  },
  deductible: {
    title: 'Deductible Receipt',
    description: 'Homeowner Deductible Payment',
    fieldLabel: 'Deductible Amount',
    icon: 'wallet',
  },
  depreciation: {
    title: 'Depreciation Receipt',
    description: 'Depreciation/RCV Release',
    fieldLabel: 'Depreciation Amount',
    icon: 'trending-up',
  },
};

const paymentMethods = ['Check', 'Cash', 'Credit Card', 'Bank Transfer', 'Other'];

export function PaymentReceipt({ deal, repName, type, onClose, onSave }: PaymentReceiptProps) {
  const config = receiptConfig[type];

  const [amount, setAmount] = useState(() => {
    switch (type) {
      case 'acv': return deal.acv?.toString() || '0';
      case 'deductible': return deal.deductible?.toString() || '0';
      case 'depreciation': return deal.depreciation?.toString() || '0';
      default: return '0';
    }
  });
  const [paymentMethod, setPaymentMethod] = useState('Check');
  const [checkNumber, setCheckNumber] = useState('');
  const [datePaid] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [showMethodPicker, setShowMethodPicker] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [logoBase64, setLogoBase64] = useState<string>('');
  const [signatureDataUrl, setSignatureDataUrl] = useState<string | null>(null);
  const [scrollEnabled, setScrollEnabled] = useState(true);

  // Load logo on mount
  useEffect(() => {
    getLogoBase64().then(setLogoBase64);
  }, []);

  const generatePDF = async () => {
    setGenerating(true);

    const html = `
      <!DOCTYPE html>
      <html lang="en">
        <head>
          <meta charset="UTF-8">
          <title>${config.title} - ${deal.homeowner_name}</title>
          <style>
            * { box-sizing: border-box; }
            body { 
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif; 
              padding: 40px; 
              max-width: 650px; 
              margin: 0 auto; 
              color: #333;
              line-height: 1.5;
            }
            .header { 
              text-align: center; 
              padding-bottom: 20px; 
              margin-bottom: 8px; 
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
            .receipt-title {
              text-align: center;
              font-size: 20px;
              margin: 8px 0 20px;
              color: #0F1E2E;
              font-weight: 600;
              padding-bottom: 16px;
              border-bottom: 3px solid #0F1E2E;
            }
            .info-row {
              display: flex;
              gap: 16px;
              margin-bottom: 16px;
            }
            .info-card { 
              flex: 1;
              background: #F5F5F5; 
              border-radius: 8px;
              padding: 16px 20px;
            }
            .info-label { 
              font-size: 12px; 
              color: #666; 
              margin-bottom: 4px;
            }
            .info-value { 
              font-size: 16px; 
              font-weight: 600;
              color: #111;
            }
            .amount-card {
              background: #0F1E2E;
              color: white;
              padding: 28px;
              border-radius: 12px;
              text-align: center;
              margin: 24px 0;
            }
            .amount-label {
              font-size: 14px;
              opacity: 0.85;
              margin-bottom: 8px;
            }
            .amount-value {
              font-size: 42px;
              font-weight: bold;
              color: #C9A24D;
            }
            .divider {
              height: 2px;
              background: #E5E7EB;
              margin: 32px 0;
            }
            .acknowledgment-title {
              font-size: 20px;
              font-weight: bold;
              color: #0F1E2E;
              margin-bottom: 8px;
            }
            .acknowledgment-text {
              font-size: 14px;
              color: #666;
              margin-bottom: 32px;
            }
            .signature-section {
              display: flex;
              gap: 40px;
              margin-top: 24px;
            }
            .signature-block {
              flex: 1;
            }
            .signature-area {
              height: 80px;
              border-bottom: 2px solid #111;
              margin-bottom: 8px;
            }
            .signature-label {
              font-size: 12px;
              color: #666;
            }
            .rep-section {
              margin-top: 40px;
            }
            .rep-title {
              font-size: 16px;
              font-weight: bold;
              color: #0F1E2E;
              margin-bottom: 16px;
            }
            .rep-signature-area {
              height: 60px;
              border-bottom: 2px solid #111;
              margin-bottom: 8px;
              max-width: 300px;
            }
            .footer { 
              margin-top: 48px; 
              text-align: center; 
            }
            .footer-company {
              font-weight: 600;
              color: #0F1E2E;
              font-size: 14px;
            }
            .footer-text {
              font-size: 11px;
              color: #666;
              margin-top: 4px;
            }
            .logo-img {
              width: 80px;
              height: 80px;
              margin: 0 auto 12px;
            }
          </style>
        </head>
        <body>
          <div class="header">
            ${logoBase64 ? `<img class="logo-img" src="${logoBase64}" alt="Logo" />` : ''}
            <div class="logo">${companyBranding.name}</div>
            <div class="tagline">${companyBranding.tagline}</div>
          </div>
          
          <h1 class="receipt-title">${config.title}</h1>
          
          <div class="info-row">
            <div class="info-card">
              <div class="info-label">Homeowner</div>
              <div class="info-value">${deal.homeowner_name}</div>
            </div>
            <div class="info-card">
              <div class="info-label">Date</div>
              <div class="info-value">${format(new Date(datePaid), 'M/d/yyyy')}</div>
            </div>
          </div>
          
          <div class="info-row">
            <div class="info-card">
              <div class="info-label">Property Address</div>
              <div class="info-value">${deal.address}${deal.city ? `, ${deal.city}` : ''}${deal.state ? `, ${deal.state}` : ''}${deal.zip_code ? ` ${deal.zip_code}` : ''}, United States</div>
            </div>
            <div class="info-card">
              <div class="info-label">Payment Method</div>
              <div class="info-value">${paymentMethod}${paymentMethod === 'Check' && checkNumber ? ` #${checkNumber}` : ''}</div>
            </div>
          </div>
          
          ${type === 'acv' ? `
          <div style="background: #F9FAFB; border-radius: 8px; padding: 16px; margin-bottom: 20px; border: 1px solid #E5E7EB;">
            <div style="font-size: 14px; font-weight: 600; color: #374151; margin-bottom: 12px;">Material Specifications</div>
            <div style="display: flex; flex-wrap: wrap; gap: 16px;">
              <div style="flex: 1; min-width: 120px;">
                <div class="info-label">Category</div>
                <div style="font-size: 14px; font-weight: 500; color: #111;">${deal.material_category || 'N/A'}</div>
              </div>
              ${(deal.material_category === 'Metal' || deal.material_category === 'Architectural Metal') ? `
              <div style="flex: 1; min-width: 120px;">
                <div class="info-label">Metal Type</div>
                <div style="font-size: 14px; font-weight: 500; color: #111;">${deal.material_type || 'N/A'}</div>
              </div>
              ` : ''}
              <div style="flex: 1; min-width: 120px;">
                <div class="info-label">Material Color</div>
                <div style="font-size: 14px; font-weight: 500; color: #111;">${deal.material_color || 'N/A'}</div>
              </div>
              <div style="flex: 1; min-width: 120px;">
                <div class="info-label">Drip Edge</div>
                <div style="font-size: 14px; font-weight: 500; color: #111;">${deal.drip_edge || 'N/A'}</div>
              </div>
              <div style="flex: 1; min-width: 120px;">
                <div class="info-label">Vent Color</div>
                <div style="font-size: 14px; font-weight: 500; color: #111;">${deal.vent_color || 'N/A'}</div>
              </div>
            </div>
          </div>
          ` : ''}
          
          <div class="amount-card">
            <div class="amount-label">${config.description}</div>
            <div class="amount-value">$${parseFloat(amount || '0').toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
          </div>
          
          <div class="divider"></div>
          
          <div class="acknowledgment-title">Acknowledgment</div>
          <p class="acknowledgment-text">By signing below, I acknowledge receipt of the above payment.</p>
          
          <div class="signature-section">
            <div class="signature-block">
              <div class="signature-area">
                ${signatureDataUrl ? `<img src="${signatureDataUrl}" alt="Homeowner Signature" style="max-height: 70px; max-width: 100%;" />` : ''}
              </div>
              <div class="signature-label">Homeowner Signature</div>
            </div>
          </div>
          
          <div class="rep-section">
            <div class="rep-title">Sales Rep</div>
            <div class="rep-signature-area"></div>
            <div class="signature-label">Sales Representative</div>
          </div>
          
          <div class="footer">
            <div class="footer-company">Titan Prime Solutions</div>
            <div class="footer-text">Thank you for choosing us for your roofing needs.</div>
          </div>
        </body>
      </html>
    `;

    try {
      const { uri } = await Print.printToFileAsync({ html });

      // Save the PDF to Wasabi storage
      let receiptUrl: string | undefined;
      try {
        const fileName = `${config.title.replace(/\s+/g, '_')}_${deal.homeowner_name.replace(/\s+/g, '_')}_${datePaid}.pdf`;
        const uploadResult = await uploadFile(uri, fileName, 'application/pdf', 'receipts', deal.id);

        if (uploadResult) {
          receiptUrl = uploadResult.key;

          // Update the deal with the receipt URL based on type
          const updateField = type === 'acv' ? 'acv_receipt_url'
            : type === 'deductible' ? 'deductible_receipt_url'
            : 'depreciation_receipt_url';

          await dealsApi.update(deal.id, { [updateField]: receiptUrl });
          console.log(`Receipt saved to Wasabi: ${receiptUrl}`);
        }
      } catch (uploadError) {
        console.warn('Failed to upload receipt to storage:', uploadError);
        // Continue with sharing even if upload fails
      }

      await Sharing.shareAsync(uri, {
        mimeType: 'application/pdf',
        dialogTitle: `${config.title} - ${deal.homeowner_name}`,
        UTI: 'com.adobe.pdf'
      });

      if (onSave) {
        onSave({
          type,
          amount: parseFloat(amount),
          paymentMethod,
          checkNumber,
          datePaid,
          receiptUrl,
        });
      }

      // Show success message if saved to cloud
      if (receiptUrl) {
        Alert.alert('Success', 'Receipt generated and saved to cloud storage.');
      }
    } catch (error) {
      console.error('PDF generation error:', error);
      Alert.alert('Error', 'Failed to generate PDF');
    } finally {
      setGenerating(false);
    }
  };

  return (
    <View style={styles.container}>
      {/* Fixed Header */}
      <View style={styles.fixedHeader}>
        <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
          <Ionicons name="close" size={24} color="#374151" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{config.title}</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false} scrollEnabled={scrollEnabled}>
        {/* Property Info */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Ionicons name="home" size={18} color={colors.primary} />
            <Text style={styles.cardTitle}>Property Information</Text>
          </View>
          <View style={styles.infoGrid}>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Homeowner</Text>
              <Text style={styles.infoValue}>{deal.homeowner_name}</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Address</Text>
              <Text style={styles.infoValue}>{deal.address}</Text>
            </View>
            {deal.insurance_company && (
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Insurance</Text>
                <Text style={styles.infoValue}>{deal.insurance_company}</Text>
              </View>
            )}
            {deal.claim_number && (
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Claim #</Text>
                <Text style={styles.infoValueMono}>{deal.claim_number}</Text>
              </View>
            )}
          </View>
        </View>

        {/* Payment Details */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Ionicons name={config.icon} size={18} color="#22C55E" />
            <Text style={styles.cardTitle}>Payment Details</Text>
          </View>

          {/* Amount */}
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>{config.fieldLabel}</Text>
            <View style={styles.amountInputContainer}>
              <Text style={styles.currencySymbol}>$</Text>
              <TextInput
                style={styles.amountInput}
                value={amount}
                onChangeText={setAmount}
                keyboardType="decimal-pad"
                placeholder="0.00"
              />
            </View>
          </View>

          {/* Payment Method */}
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Payment Method</Text>
            <TouchableOpacity
              style={styles.selectButton}
              onPress={() => setShowMethodPicker(!showMethodPicker)}
            >
              <Text style={styles.selectButtonText}>{paymentMethod}</Text>
              <Ionicons name="chevron-down" size={20} color="#6B7280" />
            </TouchableOpacity>

            {showMethodPicker && (
              <View style={styles.pickerDropdown}>
                {paymentMethods.map(method => (
                  <TouchableOpacity
                    key={method}
                    style={[styles.pickerItem, paymentMethod === method && styles.pickerItemSelected]}
                    onPress={() => {
                      setPaymentMethod(method);
                      setShowMethodPicker(false);
                    }}
                  >
                    <Text style={[styles.pickerItemText, paymentMethod === method && styles.pickerItemTextSelected]}>
                      {method}
                    </Text>
                    {paymentMethod === method && (
                      <Ionicons name="checkmark" size={18} color={colors.primary} />
                    )}
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>

          {/* Check Number (if check selected) */}
          {paymentMethod === 'Check' && (
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Check Number</Text>
              <TextInput
                style={styles.textInput}
                value={checkNumber}
                onChangeText={setCheckNumber}
                placeholder="Enter check number"
                keyboardType="number-pad"
              />
            </View>
          )}

          {/* Date Paid */}
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Date Paid</Text>
            <View style={styles.dateDisplay}>
              <Ionicons name="calendar" size={18} color="#6B7280" />
              <Text style={styles.dateText}>{format(new Date(datePaid), 'MMMM d, yyyy')}</Text>
            </View>
          </View>
        </View>

        {/* Signature Section */}
        <View style={styles.card}>
          <SignaturePad
            onSignatureChange={setSignatureDataUrl}
            title="Homeowner Signature"
            description="By signing below, I acknowledge receipt of the above payment."
            onBegin={() => setScrollEnabled(false)}
            onEnd={() => setScrollEnabled(true)}
          />
        </View>

        {/* Amount Summary */}
        <View style={styles.summaryCard}>
          <Text style={styles.summaryLabel}>Total Amount</Text>
          <Text style={styles.summaryAmount}>${parseFloat(amount || '0').toLocaleString()}</Text>
        </View>

        {/* Generate Button */}
        <TouchableOpacity
          style={[styles.generateButton, (generating || !signatureDataUrl) && styles.generateButtonDisabled]}
          onPress={generatePDF}
          disabled={generating || !signatureDataUrl}
        >
          {generating ? (
            <ActivityIndicator size="small" color="#FFF" />
          ) : (
            <>
              <Ionicons name="document-text" size={20} color="#FFF" />
              <Text style={styles.generateButtonText}>Generate PDF Receipt</Text>
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

  card: { backgroundColor: '#FFF', margin: 16, marginBottom: 0, borderRadius: 12, padding: 16, borderWidth: 1, borderColor: '#E5E7EB' },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 16 },
  cardTitle: { fontSize: 16, fontWeight: '600', color: '#111827' },

  infoGrid: { gap: 12 },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  infoLabel: { fontSize: 13, color: '#6B7280' },
  infoValue: { fontSize: 14, color: '#111827', fontWeight: '500', flex: 1, textAlign: 'right' },
  infoValueMono: { fontSize: 14, color: '#111827', fontWeight: '500', fontFamily: 'monospace', flex: 1, textAlign: 'right' },

  inputGroup: { marginBottom: 16 },
  inputLabel: { fontSize: 13, color: '#6B7280', marginBottom: 6 },

  amountInputContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F9FAFB', borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 8, paddingHorizontal: 12 },
  currencySymbol: { fontSize: 18, fontWeight: '600', color: '#374151' },
  amountInput: { flex: 1, fontSize: 18, fontWeight: '600', color: '#111827', paddingVertical: 12, marginLeft: 4 },

  textInput: { backgroundColor: '#F9FAFB', borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 12, fontSize: 14, color: '#111827' },

  selectButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#F9FAFB', borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 12 },
  selectButtonText: { fontSize: 14, color: '#111827' },

  pickerDropdown: { marginTop: 4, backgroundColor: '#FFF', borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 8, overflow: 'hidden' },
  pickerItem: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  pickerItemSelected: { backgroundColor: 'rgba(201, 162, 77, 0.1)' },
  pickerItemText: { fontSize: 14, color: '#374151' },
  pickerItemTextSelected: { color: colors.primary, fontWeight: '500' },

  dateDisplay: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#F9FAFB', borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 12 },
  dateText: { fontSize: 14, color: '#111827' },

  summaryCard: { backgroundColor: colors.primary, margin: 16, marginBottom: 0, borderRadius: 12, padding: 20, alignItems: 'center' },
  summaryLabel: { fontSize: 14, color: 'rgba(255,255,255,0.8)', marginBottom: 4 },
  summaryAmount: { fontSize: 32, fontWeight: 'bold', color: '#FFF' },

  warningCard: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, margin: 16, marginBottom: 0, backgroundColor: 'rgba(245, 158, 11, 0.1)', padding: 16, borderRadius: 12, borderWidth: 1, borderColor: 'rgba(245, 158, 11, 0.3)' },
  warningContent: { flex: 1 },
  warningTitle: { fontSize: 14, fontWeight: '600', color: '#92400E', marginBottom: 4 },
  warningText: { fontSize: 13, color: '#92400E', lineHeight: 18 },

  generateButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, margin: 16, backgroundColor: '#22C55E', paddingVertical: 16, borderRadius: 12 },
  generateButtonDisabled: { opacity: 0.6 },
  generateButtonText: { color: '#FFF', fontSize: 16, fontWeight: '600' },

  disabledHint: { fontSize: 12, color: '#F59E0B', textAlign: 'center', marginTop: -8, marginBottom: 16 },
});
