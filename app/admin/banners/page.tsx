"use client";

import { CommonLayout } from '@/components/common-layout';
import { AdminBannerControls } from '@/components/admin-banner-controls';
import { useFeatureGate, FEATURE_GATES } from '@/lib/statsig';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export default function AdminBannersPage() {
  const isNotificationBannersEnabled = useFeatureGate(FEATURE_GATES.NOTIFICATION_BANNERS);

  if (!isNotificationBannersEnabled) {
    return (
      <CommonLayout showBackButton pageTitle="Admin - Notification Banners">
        <Card className="bg-[#0e0e10] border-[#26262c]">
          <CardContent className="p-6">
            <div className="text-center py-8">
              <h2 className="text-xl font-semibold text-white mb-2">
                Feature Not Available
              </h2>
              <p className="text-[#ADADB8]">
                Notification banners are currently disabled. Please contact an administrator to enable this feature.
              </p>
            </div>
          </CardContent>
        </Card>
      </CommonLayout>
    );
  }

  return (
    <CommonLayout showBackButton pageTitle="Admin - Notification Banners">
      <div className="space-y-6">
        {/* Page Header */}
        <div className="text-center">
          <h1 className="text-3xl font-bold text-white mb-2">
            Notification Banner Administration
          </h1>
          <p className="text-[#ADADB8] max-w-2xl mx-auto">
            Manage site-wide notification banners to communicate important updates, 
            announcements, and system notifications to your users.
          </p>
        </div>

        {/* Admin Controls */}
        <AdminBannerControls />

        {/* Usage Guidelines */}
        <Card className="bg-[#0e0e10] border-[#26262c]">
          <CardHeader>
            <CardTitle className="text-white">Usage Guidelines</CardTitle>
            <CardDescription className="text-[#ADADB8]">
              Best practices for creating effective notification banners
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 text-[#ADADB8]">
            <div>
              <h4 className="font-medium text-white mb-2">Banner Types</h4>
              <ul className="space-y-1 text-sm">
                <li><strong className="text-blue-400">Info:</strong> General information and updates</li>
                <li><strong className="text-amber-400">Warning:</strong> Important notices that require attention</li>
                <li><strong className="text-emerald-400">Success:</strong> Positive updates and achievements</li>
                <li><strong className="text-violet-400">Announcement:</strong> Major news and feature releases</li>
                <li><strong className="text-red-400">Urgent:</strong> Critical alerts and time-sensitive information</li>
              </ul>
            </div>

            <div>
              <h4 className="font-medium text-white mb-2">Priority Levels</h4>
              <ul className="space-y-1 text-sm">
                <li><strong>1-3:</strong> Low priority - General information</li>
                <li><strong>4-6:</strong> Medium priority - Important updates</li>
                <li><strong>7-8:</strong> High priority - Critical information</li>
                <li><strong>9-10:</strong> Urgent - Emergency notifications</li>
              </ul>
            </div>

            <div>
              <h4 className="font-medium text-white mb-2">Best Practices</h4>
              <ul className="space-y-1 text-sm">
                <li>• Keep titles concise and descriptive (under 50 characters)</li>
                <li>• Write clear, actionable messages (under 200 characters)</li>
                <li>• Use scheduling to plan announcements in advance</li>
                <li>• Make banners dismissible unless they contain critical safety information</li>
                <li>• Test banner appearance with the preview feature before publishing</li>
                <li>• Monitor dismiss rates to gauge user engagement</li>
              </ul>
            </div>

            <div>
              <h4 className="font-medium text-white mb-2">Technical Notes</h4>
              <ul className="space-y-1 text-sm">
                <li>• Maximum of 2 banners are shown simultaneously</li>
                <li>• Banners are sorted by priority (highest first)</li>
                <li>• Dismissed banners won't show again for the same user</li>
                <li>• Custom colors override default theme colors</li>
                <li>• Scheduled banners automatically activate/deactivate</li>
              </ul>
            </div>
          </CardContent>
        </Card>
      </div>
    </CommonLayout>
  );
}
