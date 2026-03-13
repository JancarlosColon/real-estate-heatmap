import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/app/lib/supabase';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { type, message, email } = body;

    if (!message?.trim()) {
      return NextResponse.json({ error: 'Message is required' }, { status: 400 });
    }

    const { error } = await supabase
      .from('feedback')
      .insert({
        type: type || 'feature',
        message: message.trim().slice(0, 2000),
        email: email?.trim().slice(0, 200) || null,
      });

    if (error) {
      console.error('Feedback insert error:', error);
      return NextResponse.json({ error: 'Failed to save feedback' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('Feedback error:', err);
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }
}
