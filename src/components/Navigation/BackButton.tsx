'use client';

import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useRouter } from 'next/navigation';

interface BackButtonProps {
    href?: string;
    onClick?: () => void;
}

export function BackButton({ href, onClick }: BackButtonProps) {
    const router = useRouter();

    const handleClick = () => {
        if (onClick) {
            onClick();
        } else if (href) {
            // Add refresh param to force reload when going back to dashboard
            if (href === '/') {
                router.push(href + '?refresh=' + Date.now());
            } else {
                router.push(href);
            }
        } else {
            router.back();
        }
    };

    return (
        <Button
            variant='secondary'
            size='sm'
            onClick={handleClick}
            className='flex items-center gap-2 text-white hover:bg-gray-800'>
            <ArrowLeft className='w-4 h-4' />
            Back
        </Button>
    );
}
