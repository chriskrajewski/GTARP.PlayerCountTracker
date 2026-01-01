import { NextRequest, NextResponse } from 'next/server';
import { createBrowserClient } from '@/lib/supabase-browser';
import { createServiceRoleClient } from '@/lib/supabase-service-role';
import type { Database } from '@/lib/supabase.types';
import { z } from 'zod';

// Type definitions
type RoadmapVote = Database['public']['Tables']['roadmap_votes']['Row'];
type RoadmapVoteInsert = Database['public']['Tables']['roadmap_votes']['Insert'];

// Validation schema
const VoteSchema = z.object({
  roadmap_item_id: z.number().int().positive(),
});

// Helper function to get user ID from request
function getUserId(request: NextRequest): string {
  const forwarded = request.headers.get('x-forwarded-for');
  const ip = forwarded ? forwarded.split(',')[0] : '127.0.0.1';
  const userAgent = request.headers.get('user-agent') || 'unknown';
  return `guest_${Buffer.from(ip + userAgent).toString('base64').slice(0, 16)}`;
}

// POST - Add vote to roadmap item
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validated = VoteSchema.parse(body);
    const userId = getUserId(request);

    // Use browser client for public writes (RLS will handle permissions)
    const supabase = createBrowserClient();

    // Check if user already voted on this item
    const { data: existingVote, error: checkError } = await supabase
      .from('roadmap_votes')
      .select('id')
      .eq('roadmap_item_id', validated.roadmap_item_id)
      .eq('user_id', userId)
      .single();

    if (checkError && checkError.code !== 'PGRST116') {
      console.error('Error checking existing vote:', checkError);
      return NextResponse.json(
        { error: 'Failed to check vote status' },
        { status: 500 }
      );
    }

    if (existingVote) {
      return NextResponse.json(
        { error: 'You have already voted on this item' },
        { status: 409 }
      );
    }

    // Insert the vote
    const voteData: RoadmapVoteInsert = {
      roadmap_item_id: validated.roadmap_item_id,
      user_id: userId,
    };

    const { data: vote, error: insertError } = await supabase
      .from('roadmap_votes')
      .insert(voteData)
      .select()
      .single();

    if (insertError) {
      console.error('Error creating vote:', insertError);
      return NextResponse.json(
        { error: 'Failed to create vote' },
        { status: 500 }
      );
    }

    // Increment vote count on roadmap item
    const serviceRoleClient = createServiceRoleClient();
    const { error: updateError } = await serviceRoleClient
      .from('roadmap_items')
      .update({ vote_count: supabase.rpc('increment_vote_count', { item_id: validated.roadmap_item_id }) })
      .eq('id', validated.roadmap_item_id);

    // If increment fails, we'll use a fallback approach
    if (updateError) {
      // Get current vote count and increment manually
      const { data: item } = await serviceRoleClient
        .from('roadmap_items')
        .select('vote_count')
        .eq('id', validated.roadmap_item_id)
        .single();

      if (item) {
        await serviceRoleClient
          .from('roadmap_items')
          .update({ vote_count: (item.vote_count || 0) + 1 })
          .eq('id', validated.roadmap_item_id);
      }
    }

    return NextResponse.json({
      vote,
      message: 'Vote added successfully',
    }, { status: 201 });

  } catch (error) {
    if (error instanceof z.ZodError) {
      console.error('Vote validation error:', error.errors);
      return NextResponse.json(
        { 
          error: 'Validation failed', 
          details: error.errors,
        },
        { status: 400 }
      );
    }

    console.error('Unexpected error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// DELETE - Remove vote from roadmap item
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const itemId = searchParams.get('item_id');

    if (!itemId) {
      return NextResponse.json(
        { error: 'Item ID is required' },
        { status: 400 }
      );
    }

    const userId = getUserId(request);

    // Use browser client for public writes (RLS will handle permissions)
    const supabase = createBrowserClient();

    // Find and delete the vote
    const { data: vote, error: selectError } = await supabase
      .from('roadmap_votes')
      .select('id')
      .eq('roadmap_item_id', parseInt(itemId))
      .eq('user_id', userId)
      .single();

    if (selectError) {
      if (selectError.code === 'PGRST116') {
        return NextResponse.json(
          { error: 'Vote not found' },
          { status: 404 }
        );
      }
      console.error('Error finding vote:', selectError);
      return NextResponse.json(
        { error: 'Failed to find vote' },
        { status: 500 }
      );
    }

    // Delete the vote
    const { error: deleteError } = await supabase
      .from('roadmap_votes')
      .delete()
      .eq('id', vote.id);

    if (deleteError) {
      console.error('Error deleting vote:', deleteError);
      return NextResponse.json(
        { error: 'Failed to delete vote' },
        { status: 500 }
      );
    }

    // Decrement vote count on roadmap item
    const serviceRoleClient = createServiceRoleClient();
    const { data: item } = await serviceRoleClient
      .from('roadmap_items')
      .select('vote_count')
      .eq('id', parseInt(itemId))
      .single();

    if (item && item.vote_count > 0) {
      await serviceRoleClient
        .from('roadmap_items')
        .update({ vote_count: item.vote_count - 1 })
        .eq('id', parseInt(itemId));
    }

    return NextResponse.json({
      message: 'Vote removed successfully',
    });

  } catch (error) {
    console.error('Unexpected error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
