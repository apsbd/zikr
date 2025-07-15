'use client';

import { useState } from 'react';
import { useAuth } from '@/contexts/auth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { User, Shield, X, Check, RefreshCw, Database, AlertTriangle } from 'lucide-react';
import PasswordUpdate from './PasswordUpdate';
import { syncManager } from '@/lib/sync-manager';
import { localStorageService } from '@/lib/local-storage';

interface UserSettingsProps {
  onClose?: () => void;
}

type SettingsTab = 'profile' | 'password' | 'sync';

export default function UserSettings({ onClose }: UserSettingsProps) {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<SettingsTab>('profile');
  const [passwordUpdateSuccess, setPasswordUpdateSuccess] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncSuccess, setSyncSuccess] = useState(false);

  const handlePasswordUpdateSuccess = () => {
    setPasswordUpdateSuccess(true);
    setTimeout(() => {
      setPasswordUpdateSuccess(false);
    }, 3000);
  };

  // Push progress then pull fresh data
  const handlePushThenPull = async () => {
    if (!user) return;
    setIsSyncing(true);
    try {
      await syncManager.pushThenPull(user.id);
      setSyncSuccess(true);
      setTimeout(() => setSyncSuccess(false), 3000);
      
      // Dispatch event to refresh dashboard
      window.dispatchEvent(new CustomEvent('data-updated'));
    } catch (err) {
      // Error handled by sync manager events
    } finally {
      setIsSyncing(false);
    }
  };

  // Force full resync
  const handleForceFullResync = async () => {
    if (!user) return;
    setIsSyncing(true);
    try {
      await syncManager.forceFullSync(user.id);
      setSyncSuccess(true);
      setTimeout(() => setSyncSuccess(false), 3000);
      
      // Dispatch event to refresh dashboard
      window.dispatchEvent(new CustomEvent('data-updated'));
    } catch (err) {
      // Error handled by sync manager events
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-background border border-border rounded-lg shadow-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-border">
          <h2 className="text-xl font-semibold">User Settings</h2>
          {onClose && (
            <Button variant="ghost" size="sm" onClick={onClose}>
              <X className="w-4 h-4" />
            </Button>
          )}
        </div>

        {/* Navigation Tabs */}
        <div className="flex border-b border-border">
          <button
            onClick={() => setActiveTab('profile')}
            className={`flex items-center gap-2 px-6 py-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'profile'
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            <User className="w-4 h-4" />
            Profile
          </button>
          <button
            onClick={() => setActiveTab('password')}
            className={`flex items-center gap-2 px-6 py-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'password'
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            <Shield className="w-4 h-4" />
            Password
          </button>
          <button
            onClick={() => setActiveTab('sync')}
            className={`flex items-center gap-2 px-6 py-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'sync'
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            <Database className="w-4 h-4" />
            Data Sync
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {activeTab === 'profile' && (
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <User className="w-5 h-5" />
                    Profile Information
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">
                      Email Address
                    </label>
                    <p className="text-foreground font-medium">{user?.email}</p>
                  </div>
                  
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">
                      Account Created
                    </label>
                    <p className="text-foreground">
                      {user?.created_at ? new Date(user.created_at).toLocaleDateString() : 'N/A'}
                    </p>
                  </div>

                  <div>
                    <label className="text-sm font-medium text-muted-foreground">
                      Last Sign In
                    </label>
                    <p className="text-foreground">
                      {user?.last_sign_in_at ? new Date(user.last_sign_in_at).toLocaleDateString() : 'N/A'}
                    </p>
                  </div>

                  <div className="pt-4 border-t border-border">
                    <p className="text-sm text-muted-foreground">
                      Your account is secured with Supabase authentication. 
                      Email verification is required for account recovery.
                    </p>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {activeTab === 'password' && (
            <div className="space-y-6">
              {passwordUpdateSuccess && (
                <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                  <div className="flex items-center gap-2">
                    <Check className="w-5 h-5 text-green-600" />
                    <p className="text-sm text-green-600 font-medium">
                      Password updated successfully!
                    </p>
                  </div>
                  <p className="text-sm text-green-600 mt-1">
                    Your password has been changed. You may need to sign in again on other devices.
                  </p>
                </div>
              )}

              <div className="flex justify-center">
                <PasswordUpdate 
                  onSuccess={handlePasswordUpdateSuccess}
                  onCancel={() => setActiveTab('profile')}
                />
              </div>

              <div className="text-center">
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <p className="text-sm text-blue-600">
                    <strong>Security Note:</strong> Changing your password will not sign you out of this device, 
                    but you may need to sign in again on other devices.
                  </p>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'sync' && (
            <div className="space-y-6">
              {syncSuccess && (
                <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                  <div className="flex items-center gap-2">
                    <Check className="w-5 h-5 text-green-600" />
                    <p className="text-sm text-green-600 font-medium">
                      Sync completed successfully!
                    </p>
                  </div>
                  <p className="text-sm text-green-600 mt-1">
                    Your data has been synchronized with the server.
                  </p>
                </div>
              )}

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <RefreshCw className="w-5 h-5" />
                    Smart Sync
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-sm text-muted-foreground">
                    Synchronizes your study progress with the server and downloads any new content.
                  </p>
                  
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <h4 className="text-sm font-semibold text-blue-800 mb-2">What Smart Sync does:</h4>
                    <ul className="text-sm text-blue-700 space-y-1">
                      <li>• Uploads your study progress to the server</li>
                      <li>• Downloads new decks and cards</li>
                      <li>• Updates existing content</li>
                      <li>• Preserves your local progress</li>
                      <li>• Maintains offline functionality</li>
                    </ul>
                  </div>

                  <Button 
                    onClick={handlePushThenPull}
                    disabled={isSyncing}
                    className="w-full"
                  >
                    {isSyncing ? (
                      <>
                        <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                        Syncing...
                      </>
                    ) : (
                      <>
                        <RefreshCw className="w-4 h-4 mr-2" />
                        Sync Now
                      </>
                    )}
                  </Button>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <AlertTriangle className="w-5 h-5 text-orange-500" />
                    Full Reset & Sync
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-sm text-muted-foreground">
                    Clears all local data and re-downloads everything from the server. Use only if you're experiencing data issues.
                  </p>
                  
                  <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
                    <h4 className="text-sm font-semibold text-orange-800 mb-2">⚠️ Warning:</h4>
                    <ul className="text-sm text-orange-700 space-y-1">
                      <li>• This will clear ALL local data</li>
                      <li>• Unsaved progress will be lost</li>
                      <li>• Only use if experiencing sync issues</li>
                      <li>• The app will work offline after reset</li>
                    </ul>
                  </div>

                  <Button 
                    onClick={handleForceFullResync}
                    disabled={isSyncing}
                    variant="destructive"
                    className="w-full"
                  >
                    {isSyncing ? (
                      <>
                        <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                        Resetting...
                      </>
                    ) : (
                      <>
                        <AlertTriangle className="w-4 h-4 mr-2" />
                        Reset & Re-sync All Data
                      </>
                    )}
                  </Button>
                </CardContent>
              </Card>

              <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                <h4 className="text-sm font-semibold text-gray-800 mb-2">How Data Sync Works</h4>
                <p className="text-sm text-gray-600 mb-3">
                  This app works offline-first. All your study sessions happen locally for maximum speed and reliability.
                </p>
                <ul className="text-sm text-gray-600 space-y-1">
                  <li>• <strong>Automatic sync:</strong> Happens every 30 minutes in the background</li>
                  <li>• <strong>Manual sync:</strong> Use "Sync Now" to sync immediately</li>
                  <li>• <strong>Offline mode:</strong> Continue studying even without internet</li>
                  <li>• <strong>Data safety:</strong> Your progress is automatically backed up</li>
                </ul>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 p-6 border-t border-border">
          {onClose && (
            <Button variant="outline" onClick={onClose}>
              Close
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}