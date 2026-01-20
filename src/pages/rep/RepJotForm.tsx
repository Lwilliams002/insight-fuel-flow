import { useState, useEffect } from 'react';
import { RepLayout } from '@/components/RepLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, FileWarning } from 'lucide-react';

export default function RepJotForm() {
  const [jotFormUrl, setJotFormUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchJotFormUrl();
  }, []);

  const fetchJotFormUrl = async () => {
    const { data, error } = await supabase
      .from('app_settings')
      .select('value')
      .eq('key', 'jotform_url')
      .single();

    if (error && error.code !== 'PGRST116') {
      console.error('Error fetching JotForm URL:', error);
    }
    
    setJotFormUrl(data?.value || '');
    setLoading(false);
  };

  if (loading) {
    return (
      <RepLayout title="Submit New Deal">
        <div className="flex items-center justify-center h-[60vh]">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </RepLayout>
    );
  }

  if (!jotFormUrl) {
    return (
      <RepLayout title="Submit New Deal">
        <div className="p-4">
          <Card className="max-w-md mx-auto">
            <CardHeader className="text-center">
              <div className="mx-auto mb-4 h-12 w-12 rounded-full bg-muted flex items-center justify-center">
                <FileWarning className="h-6 w-6 text-muted-foreground" />
              </div>
              <CardTitle>Form Not Configured</CardTitle>
            </CardHeader>
            <CardContent className="text-center text-muted-foreground">
              <p>The deal submission form hasn't been set up yet.</p>
              <p className="mt-2">Please contact your administrator to configure the form.</p>
            </CardContent>
          </Card>
        </div>
      </RepLayout>
    );
  }

  return (
    <RepLayout title="Submit New Deal">
      <div className="h-[calc(100vh-140px)] bg-card">
        <iframe
          src={jotFormUrl}
          title="Deal Submission Form"
          className="w-full h-full border-0"
          allow="geolocation; microphone; camera"
          allowFullScreen
        />
      </div>
    </RepLayout>
  );
}
