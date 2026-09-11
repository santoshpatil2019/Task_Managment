import { NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';
export async function GET(request:Request){
 const url=new URL(request.url);const token_hash=url.searchParams.get('token_hash');const type=url.searchParams.get('type');
 if(token_hash&&(type==='invite'||type==='recovery')){const client=await createSupabaseServerClient();const {error}=await client.auth.verifyOtp({token_hash,type});if(!error)return NextResponse.redirect(new URL('/auth/set-password',url.origin));}
 return NextResponse.redirect(new URL('/auth/forgot-password?error=expired',url.origin));
}
