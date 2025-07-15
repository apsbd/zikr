'use client';

import { useAuth } from '@/contexts/auth';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

export default function UserProfile() {
  const { user, signOut } = useAuth();

  const handleSignOut = async () => {
    try {
      await signOut();
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  if (!user) return null;

  return (
    <Card className="p-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-muted-foreground">Signed in as</p>
          <p className="font-medium text-foreground">{user.email}</p>
        </div>
        <Button 
          variant="outline" 
          size="sm" 
          onClick={handleSignOut}
        >
          Sign Out
        </Button>
      </div>
    </Card>
  );
}