# Notification Banners - Quick Start Guide

## 🚀 Quick Setup (5 minutes)

### 1. Database Setup
Run the schema file to create the required tables:

```sql
-- Execute this in your Supabase SQL editor or via psql
\i api2db/sql/notification_banners_schema.sql
```

### 2. Set Admin Token
Add a secure admin token to your environment variables:

```bash
# In your .env.local file
ADMIN_TOKEN=your-super-secure-admin-token-here-make-it-long-and-random
```

**🔒 Security Note:** Use a strong, randomly generated token (at least 32 characters). This protects your admin panel from unauthorized access.

**💡 Generate a secure token:**
```bash
# Using Node.js (if available)
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# Using OpenSSL (most systems)
openssl rand -hex 32

# Or use an online generator (for development only)
# https://generate-random.org/api-key-generator?count=1&length=64
```

### 3. Access Admin Panel
Navigate to the admin panel in your browser:
```
https://your-domain.com/admin/banners
```

You'll be prompted to enter your admin token. Enter the same token you set in your environment variables.

### 4. Create Your First Banner

1. Click **"New Banner"** button
2. Fill in the form:
   - **Title**: "Welcome to Our Site!"
   - **Message**: "Thanks for visiting! Check out our latest features."
   - **Type**: Info
   - **Priority**: 5
   - Toggle **Active** ON
   - Toggle **Dismissible** ON

3. Click **"Create Banner"**

### 5. View Your Banner
Visit any page of your site - you should see your banner at the top!

## 🎯 Common Use Cases

### System Maintenance Notice
```json
{
  "title": "Scheduled Maintenance",
  "message": "System will be down for maintenance tonight 2-4 AM EST",
  "type": "warning",
  "priority": 8,
  "start_date": "2024-01-15T01:00:00Z",
  "end_date": "2024-01-15T05:00:00Z"
}
```

### New Feature Announcement
```json
{
  "title": "🎉 New Dashboard Available!",
  "message": "Experience our redesigned analytics dashboard with improved performance",
  "type": "announcement",
  "priority": 6,
  "action_text": "Explore Now",
  "action_url": "/dashboard"
}
```

### Critical Alert
```json
{
  "title": "Security Update Required",
  "message": "Please update your password for enhanced security",
  "type": "urgent",
  "priority": 10,
  "is_dismissible": false,
  "action_text": "Update Now",
  "action_url": "/settings/password"
}
```

## 🎨 Banner Types Reference

| Type | Use Case | Color Theme | Icon |
|------|----------|-------------|------|
| **info** | General information, updates | Blue | ℹ️ |
| **warning** | Important notices, alerts | Amber | ⚠️ |
| **success** | Positive updates, achievements | Green | ✅ |
| **announcement** | Major news, feature releases | Purple | 📢 |
| **urgent** | Critical alerts, emergencies | Red | 🚨 |

## 📱 Quick API Usage

### Create a Banner (POST)
```javascript
const response = await fetch('/api/notification-banners', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    title: "Welcome!",
    message: "Thanks for joining us!",
    type: "info",
    priority: 5
  })
});
```

### Get Active Banners (GET)
```javascript
const response = await fetch('/api/notification-banners');
const data = await response.json();
console.log(data.banners);
```

### Dismiss a Banner (POST)
```javascript
await fetch('/api/notification-banners/dismiss', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ banner_id: 1 })
});
```

## 🛠️ React Component Usage

### Basic Implementation
```tsx
import { NotificationBannerList, useNotificationBanners } from '@/components/notification-banner';

export function Layout({ children }) {
  const { banners, dismissBanner } = useNotificationBanners();
  
  return (
    <div>
      <NotificationBannerList 
        banners={banners} 
        onDismiss={dismissBanner}
        maxVisible={2}
      />
      {children}
    </div>
  );
}
```

### Custom Styling
```tsx
<NotificationBannerList 
  banners={banners}
  onDismiss={dismissBanner}
  className="mb-4"
  maxVisible={3}
/>
```

## ⚙️ Configuration Options

### Priority Levels
- **1-3**: Low priority (general info)
- **4-6**: Medium priority (important updates)  
- **7-8**: High priority (critical info)
- **9-10**: Urgent (emergency notifications)

