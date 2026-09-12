import { NextResponse } from 'next/server';
import seed from '@/data/seed.json';

export async function GET() {
  return NextResponse.json(seed);
}
