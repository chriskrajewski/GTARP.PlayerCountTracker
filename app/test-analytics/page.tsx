"use client";

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { event, trackServerSelect, trackTimeRangeSelect, trackStreamClick, GA_TRACKING_ID } from '@/lib/gtag';

export default function TestAnalyticsPage() {
  const [analyticsStatus, setAnalyticsStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [events, setEvents] = useState<string[]>([]);

  useEffect(() => {
    // Check if gtag is loaded
    const checkGtag = () => {
      if (typeof window !== 'undefined' && (window as any).gtag) {
        setAnalyticsStatus('ready');
      } else {
        setTimeout(checkGtag, 100);
      }
    };
    
    checkGtag();
  }, []);

  const addEvent = (eventName: string) => {
    const timestamp = new Date().toLocaleTimeString();
    setEvents(prev => [`${timestamp}: ${eventName}`, ...prev.slice(0, 9)]);
  };

  const testPageView = () => {
    if (typeof window !== 'undefined' && (window as any).gtag) {
      (window as any).gtag('event', 'page_view', {
        page_title: 'Test Analytics Page',
        page_location: window.location.href,
        page_path: '/test-analytics'
      });
      addEvent('Page View Event Sent');
    }
  };

  const testCustomEvent = () => {
    event({
      action: 'test_button_click',
      category: 'engagement',
      label: 'analytics_test_page',
      value: 1
    });
    addEvent('Custom Event Sent: test_button_click');
  };

  const testServerSelect = () => {
    trackServerSelect('test123', 'Test Server');
    addEvent('Server Select Event Sent: test123 - Test Server');
  };

  const testTimeRange = () => {
    trackTimeRangeSelect('24h');
    addEvent('Time Range Event Sent: 24h');
  };

  const testStreamClick = () => {
    trackStreamClick('TestStreamer', 'test123');
    addEvent('Stream Click Event Sent: TestStreamer on test123');
  };

  const testPurchaseEvent = () => {
    if (typeof window !== 'undefined' && (window as any).gtag) {
      (window as any).gtag('event', 'purchase', {
        transaction_id: 'test_' + Date.now(),
        value: 9.99,
        currency: 'USD',
        items: [{
          item_id: 'premium_access',
          item_name: 'Premium Access',
          category: 'subscription',
          quantity: 1,
          price: 9.99
        }]
      });
      addEvent('Purchase Event Sent: $9.99 premium_access');
    }
  };

  return (
    <div className="min-h-screen bg-black p-6">
      <div className="max-w-4xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">Google Analytics Test Page</h1>
          <p className="text-gray-400">Test Google Analytics integration and event tracking</p>
        </div>

        {/* Status Card */}
        <Card className="bg-gray-900 border-gray-700 mb-6">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              Google Analytics Status
              <Badge variant={analyticsStatus === 'ready' ? 'default' : 'secondary'}>
                {analyticsStatus}
              </Badge>
            </CardTitle>
            <CardDescription>
              Tracking ID: {GA_TRACKING_ID || 'Not configured'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 text-sm text-gray-300">
              <div>Environment: {process.env.NODE_ENV}</div>
              <div>Gtag Available: {typeof window !== 'undefined' && (window as any).gtag ? '✅ Yes' : '❌ No'}</div>
              <div>Data Layer: {typeof window !== 'undefined' && (window as any).dataLayer ? `✅ ${(window as any).dataLayer?.length || 0} items` : '❌ Not found'}</div>
            </div>
          </CardContent>
        </Card>

        {/* Test Buttons */}
        <Card className="bg-gray-900 border-gray-700 mb-6">
          <CardHeader>
            <CardTitle className="text-white">Event Testing</CardTitle>
            <CardDescription>
              Click these buttons to send test events to Google Analytics
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              <Button 
                onClick={testPageView}
                disabled={analyticsStatus !== 'ready'}
                className="bg-blue-600 hover:bg-blue-700"
              >
                Test Page View
              </Button>
              
              <Button 
                onClick={testCustomEvent}
                disabled={analyticsStatus !== 'ready'}
                className="bg-green-600 hover:bg-green-700"
              >
                Test Custom Event
              </Button>
              
              <Button 
                onClick={testServerSelect}
                disabled={analyticsStatus !== 'ready'}
                className="bg-purple-600 hover:bg-purple-700"
              >
                Test Server Select
              </Button>
              
              <Button 
                onClick={testTimeRange}
                disabled={analyticsStatus !== 'ready'}
                className="bg-orange-600 hover:bg-orange-700"
              >
                Test Time Range
              </Button>
              
              <Button 
                onClick={testStreamClick}
                disabled={analyticsStatus !== 'ready'}
                className="bg-pink-600 hover:bg-pink-700"
              >
                Test Stream Click
              </Button>
              
              <Button 
                onClick={testPurchaseEvent}
                disabled={analyticsStatus !== 'ready'}
                className="bg-yellow-600 hover:bg-yellow-700"
              >
                Test Purchase Event
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Event Log */}
        <Card className="bg-gray-900 border-gray-700">
          <CardHeader>
            <CardTitle className="text-white">Event Log</CardTitle>
            <CardDescription>
              Recent events sent to Google Analytics
            </CardDescription>
          </CardHeader>
          <CardContent>
            {events.length === 0 ? (
              <p className="text-gray-400 italic">No events sent yet. Click the buttons above to test.</p>
            ) : (
              <div className="space-y-1">
                {events.map((event, index) => (
                  <div key={index} className="text-sm text-gray-300 font-mono bg-gray-800 p-2 rounded">
                    {event}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <div className="mt-6 text-center">
          <p className="text-gray-400 text-sm">
            Check your browser's developer console for additional Google Analytics debug information.
          </p>
        </div>
      </div>
    </div>
  );
}