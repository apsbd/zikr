'use client';

import { useState } from 'react';
import { useAuth } from '@/contexts/auth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { User, Shield, X, Check } from 'lucide-react';
import PasswordUpdate from './PasswordUpdate';

interface UserSettingsProps {
  onClose?: () => void;
}

type SettingsTab = 'profile' | 'password';

export default function UserSettings({ onClose }: UserSettingsProps) {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<SettingsTab>('profile');
  const [passwordUpdateSuccess, setPasswordUpdateSuccess] = useState(false);

  const handlePasswordUpdateSuccess = () => {
    setPasswordUpdateSuccess(true);
    setTimeout(() => {
      setPasswordUpdateSuccess(false);
    }, 3000);
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