import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { AdminLayout } from '@/components/AdminLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, Settings, FileWarning } from 'lucide-react';

export default function AdminJotForm() {
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
      <AdminLayout title="Submit New Deal">
        <div className="flex items-center justify-center h-[60vh]">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </AdminLayout>
    );
  }

  if (!jotFormUrl) {
    return (
      <AdminLayout title="Submit New Deal">
        <div className="p-4">
          <Card className="max-w-md mx-auto">
            <CardHeader className="text-center">
              <div className="mx-auto mb-4 h-12 w-12 rounded-full bg-muted flex items-center justify-center">
                <FileWarning className="h-6 w-6 text-muted-foreground" />
              </div>
              <CardTitle>Form Not Configured</CardTitle>
            </CardHeader>
            <CardContent className="text-center space-y-4">
              <p className="text-muted-foreground">
                Configure your JotForm URL in settings to enable deal submissions.
              </p>
              <Link to="/admin/settings">
                <Button>
                  <Settings className="h-4 w-4 mr-2" />
                  Go to Settings
                </Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout title="Submit New Deal">
      <div className="space-y-4">
        <div className="flex justify-end">
          <Link to="/admin/settings">
            <Button variant="outline" size="sm">
              <Settings className="h-4 w-4 mr-2" />
              Configure Form
            </Button>
          </Link>
        </div>
        <div className="h-[calc(100vh-180px)] rounded-lg overflow-hidden border border-border bg-card">
          <iframe
            src={jotFormUrl}
            title="Deal Submission Form"
            className="w-full h-full border-0"
            allow="geolocation; microphone; camera"
            allowFullScreen
          />
        </div>
      </div>
    </AdminLayout>
  );
}
