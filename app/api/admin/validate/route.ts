import { NextRequest, NextResponse } from 'next/server';
import { validateAdminRequest } from '@/lib/admin-auth-server';

// POST - Validate admin token
export async function POST(request: NextRequest) {
  try {
    const isValid = validateAdminRequest(request);
    
    if (isValid) {
      return NextResponse.json({ 
        valid: true,
        message: 'Admin token is valid' 
      });
    } else {
      return NextResponse.json(
        { 
          valid: false,
          error: 'Invalid admin token' 
        },
        { status: 401 }
      );
    }
  } catch (error) {
    console.error('Admin validation error:', error);
    return NextResponse.json(
      { 
        valid: false,
        error: 'Internal server error' 
      },
      { status: 500 }
    );
  }
}
