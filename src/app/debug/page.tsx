'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuth } from '@/contexts/auth';
import { Copy, Check } from 'lucide-react';
import { supabase } from '@/lib/supabase';

export default function DebugPage() {
  const { user } = useAuth();
  const [debugData, setDebugData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  const fetchDebugData = async () => {
    setLoading(true);
    try {
      // Get the current session
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        setDebugData({ error: 'No active session', note: 'Please log in first' });
        setLoading(false);
        return;
      }

      const response = await fetch('/api/debug-auth', {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
      });
      const data = await response.json();
      setDebugData(data);
    } catch (error) {
      setDebugData({ error: 'Failed to fetch debug data', details: error });
    }
    setLoading(false);
  };

  const copyDebugData = async () => {
    if (!debugData) return;
    
    try {
      const debugText = JSON.stringify(debugData, null, 2);
      await navigator.clipboard.writeText(debugText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error('Failed to copy:', error);
    }
  };

  return (
    <div className="min-h-screen bg-background p-4">
      <div className="max-w-4xl mx-auto space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Auth Debug Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <h3 className="font-semibold mb-2">Current User (from context):</h3>
              <pre className="bg-muted p-3 rounded text-xs overflow-auto">
                {user ? JSON.stringify({ id: user.id, email: user.email }, null, 2) : 'Not logged in'}
              </pre>
            </div>

            <Button onClick={fetchDebugData} disabled={loading}>
              {loading ? 'Loading...' : 'Fetch Debug Data'}
            </Button>

            {debugData && (
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-semibold">Debug Data:</h3>
                  <Button
                    onClick={copyDebugData}
                    variant="outline"
                    size="sm"
                    className="h-8"
                  >
                    {copied ? (
                      <>
                        <Check className="w-4 h-4 mr-1" />
                        Copied!
                      </>
                    ) : (
                      <>
                        <Copy className="w-4 h-4 mr-1" />
                        Copy
                      </>
                    )}
                  </Button>
                </div>
                <pre className="bg-muted p-3 rounded text-xs overflow-auto max-h-96">
                  {JSON.stringify(debugData, null, 2)}
                </pre>
              </div>
            )}

            <div className="mt-6 p-4 bg-yellow-50 border border-yellow-200 rounded">
              <p className="text-sm text-yellow-800">
                <strong>Expected for Superuser Access:</strong>
              </p>
              <ul className="list-disc list-inside text-sm text-yellow-700 mt-2">
                <li>Email should be: mohiuddin.007@gmail.com</li>
                <li>Profile role should be: superuser</li>
                <li>isAdmin check should return: true</li>
                <li>isSuperuser check should return: true</li>
              </ul>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}