### Scheduling
- **start_date**: Banner becomes active (optional)
- **end_date**: Banner becomes inactive (optional)
- **Format**: ISO 8601 timestamp (e.g., "2024-01-15T14:30:00Z")

### Action Buttons
- **action_text**: Button label (e.g., "Learn More")
- **action_url**: Destination URL
- **action_target**: "_self" (same tab) or "_blank" (new tab)

### Custom Colors
- **background_color**: Hex color (e.g., "#1e40af")
- **text_color**: Hex color (e.g., "#ffffff")  
- **border_color**: Hex color (e.g., "#3b82f6")

## 🔍 Troubleshooting

### Banner Not Showing?
1. ✅ Check if banner is **Active**
2. ✅ Verify **start_date** hasn't passed
3. ✅ Confirm **end_date** hasn't expired
4. ✅ Check if you've dismissed it already
5. ✅ Verify feature flag is enabled

### Admin Panel Not Loading?
1. ✅ Navigate to `/admin/banners`
2. ✅ Enter correct admin token (check your .env.local file)
3. ✅ Verify ADMIN_TOKEN environment variable is set
4. ✅ Check browser console for errors
5. ✅ Verify database connectivity
6. ✅ Check API endpoints are responding

### Getting "Admin authentication required" errors?
1. ✅ Verify your ADMIN_TOKEN environment variable is set correctly
2. ✅ Make sure the token in localStorage matches your environment variable
3. ✅ Try logging out and logging back in to the admin panel
4. ✅ Check that your token doesn't have extra spaces or special characters

### Styling Issues?
1. ✅ Check custom color values are valid hex
2. ✅ Verify CSS classes aren't conflicting
3. ✅ Test on different screen sizes
4. ✅ Check browser compatibility

## 📊 Best Practices

### Content Guidelines
- **Titles**: Keep under 50 characters
- **Messages**: Limit to 200 characters for mobile
- **Tone**: Match your brand voice
- **Urgency**: Use appropriate banner types

### Technical Guidelines
- **Max Banners**: Show 2-3 simultaneously
- **Performance**: Monitor API response times
- **Accessibility**: Ensure color contrast meets WCAG standards
- **Testing**: Preview banners before publishing

### User Experience
- **Dismissible**: Allow users to close non-critical banners
- **Relevant**: Only show banners relevant to current users
- **Timing**: Consider user timezone for scheduled banners
- **Frequency**: Avoid banner fatigue with too many notifications

## 🚀 Advanced Features

### Bulk Operations
Create multiple banners via API:
```javascript
const banners = [
  { title: "Feature 1", message: "New feature available", type: "info" },
  { title: "Feature 2", message: "Another update", type: "announcement" }
];

for (const banner of banners) {
  await fetch('/api/notification-banners', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(banner)
  });
}
```

### Conditional Display
Show banners based on user segments:
```tsx
const { banners } = useNotificationBanners();
const relevantBanners = banners.filter(banner => {
  // Custom logic here
  return userMeetsConditions(banner);
});
```

### Custom Hooks
Create specialized hooks for specific banner types:
```tsx
function useUrgentBanners() {
  const { banners, ...rest } = useNotificationBanners();
  const urgentBanners = banners.filter(b => b.type === 'urgent');
  return { banners: urgentBanners, ...rest };
}
```

## 📈 Analytics & Monitoring

### View Statistics
Monitor banner performance in the admin panel:
- **View Count**: How many times banner was seen
- **Dismissal Rate**: Percentage of users who dismissed
- **Active Period**: How long banner has been active

### API Monitoring
Track API performance:
```javascript
// Log banner interactions
console.log('Banner viewed:', bannerId);
console.log('Banner dismissed:', bannerId);
```

## 🎓 Learning Resources

- 📚 [Full Documentation](./NOTIFICATION_BANNERS.md)
- 🎯 [API Reference](./NOTIFICATION_BANNERS.md#api-endpoints)
- 🧩 [Component Reference](./NOTIFICATION_BANNERS.md#react-components)
- 🗄️ [Database Schema](./NOTIFICATION_BANNERS.md#database-schema)

---

**Need Help?** Check the full documentation or create an issue in the repository for support!
