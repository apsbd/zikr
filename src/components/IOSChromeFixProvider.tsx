'use client';

import { useEffect } from 'react';
import { applyIOSChromeRenderFix } from '@/utils/iosChromeRenderFix';

export default function IOSChromeFixProvider() {
    useEffect(() => {
        if (typeof window !== 'undefined') {
            applyIOSChromeRenderFix();
        }
    }, []);

    return null;
}
