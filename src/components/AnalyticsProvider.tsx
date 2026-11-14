'use client';

import React, { createContext, useContext, useEffect } from 'react';
import Script from 'next/script';

declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void;
    fbq?: (...args: unknown[]) => void;
  }
}

interface AnalyticsContextType {
  trackViewContent: (contentName: string, priceBDT?: number) => void;
  trackDomainSearch: (query: string) => void;
  trackInitiateCheckout: (planName: string, amountBDT: number) => void;
  trackPurchase: (orderId: string, amountBDT: number, itemsCount?: number) => void;
}

const AnalyticsContext = createContext<AnalyticsContextType>({
  trackViewContent: () => {},
  trackDomainSearch: () => {},
  trackInitiateCheckout: () => {},
  trackPurchase: () => {},
});

export const useAnalytics = () => useContext(AnalyticsContext);

export default function AnalyticsProvider({ children }: { children: React.ReactNode }) {
  const gaId = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID;
  const fbPixelId = process.env.NEXT_PUBLIC_FB_PIXEL_ID;

  // Global helper dispatchers
  const trackViewContent = (contentName: string, priceBDT?: number) => {
    if (typeof window === 'undefined') return;

    // Google Analytics 4
    if (window.gtag) {
      window.gtag('event', 'view_item', {
        items: [{ item_name: contentName, price: priceBDT }],
        currency: 'BDT',
        value: priceBDT,
      });
    }

    // Meta Pixel
    if (window.fbq) {
      window.fbq('track', 'ViewContent', {
        content_name: contentName,
        value: priceBDT,
        currency: 'BDT',
      });
    }
  };

  const trackDomainSearch = (query: string) => {
    if (typeof window === 'undefined') return;

    if (window.gtag) {
      window.gtag('event', 'search', {
        search_term: query,
      });
    }

    if (window.fbq) {
      window.fbq('track', 'Search', {
        search_string: query,
      });
    }
  };

  const trackInitiateCheckout = (planName: string, amountBDT: number) => {
    if (typeof window === 'undefined') return;

    if (window.gtag) {
      window.gtag('event', 'begin_checkout', {
        currency: 'BDT',
        value: amountBDT,
        items: [{ item_name: planName, price: amountBDT }],
      });
    }

    if (window.fbq) {
      window.fbq('track', 'InitiateCheckout', {
        content_name: planName,
        value: amountBDT,
        currency: 'BDT',
      });
    }
  };

  const trackPurchase = (orderId: string, amountBDT: number, itemsCount = 1) => {
    if (typeof window === 'undefined') return;

    if (window.gtag) {
      window.gtag('event', 'purchase', {
        transaction_id: orderId,
        value: amountBDT,
        currency: 'BDT',
        items: [{ item_name: `Order #${orderId}`, price: amountBDT, quantity: itemsCount }],
      });
    }

    if (window.fbq) {
      window.fbq('track', 'Purchase', {
        value: amountBDT,
        currency: 'BDT',
        content_type: 'product',
        order_id: orderId,
      });
    }
  };

  return (
    <AnalyticsContext.Provider
      value={{
        trackViewContent,
        trackDomainSearch,
        trackInitiateCheckout,
        trackPurchase,
      }}
    >
      {/* Google Analytics 4 Script (Loads only if configured) */}
      {gaId && (
        <>
          <Script
            src={`https://www.googletagmanager.com/gtag/js?id=${gaId}`}
            strategy="afterInteractive"
          />
          <Script id="google-analytics-init" strategy="afterInteractive">
            {`
              window.dataLayer = window.dataLayer || [];
              function gtag(){dataLayer.push(arguments);}
              gtag('js', new Date());
              gtag('config', '${gaId}', {
                page_path: window.location.pathname,
              });
            `}
          </Script>
        </>
      )}

      {/* Meta Facebook Pixel Script (Loads only if configured) */}
      {fbPixelId && (
        <Script id="facebook-pixel-init" strategy="afterInteractive">
          {`
            !function(f,b,e,v,n,t,s)
            {if(f.fbq)return;n=f.fbq=function(){n.callMethod?
            n.callMethod.apply(n,arguments):n.queue.push(arguments)};
            if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
            n.queue=[];t=b.createElement(e);t.async=!0;
            t.src=v;s=b.getElementsByTagName(e)[0];
            s.parentNode.insertBefore(t,s)}(window, document,'script',
            'https://connect.facebook.net/en_US/fbevents.js');
            fbq('init', '${fbPixelId}');
            fbq('track', 'PageView');
          `}
        </Script>
      )}

      {children}
    </AnalyticsContext.Provider>
  );
}
