import { NextRequest, NextResponse } from 'next/server';

/**
 * OAuth Provider Configuration
 * 
 * This endpoint returns all available OAuth providers configured in Supabase.
 * It dynamically fetches provider metadata from Supabase Auth settings.
 * 
 * The response includes:
 * - Provider ID (e.g., 'discord', 'google', 'github')
 * - Display name
 * - Icon/color information
 * - Whether the provider is enabled
 */

export interface OAuthProvider {
  id: string;
  name: string;
  displayName: string;
  icon: string;
  color: string;
  enabled: boolean;
  description?: string;
}

/**
 * Provider metadata - maps provider IDs to display information
 * This is used to enhance the provider data from Supabase
 */
const PROVIDER_METADATA: Record<string, Omit<OAuthProvider, 'id' | 'enabled'>> = {
  discord: {
    name: 'discord',
    displayName: 'Discord',
    icon: 'discord',
    color: '#5865F2',
    description: 'Sign in with your Discord account',
  },
  google: {
    name: 'google',
    displayName: 'Google',
    icon: 'google',
    color: '#4285F4',
    description: 'Sign in with your Google account',
  },
  github: {
    name: 'github',
    displayName: 'GitHub',
    icon: 'github',
    color: '#000000',
    description: 'Sign in with your GitHub account',
  },
  microsoft: {
    name: 'microsoft',
    displayName: 'Microsoft',
    icon: 'microsoft',
    color: '#00A4EF',
    description: 'Sign in with your Microsoft account',
  },
  apple: {
    name: 'apple',
    displayName: 'Apple',
    icon: 'apple',
    color: '#000000',
    description: 'Sign in with your Apple ID',
  },
  twitch: {
    name: 'twitch',
    displayName: 'Twitch',
    icon: 'twitch',
    color: '#9146FF',
    description: 'Sign in with your Twitch account',
  },
  spotify: {
    name: 'spotify',
    displayName: 'Spotify',
    icon: 'spotify',
    color: '#1DB954',
    description: 'Sign in with your Spotify account',
  },
  gitlab: {
    name: 'gitlab',
    displayName: 'GitLab',
    icon: 'gitlab',
    color: '#FC6D26',
    description: 'Sign in with your GitLab account',
  },
  bitbucket: {
    name: 'bitbucket',
    displayName: 'Bitbucket',
    icon: 'bitbucket',
    color: '#0052CC',
    description: 'Sign in with your Bitbucket account',
  },
  linkedin: {
    name: 'linkedin',
    displayName: 'LinkedIn',
    icon: 'linkedin',
    color: '#0A66C2',
    description: 'Sign in with your LinkedIn account',
  },
  slack: {
    name: 'slack',
    displayName: 'Slack',
    icon: 'slack',
    color: '#36C5F0',
    description: 'Sign in with your Slack account',
  },
  figma: {
    name: 'figma',
    displayName: 'Figma',
    icon: 'figma',
    color: '#F24E1E',
    description: 'Sign in with your Figma account',
  },
  notion: {
    name: 'notion',
    displayName: 'Notion',
    icon: 'notion',
    color: '#000000',
    description: 'Sign in with your Notion account',
  },
  workos: {
    name: 'workos',
    displayName: 'WorkOS',
    icon: 'workos',
    color: '#6363F1',
    description: 'Sign in with your WorkOS account',
  },
};

/**
 * Get enabled OAuth providers from environment configuration
 * 
 * Since Supabase doesn't expose the list of enabled providers via a public API,
 * we use environment variables to configure which providers are enabled.
 * 
 * Set ENABLED_OAUTH_PROVIDERS in your environment:
 * ENABLED_OAUTH_PROVIDERS=discord,google,github
 * 
 * If not set, defaults to common providers: discord, google, github
 */
