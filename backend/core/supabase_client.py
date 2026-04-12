import os
from core.config import settings

try:
    from supabase import create_client, Client
except ImportError:
    Client = None
    create_client = None

def get_supabase_client():
    if create_client is None:
        print("Warning: supabase not installed, using mock client")
        return None
    
    if settings.SUPABASE_URL and settings.SUPABASE_KEY:
        try:
            return create_client(settings.SUPABASE_URL, settings.SUPABASE_KEY)
        except Exception as e:
            print(f"Error initializing Supabase client: {e}")
            return None
    return None

supabase = get_supabase_client()
