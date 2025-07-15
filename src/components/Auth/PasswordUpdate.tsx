'use client';

import { useState } from 'react';
import { useUpdatePasswordMutation } from '@/hooks/queries';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Eye, EyeOff, Lock, Shield } from 'lucide-react';

interface PasswordUpdateProps {
  onSuccess?: () => void;
  onCancel?: () => void;
}

export default function PasswordUpdate({ onSuccess, onCancel }: PasswordUpdateProps) {
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const updatePasswordMutation = useUpdatePasswordMutation();

  const validatePassword = (password: string) => {
    const errors = [];
    if (password.length < 8) {
      errors.push('Password must be at least 8 characters long');
    }
    if (!/[A-Z]/.test(password)) {
      errors.push('Password must contain at least one uppercase letter');
    }
    if (!/[a-z]/.test(password)) {
      errors.push('Password must contain at least one lowercase letter');
    }
    if (!/[0-9]/.test(password)) {
      errors.push('Password must contain at least one number');
    }
    return errors;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setMessage('');

    try {
      // Validate password strength
      const validationErrors = validatePassword(newPassword);
      if (validationErrors.length > 0) {
        setError(validationErrors.join('. '));
        return;
      }

      // Check if passwords match
      if (newPassword !== confirmPassword) {
        setError('Passwords do not match');
        return;
      }

      // Update password using TanStack Query mutation
      await updatePasswordMutation.mutateAsync(newPassword);
      
      setMessage('Password updated successfully!');
      setNewPassword('');
      setConfirmPassword('');
      if (onSuccess) {
        setTimeout(onSuccess, 2000); // Give user time to see success message
      }
    } catch (err: any) {
      setError(err?.message || 'An unexpected error occurred. Please try again.');
    }
  };

  const getPasswordStrength = (password: string) => {
    const errors = validatePassword(password);
    if (password.length === 0) return { strength: 0, label: '', color: '' };
    if (errors.length >= 3) return { strength: 25, label: 'Weak', color: 'bg-red-500' };
    if (errors.length === 2) return { strength: 50, label: 'Fair', color: 'bg-yellow-500' };
    if (errors.length === 1) return { strength: 75, label: 'Good', color: 'bg-blue-500' };
    return { strength: 100, label: 'Strong', color: 'bg-green-500' };
  };

  const passwordStrength = getPasswordStrength(newPassword);

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Shield className="w-5 h-5" />
          Update Password
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* New Password */}
          <div className="space-y-2">
            <label className="text-sm font-medium">New Password</label>
            <div className="relative">
              <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <input
                type={showPassword ? 'text' : 'password'}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Enter new password"
                className="w-full pl-10 pr-10 py-2 border border-border rounded-lg bg-background text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-3 text-muted-foreground hover:text-foreground"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            
            {/* Password Strength Indicator */}
            {newPassword && (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Password strength:</span>
                  <span className={`font-medium ${
                    passwordStrength.strength >= 75 ? 'text-green-600' :
                    passwordStrength.strength >= 50 ? 'text-blue-600' :
                    passwordStrength.strength >= 25 ? 'text-yellow-600' :
                    'text-red-600'
                  }`}>
                    {passwordStrength.label}
                  </span>
                </div>
                <div className="w-full bg-secondary rounded-full h-2">
                  <div 
                    className={`h-2 rounded-full transition-all duration-300 ${passwordStrength.color}`}
                    style={{ width: `${passwordStrength.strength}%` }}
                  />
                </div>
              </div>
            )}
          </div>

          {/* Confirm Password */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Confirm New Password</label>
            <div className="relative">
              <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <input
                type={showConfirmPassword ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Confirm new password"
                className="w-full pl-10 pr-10 py-2 border border-border rounded-lg bg-background text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent"
                required
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className="absolute right-3 top-3 text-muted-foreground hover:text-foreground"
              >
                {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            {confirmPassword && newPassword !== confirmPassword && (
              <p className="text-sm text-red-600">Passwords do not match</p>
            )}
          </div>

          {/* Error Message */}
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-600">{error}</p>
            </div>
          )}

          {/* Success Message */}
          {message && (
            <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
              <p className="text-sm text-green-600">{message}</p>
            </div>
          )}

          {/* Password Requirements */}
          <div className="text-xs text-muted-foreground space-y-1">
            <p className="font-medium">Password requirements:</p>
            <ul className="ml-2 space-y-1">
              <li className={`flex items-center gap-1 ${newPassword.length >= 8 ? 'text-green-600' : ''}`}>
                <span className="w-1 h-1 bg-current rounded-full" />
                At least 8 characters
              </li>
              <li className={`flex items-center gap-1 ${/[A-Z]/.test(newPassword) ? 'text-green-600' : ''}`}>
                <span className="w-1 h-1 bg-current rounded-full" />
                One uppercase letter
              </li>
              <li className={`flex items-center gap-1 ${/[a-z]/.test(newPassword) ? 'text-green-600' : ''}`}>
                <span className="w-1 h-1 bg-current rounded-full" />
                One lowercase letter
              </li>
              <li className={`flex items-center gap-1 ${/[0-9]/.test(newPassword) ? 'text-green-600' : ''}`}>
                <span className="w-1 h-1 bg-current rounded-full" />
                One number
              </li>
            </ul>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3 pt-4">
            <Button
              type="submit"
              disabled={updatePasswordMutation.isPending || !newPassword || !confirmPassword || newPassword !== confirmPassword}
              className="flex-1"
            >
              {updatePasswordMutation.isPending ? 'Updating...' : 'Update Password'}
            </Button>
            {onCancel && (
              <Button
                type="button"
                variant="outline"
                onClick={onCancel}
                disabled={updatePasswordMutation.isPending}
                className="flex-1"
              >
                Cancel
              </Button>
            )}
          </div>
        </form>
      </CardContent>
    </Card>
  );
}