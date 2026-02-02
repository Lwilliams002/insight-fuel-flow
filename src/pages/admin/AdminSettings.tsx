import { useState, useEffect } from 'react';
import { AdminLayout } from '@/components/AdminLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { supabase } from '@/integrations/supabase/client';
import { adminApi } from '@/integrations/aws/api';
import { toast } from 'sonner';
import { Loader2, Save, ExternalLink, CheckCircle, Database, AlertCircle } from 'lucide-react';

export default function AdminSettings() {
  const [jotFormUrl, setJotFormUrl] = useState('');
  const [originalUrl, setOriginalUrl] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [migrating, setMigrating] = useState(false);
  const [migrationResults, setMigrationResults] = useState<string[]>([]);

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('app_settings')
      .select('value')
      .eq('key', 'jotform_url')
      .single();

    if (error && error.code !== 'PGRST116') {
      console.error('Error fetching settings:', error);
      toast.error('Failed to load settings');
    } else if (data) {
      setJotFormUrl(data.value || '');
      setOriginalUrl(data.value || '');
    }
    setLoading(false);
  };

  const handleSave = async () => {
    setSaving(true);
    const { error } = await supabase
      .from('app_settings')
      .update({ value: jotFormUrl })
      .eq('key', 'jotform_url');

    if (error) {
      console.error('Error saving settings:', error);
      toast.error('Failed to save settings');
    } else {
      setOriginalUrl(jotFormUrl);
      toast.success('JotForm URL saved successfully');
    }
    setSaving(false);
  };

  const hasChanges = jotFormUrl !== originalUrl;
  const isValidUrl = jotFormUrl === '' || jotFormUrl.includes('jotform.com');

  const handleRunMigration = async () => {
    setMigrating(true);
    setMigrationResults([]);
    try {
      const response = await adminApi.runMigration();
      if (response.error) {
        toast.error('Migration failed: ' + response.error);
        setMigrationResults(['Error: ' + response.error]);
      } else if (response.data?.success) {
        toast.success('Database migration completed successfully!');
        setMigrationResults([response.data.message || 'Migration completed successfully']);
      } else {
        toast.error('Migration failed');
        setMigrationResults(['Migration may have failed - check console']);
      }
    } catch (error) {
      toast.error('Migration failed');
      setMigrationResults(['Error: ' + (error instanceof Error ? error.message : 'Unknown error')]);
    }
    setMigrating(false);
  };

  if (loading) {
    return (
      <AdminLayout title="Settings">
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout title="Settings">
      <div className="space-y-6 max-w-2xl">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              JotForm Integration
            </CardTitle>
            <CardDescription>
              Configure the JotForm URL for deal submissions. This form will be embedded for sales reps to submit new deals.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="jotform-url">JotForm URL</Label>
              <Input
                id="jotform-url"
                placeholder="https://form.jotform.com/YOUR_FORM_ID"
                value={jotFormUrl}
                onChange={(e) => setJotFormUrl(e.target.value)}
                className="font-mono text-sm"
              />
              <p className="text-xs text-muted-foreground">
                Enter the full URL of your JotForm. It should look like: https://form.jotform.com/123456789
              </p>
            </div>

            {!isValidUrl && (
              <Alert variant="destructive">
                <AlertDescription>
                  Please enter a valid JotForm URL (must contain jotform.com)
                </AlertDescription>
              </Alert>
            )}

            {jotFormUrl && isValidUrl && (
              <Alert>
                <CheckCircle className="h-4 w-4 text-primary" />
                <AlertDescription className="flex items-center justify-between">
                  <span>Form configured and ready for use</span>
                  <a
                    href={jotFormUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-primary hover:underline text-sm"
                  >
                    Preview <ExternalLink className="h-3 w-3" />
                  </a>
                </AlertDescription>
              </Alert>
            )}

            <div className="flex justify-end pt-2">
              <Button
                onClick={handleSave}
                disabled={!hasChanges || !isValidUrl || saving}
              >
                {saving ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <Save className="h-4 w-4 mr-2" />
                )}
                Save Changes
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Recommended JotForm Fields</CardTitle>
            <CardDescription>
              Your JotForm should collect the following information for seamless CRM integration:
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm text-muted-foreground">
              <li className="flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                Homeowner name
              </li>
              <li className="flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                Homeowner phone
              </li>
              <li className="flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                Homeowner email
              </li>
              <li className="flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                Property address
              </li>
              <li className="flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                Total job price
              </li>
              <li className="flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                Commission type (Setter/Closer/Self-Gen)
              </li>
              <li className="flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                Rep name/ID
              </li>
              <li className="flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                Notes/Comments
              </li>
            </ul>
          </CardContent>
        </Card>

        {/* Database Migration Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Database className="h-5 w-5" />
              Database Migration
            </CardTitle>
            <CardDescription>
              Run database migrations to update tables with new fields. This is safe to run multiple times.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                This will add any missing columns to your database tables. Existing data will not be affected.
              </AlertDescription>
            </Alert>

            <Button
              onClick={handleRunMigration}
              disabled={migrating}
              variant="outline"
              className="w-full"
            >
              {migrating ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Running Migration...
                </>
              ) : (
                <>
                  <Database className="h-4 w-4 mr-2" />
                  Run Database Migration
                </>
              )}
            </Button>

            {migrationResults.length > 0 && (
              <div className="bg-muted p-3 rounded-lg max-h-48 overflow-y-auto">
                <p className="text-xs font-semibold mb-2">Migration Results:</p>
                <ul className="text-xs space-y-1 font-mono">
                  {migrationResults.map((result, index) => (
                    <li key={index} className={result.startsWith('Error') ? 'text-destructive' : 'text-muted-foreground'}>
                      {result}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}
