import * as FileSystem from 'expo-file-system';
import { Asset } from 'expo-asset';

// Cache the logo base64 to avoid reloading
let cachedLogoBase64: string | null = null;

/**
 * Load the company logo as a base64 data URL for use in PDF generation
 */
export async function getLogoBase64(): Promise<string> {
  if (cachedLogoBase64) {
    return cachedLogoBase64;
  }

  try {
    // Load the logo asset
    const asset = Asset.fromModule(require('../../assets/logo.png'));
    await asset.downloadAsync();

    if (asset.localUri) {
      const base64 = await FileSystem.readAsStringAsync(asset.localUri, {
        encoding: FileSystem.EncodingType.Base64,
      });
      cachedLogoBase64 = `data:image/png;base64,${base64}`;
      return cachedLogoBase64;
    }
  } catch (error) {
    console.error('Failed to load logo:', error);
  }

  // Return empty string if logo couldn't be loaded
  return '';
}

// Company branding constants
export const companyBranding = {
  name: 'TITAN PRIME SOLUTIONS',
  tagline: 'Professional Roofing & Construction',
  colors: {
    primary: '#C9A24D',
    secondary: '#0F1E2E',
  },
};
