import { RepLayout } from '@/components/RepLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useState } from 'react';
import { AlertCircle } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

export default function RepJotForm() {
  // You can set a default JotForm URL here or let admins configure it
  const [jotFormUrl, setJotFormUrl] = useState('');
  const defaultPlaceholder = 'https://form.jotform.com/YOUR_FORM_ID';

  return (
    <RepLayout title="Submit New Deal">
      <div className="p-4 space-y-4">
        {!jotFormUrl ? (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">JotForm Configuration</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  Enter your JotForm URL to embed the deal submission form.
                </AlertDescription>
              </Alert>
              
              <div className="space-y-2">
                <Label htmlFor="jotform-url">JotForm Embed URL</Label>
                <Input
                  id="jotform-url"
                  placeholder={defaultPlaceholder}
                  value={jotFormUrl}
                  onChange={(e) => setJotFormUrl(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  Paste your JotForm URL here. It should look like: https://form.jotform.com/123456789
                </p>
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="h-[calc(100vh-180px)] rounded-lg overflow-hidden border bg-background">
            <iframe
              src={jotFormUrl}
              title="Deal Submission Form"
              className="w-full h-full border-0"
              allow="geolocation; microphone; camera"
              allowFullScreen
            />
          </div>
        )}

        {jotFormUrl && (
          <button
            onClick={() => setJotFormUrl('')}
            className="text-sm text-muted-foreground underline"
          >
            Change JotForm URL
          </button>
        )}
      </div>
    </RepLayout>
  );
}
