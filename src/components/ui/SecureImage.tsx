import { useState, useEffect } from 'react';
import { getSignedFileUrl } from '@/integrations/aws/api';
import { Loader2, ImageOff, X, Download, ZoomIn } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

interface SecureImageProps {
  src: string | null | undefined;
  alt: string;
  className?: string;
  fallback?: React.ReactNode;
  onClick?: () => void;
  enablePopup?: boolean;
}

/**
 * SecureImage component that handles loading images from Wasabi
 * It automatically fetches a signed URL if needed
 */
export function SecureImage({ src, alt, className, fallback, onClick, enablePopup = true }: SecureImageProps) {
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [showPopup, setShowPopup] = useState(false);

  useEffect(() => {
    let mounted = true;

    async function loadImage() {
      if (!src) {
        setLoading(false);
        setError(true);
        return;
      }

      setLoading(true);
      setError(false);

      try {
        // If it's a data URL, use directly
        if (src.startsWith('data:')) {
          setImageUrl(src);
          setLoading(false);
          return;
        }

        // If it already has a signature, use directly
        if (src.includes('X-Amz-Signature')) {
          setImageUrl(src);
          setLoading(false);
          return;
        }

        // Get a signed URL
        const signedUrl = await getSignedFileUrl(src);
        if (mounted) {
          if (signedUrl) {
            setImageUrl(signedUrl);
          } else {
            setError(true);
          }
          setLoading(false);
        }
      } catch (e) {
        if (mounted) {
          setError(true);
          setLoading(false);
        }
      }
    }

    loadImage();

    return () => {
      mounted = false;
    };
  }, [src]);

  const handleClick = () => {
    if (onClick) {
      onClick();
    } else if (enablePopup && imageUrl) {
      setShowPopup(true);
    }
  };

  const handleDownload = async () => {
    if (!imageUrl) return;

    try {
      const response = await fetch(imageUrl);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `image-${Date.now()}.${blob.type.split('/')[1] || 'jpg'}`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (e) {
      console.error('Download failed:', e);
      // Fallback: open in new tab
      window.open(imageUrl, '_blank');
    }
  };

  if (loading) {
    return (
      <div className={cn('flex items-center justify-center bg-muted', className)}>
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error || !imageUrl) {
    if (fallback) {
      return <>{fallback}</>;
    }
    return (
      <div className={cn('flex items-center justify-center bg-muted', className)}>
        <ImageOff className="w-6 h-6 text-muted-foreground" />
      </div>
    );
  }

  return (
    <>
      <div
        className={cn('relative group cursor-pointer overflow-hidden', className)}
        onClick={handleClick}
      >
        <img
          src={imageUrl}
          alt=""
          className="w-full h-full object-cover"
          onError={() => setError(true)}
        />
        {/* Hover overlay with zoom icon */}
        {enablePopup && (
          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
            <ZoomIn className="w-6 h-6 text-white" />
          </div>
        )}
      </div>

      {/* Popup Dialog */}
      <Dialog open={showPopup} onOpenChange={setShowPopup}>
        <DialogContent className="max-w-4xl max-h-[90vh] p-0 overflow-hidden">
          <DialogTitle className="sr-only">{alt || 'Image Preview'}</DialogTitle>
          <div className="relative">
            {/* Close button */}
            <Button
              variant="ghost"
              size="icon"
              className="absolute top-2 right-2 z-10 bg-black/50 hover:bg-black/70 text-white rounded-full"
              onClick={() => setShowPopup(false)}
            >
              <X className="w-5 h-5" />
            </Button>

            {/* Download button */}
            <Button
              variant="ghost"
              size="icon"
              className="absolute top-2 right-14 z-10 bg-black/50 hover:bg-black/70 text-white rounded-full"
              onClick={handleDownload}
            >
              <Download className="w-5 h-5" />
            </Button>

            {/* Full size image */}
            <img
              src={imageUrl}
              alt={alt}
              className="w-full h-auto max-h-[85vh] object-contain"
            />
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

interface SecureDocumentLinkProps {
  src: string | null | undefined;
  children: React.ReactNode;
  className?: string;
}

/**
 * SecureDocumentLink component that handles opening documents from Wasabi
 * It fetches a signed URL and opens it in a new tab
 */
export function SecureDocumentLink({ src, children, className }: SecureDocumentLinkProps) {
  const [loading, setLoading] = useState(false);

  const handleClick = async (e: React.MouseEvent) => {
    e.preventDefault();
    if (!src) return;

    setLoading(true);
    try {
      // If it's a data URL, open directly
      if (src.startsWith('data:')) {
        window.open(src, '_blank');
        return;
      }

      // If it already has a signature, open directly
      if (src.includes('X-Amz-Signature')) {
        window.open(src, '_blank');
        return;
      }

      // Get a signed URL
      const signedUrl = await getSignedFileUrl(src);
      if (signedUrl) {
        window.open(signedUrl, '_blank');
      }
    } catch (error) {
      console.error('Error opening document:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <a
      href="#"
      onClick={handleClick}
      className={cn('inline-flex items-center gap-1', className)}
    >
      {loading && <Loader2 className="w-3 h-3 animate-spin" />}
      {children}
    </a>
  );
}
