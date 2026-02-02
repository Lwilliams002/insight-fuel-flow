import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { Upload, Loader2, X, FileText } from 'lucide-react';
import { cn } from '@/lib/utils';
import { getIdToken } from '@/integrations/aws/auth';
import { awsConfig } from '@/integrations/aws/config';
import { SecureImage } from '@/components/ui/SecureImage';

interface FileUploadProps {
  onUpload: (url: string, key: string) => void;
  onRemove?: (url: string) => void;
  accept?: string;
  multiple?: boolean;
  maxSizeMB?: number;
  category: string;
  dealId?: string;
  pinId?: string;
  existingFiles?: string[];
  label?: string;
  className?: string;
  buttonVariant?: 'default' | 'outline' | 'secondary' | 'ghost';
}

export function FileUpload({
  onUpload,
  onRemove,
  accept = '*/*',
  multiple = false,
  maxSizeMB = 5, // Reduced to 5MB for base64 encoding (actual limit is ~3.5MB after encoding)
  category,
  dealId,
  pinId,
  existingFiles = [],
  label = 'Upload File',
  className,
  buttonVariant = 'outline',
}: FileUploadProps) {
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<Record<string, number>>({});
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const filesToUpload = Array.from(files);

    // Validate file sizes
    for (const file of filesToUpload) {
      if (file.size > maxSizeMB * 1024 * 1024) {
        toast.error(`${file.name} exceeds ${maxSizeMB}MB limit`);
        return;
      }
    }

    setUploading(true);

    try {
      for (const file of filesToUpload) {
        await uploadFile(file);
      }
    } finally {
      setUploading(false);
      if (inputRef.current) {
        inputRef.current.value = '';
      }
    }
  };

  // Convert file to base64
  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => {
        const base64 = reader.result as string;
        // Remove the data URL prefix (e.g., "data:image/png;base64,")
        const base64Data = base64.split(',')[1];
        resolve(base64Data);
      };
      reader.onerror = (error) => reject(error);
    });
  };

  const uploadFile = async (file: File) => {
    const fileName = file.name;
    setUploadProgress(prev => ({ ...prev, [fileName]: 0 }));

    try {
      // Check if API is configured
      if (!awsConfig.api.baseUrl) {
        throw new Error('API not configured. Please check your environment settings.');
      }

      // Get auth token
      const token = await getIdToken();
      if (!token) {
        throw new Error('Authentication required. Please log in again.');
      }

      // Build folder path
      let folder = category;
      if (dealId) folder = `deals/${dealId}/${category}`;
      else if (pinId) folder = `pins/${pinId}/${category}`;

      const timestamp = Date.now();
      const sanitizedFileName = fileName.replace(/[^a-zA-Z0-9.-]/g, '_');
      const key = `${folder}/${timestamp}-${sanitizedFileName}`;

      setUploadProgress(prev => ({ ...prev, [fileName]: 20 }));

      // Convert file to base64
      const fileData = await fileToBase64(file);

      setUploadProgress(prev => ({ ...prev, [fileName]: 50 }));

      console.log('Uploading to:', `${awsConfig.api.baseUrl}/upload`);
      console.log('Key:', key);
      console.log('File size:', file.size, 'bytes');

      // Upload via backend API (which handles Wasabi upload)
      const response = await fetch(`${awsConfig.api.baseUrl}/upload`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          key,
          fileData,
          fileType: file.type || 'application/octet-stream',
          fileName: sanitizedFileName,
        }),
      });

      if (!response.ok) {
        let errorMessage = `HTTP ${response.status}`;
        try {
          const errorData = await response.json();
          errorMessage = errorData.error || errorData.message || errorMessage;
        } catch {
          errorMessage = await response.text() || errorMessage;
        }
        console.error('Upload error response:', errorMessage);
        throw new Error(errorMessage);
      }

      const result = await response.json();
      const publicUrl = result.url || result.publicUrl || `https://s3.us-central-1.wasabisys.com/titanprime/${key}`;

      setUploadProgress(prev => ({ ...prev, [fileName]: 100 }));

      // Notify parent of successful upload
      onUpload(publicUrl, key);
      toast.success(`${fileName} uploaded successfully`);

      // Clean up progress after a delay
      setTimeout(() => {
        setUploadProgress(prev => {
          const newProgress = { ...prev };
          delete newProgress[fileName];
          return newProgress;
        });
      }, 1000);

    } catch (error) {
      console.error('Upload error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      toast.error(`Failed to upload ${fileName}: ${errorMessage}`);
      setUploadProgress(prev => {
        const newProgress = { ...prev };
        delete newProgress[fileName];
        return newProgress;
      });
    }
  };

  const handleRemove = (url: string) => {
    if (onRemove) {
      onRemove(url);
    }
  };

  const isImage = (url: string) => {
    return /\.(jpg|jpeg|png|gif|webp)$/i.test(url);
  };

  return (
    <div className={cn('space-y-3', className)}>
      {/* Existing files display */}
      {existingFiles.length > 0 && (
        <div className="grid grid-cols-3 gap-2">
          {existingFiles.map((url, idx) => (
            <div key={idx} className="relative group">
              {isImage(url) ? (
                <SecureImage
                  src={url}
                  alt=""
                  className="w-full h-20 object-cover rounded-lg border"
                  enablePopup={true}
                />
              ) : (
                <div className="w-full h-20 flex items-center justify-center bg-muted rounded-lg border">
                  <FileText className="w-8 h-8 text-muted-foreground" />
                </div>
              )}
              {onRemove && (
                <button
                  onClick={() => handleRemove(url)}
                  className="absolute top-1 right-1 bg-destructive text-destructive-foreground rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Upload progress */}
      {Object.entries(uploadProgress).map(([fileName, progress]) => (
        <div key={fileName} className="flex items-center gap-2 p-2 bg-muted rounded-lg">
          <Loader2 className="w-4 h-4 animate-spin text-primary" />
          <span className="text-sm flex-1 truncate">{fileName}</span>
          <span className="text-xs text-muted-foreground">{progress}%</span>
        </div>
      ))}

      {/* Upload button */}
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        multiple={multiple}
        className="hidden"
        onChange={handleFileSelect}
      />
      <Button
        variant={buttonVariant}
        className="w-full gap-2"
        onClick={() => inputRef.current?.click()}
        disabled={uploading}
      >
        {uploading ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : (
          <Upload className="w-4 h-4" />
        )}
        {label}
      </Button>
    </div>
  );
}

/**
 * Image-specific upload component with preview
 */
interface ImageUploadProps extends Omit<FileUploadProps, 'accept'> {
  maxImages?: number;
}

export function ImageUpload({ maxImages = 10, ...props }: ImageUploadProps) {
  const canUploadMore = !props.existingFiles || props.existingFiles.length < maxImages;

  return (
    <FileUpload
      {...props}
      accept="image/*"
      multiple
      label={props.label || 'Add Photos'}
      className={cn(!canUploadMore && 'opacity-50 pointer-events-none', props.className)}
    />
  );
}

/**
 * Document upload component
 */
export function DocumentUpload(props: Omit<FileUploadProps, 'accept' | 'multiple'>) {
  return (
    <FileUpload
      {...props}
      accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
      multiple={false}
      label={props.label || 'Upload Document'}
    />
  );
}