async function getEnabledProviders(): Promise<string[]> {
  const DEFAULT_PROVIDERS = ['discord', 'google', 'github'];
  
  try {
    console.log('[getEnabledProviders] Starting...');
    
    // Get enabled providers from environment variable
    const enabledProvidersEnv = process.env.ENABLED_OAUTH_PROVIDERS;
    console.log('[getEnabledProviders] ENABLED_OAUTH_PROVIDERS env:', enabledProvidersEnv);
    
    if (enabledProvidersEnv && enabledProvidersEnv.trim()) {
      const providers = enabledProvidersEnv
        .split(',')
        .map(p => p.trim().toLowerCase())
        .filter(p => p.length > 0);
      
      if (providers.length > 0) {
        console.log('[getEnabledProviders] Using env providers:', providers);
        return providers;
      }
    }

    console.log('[getEnabledProviders] No env var set, trying Supabase...');
    
    // Fallback: Try to detect from Supabase config
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_ANON_KEY;
    
    console.log('[getEnabledProviders] Supabase URL:', supabaseUrl ? 'set' : 'not set');
    console.log('[getEnabledProviders] Supabase Key:', supabaseKey ? 'set' : 'not set');
    
    if (supabaseUrl && supabaseKey) {
      try {
        console.log('[getEnabledProviders] Fetching from Supabase...');
        const response = await fetch(`${supabaseUrl}/auth/v1/providers`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'apikey': supabaseKey,
          },
        });

        console.log('[getEnabledProviders] Supabase response status:', response.status);

        if (response.ok) {
          const data = await response.json();
          console.log('[getEnabledProviders] Supabase data:', data);
          
          if (Array.isArray(data) && data.length > 0) {
            const providers = data
              .map((provider: any) => provider.id || provider.name)
              .filter((p: string) => p && p.length > 0);
            
            if (providers.length > 0) {
              console.log('[getEnabledProviders] Using Supabase providers:', providers);
              return providers;
            }
          }
        }
      } catch (err) {
        console.error('[getEnabledProviders] Error fetching from Supabase:', err);
      }
    }

    // Final fallback: return common providers as default
    console.warn('[getEnabledProviders] Using default providers:', DEFAULT_PROVIDERS);
    return DEFAULT_PROVIDERS;
  } catch (error) {
    console.error('[getEnabledProviders] Unexpected error:', error);
    console.warn('[getEnabledProviders] Returning default providers:', DEFAULT_PROVIDERS);
    return DEFAULT_PROVIDERS;
  }
}

/**
 * GET /api/admin/auth-providers
 * 
 * Returns a list of all available OAuth providers with their metadata.
 * The list is dynamically generated based on what's enabled in Supabase.
 */
export async function GET(request: NextRequest) {
  try {
    console.log('[API] /api/admin/auth-providers GET request');
    
    // Get enabled providers from Supabase
    const enabledProviders = await getEnabledProviders();
    console.log('[API] Enabled providers:', enabledProviders);

    // Build the response with provider metadata
    const providers: OAuthProvider[] = enabledProviders
      .map((providerId) => {
        const metadata = PROVIDER_METADATA[providerId as keyof typeof PROVIDER_METADATA];
        
        if (!metadata) {
          // If we don't have metadata for this provider, create a basic entry
          return {
            id: providerId,
            name: providerId,
            displayName: providerId.charAt(0).toUpperCase() + providerId.slice(1),
            icon: providerId,
            color: '#666666',
            enabled: true,
          };
        }

        return {
          ...metadata,
          id: providerId,
          enabled: true,
        };
      })
      .sort((a, b) => a.displayName.localeCompare(b.displayName));

    console.log('[API] Returning', providers.length, 'providers:', providers.map(p => p.id));

    return NextResponse.json({
      success: true,
      providers,
      count: providers.length,
    });
  } catch (error) {
    console.error('[API] Error in auth-providers endpoint:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch authentication providers',
        providers: [],
      },
      { status: 500 }
    );
  }
}

