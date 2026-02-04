import { useRef, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import SignatureScreen, { SignatureViewRef } from 'react-native-signature-canvas';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../constants/config';

interface SignaturePadProps {
  onSignatureChange: (signature: string | null) => void;
  title?: string;
  description?: string;
  onBegin?: () => void;
  onEnd?: () => void;
}

export function SignaturePad({
  onSignatureChange,
  title = 'Signature',
  description = 'Sign in the box below',
  onBegin,
  onEnd,
}: SignaturePadProps) {
  const signatureRef = useRef<SignatureViewRef>(null);
  const [hasSignature, setHasSignature] = useState(false);

  const handleSignature = (signature: string) => {
    if (signature) {
      setHasSignature(true);
      onSignatureChange(signature);
    }
  };

  const handleEmpty = () => {
    setHasSignature(false);
    onSignatureChange(null);
  };

  const handleClear = () => {
    signatureRef.current?.clearSignature();
    setHasSignature(false);
    onSignatureChange(null);
  };

  const handleEnd = () => {
    signatureRef.current?.readSignature();
    onEnd?.();
  };

  const handleBegin = () => {
    onBegin?.();
  };

  const webStyle = `
    .m-signature-pad {
      box-shadow: none;
      border: none;
      margin: 0;
      width: 100%;
      height: 100%;
    }
    .m-signature-pad--body {
      border: none;
      margin: 0;
    }
    .m-signature-pad--footer {
      display: none;
    }
    body, html {
      margin: 0;
      padding: 0;
      width: 100%;
      height: 100%;
    }
    canvas {
      width: 100%;
      height: 100%;
    }
  `;

  return (
    <View style={styles.container}>
      {title && <Text style={styles.title}>{title}</Text>}
      {description && <Text style={styles.description}>{description}</Text>}

      <View style={styles.signatureContainer}>
        <SignatureScreen
          ref={signatureRef}
          onOK={handleSignature}
          onEmpty={handleEmpty}
          onEnd={handleEnd}
          onBegin={handleBegin}
          webStyle={webStyle}
          backgroundColor="white"
          penColor="black"
          minWidth={2}
          maxWidth={3}
          dotSize={2}
          trimWhitespace={true}
          autoClear={false}
          descriptionText=""
        />

        {!hasSignature && (
          <View style={styles.placeholder} pointerEvents="none">
            <Ionicons name="pencil" size={24} color={colors.mutedForeground} />
            <Text style={styles.placeholderText}>Sign here</Text>
          </View>
        )}
      </View>

      <View style={styles.footer}>
        {hasSignature && (
          <View style={styles.signedIndicator}>
            <Ionicons name="checkmark-circle" size={18} color={colors.success} />
            <Text style={styles.signedText}>Signature captured</Text>
          </View>
        )}

        <TouchableOpacity
          style={styles.clearButton}
          onPress={handleClear}
          disabled={!hasSignature}
        >
          <Ionicons
            name="trash-outline"
            size={18}
            color={hasSignature ? colors.mutedForeground : colors.border}
          />
          <Text style={[
            styles.clearButtonText,
            !hasSignature && styles.clearButtonDisabled
          ]}>
            Clear
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.foreground,
    marginBottom: 4,
  },
  description: {
    fontSize: 13,
    color: colors.mutedForeground,
    marginBottom: 12,
  },
  signatureContainer: {
    height: 150,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: colors.border,
    borderRadius: 12,
    backgroundColor: colors.background,
    overflow: 'hidden',
    position: 'relative',
  },
  placeholder: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  placeholderText: {
    fontSize: 14,
    color: colors.mutedForeground,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
    minHeight: 32,
  },
  signedIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  signedText: {
    fontSize: 13,
    color: colors.success,
    fontWeight: '500',
  },
  clearButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 6,
    paddingHorizontal: 10,
    marginLeft: 'auto',
  },
  clearButtonText: {
    fontSize: 13,
    color: colors.mutedForeground,
  },
  clearButtonDisabled: {
    color: colors.border,
  },
});
