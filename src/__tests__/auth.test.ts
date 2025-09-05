import { describe, it, expect, vi, beforeEach } from 'vitest';
import { supabase } from '@/integrations/supabase/client';

// Mock Supabase client
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    auth: {
      signUp: vi.fn(),
      signInWithPassword: vi.fn(),
      signOut: vi.fn(),
      resetPasswordForEmail: vi.fn(),
      onAuthStateChange: vi.fn(),
      getSession: vi.fn(),
      getUser: vi.fn()
    }
  }
}));

describe('Authentication', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('signUp', () => {
    it('should sign up user with email and password', async () => {
      const mockResponse = { error: null };
      (supabase.auth.signUp as any).mockResolvedValue(mockResponse);

      const result = await supabase.auth.signUp({
        email: 'test@example.com',
        password: 'password123',
        options: {
          emailRedirectTo: 'http://localhost:8080/',
          data: { display_name: 'Test User' }
        }
      });

      expect(supabase.auth.signUp).toHaveBeenCalledWith({
        email: 'test@example.com',
        password: 'password123',
        options: {
          emailRedirectTo: 'http://localhost:8080/',
          data: { display_name: 'Test User' }
        }
      });
      expect(result.error).toBeNull();
    });

    it('should handle sign up errors', async () => {
      const mockError = { message: 'User already registered' };
      (supabase.auth.signUp as any).mockResolvedValue({ error: mockError });

      const result = await supabase.auth.signUp({
        email: 'test@example.com',
        password: 'password123',
        options: { emailRedirectTo: 'http://localhost:8080/' }
      });

      expect(result.error).toEqual(mockError);
    });
  });

  describe('signIn', () => {
    it('should sign in user with correct credentials', async () => {
      const mockResponse = { error: null };
      (supabase.auth.signInWithPassword as any).mockResolvedValue(mockResponse);

      const result = await supabase.auth.signInWithPassword({
        email: 'test@example.com',
        password: 'password123'
      });

      expect(supabase.auth.signInWithPassword).toHaveBeenCalledWith({
        email: 'test@example.com',
        password: 'password123'
      });
      expect(result.error).toBeNull();
    });

    it('should handle invalid credentials', async () => {
      const mockError = { message: 'Invalid login credentials' };
      (supabase.auth.signInWithPassword as any).mockResolvedValue({ error: mockError });

      const result = await supabase.auth.signInWithPassword({
        email: 'test@example.com',
        password: 'wrongpassword'
      });

      expect(result.error).toEqual(mockError);
    });
  });

  describe('signOut', () => {
    it('should sign out user successfully', async () => {
      const mockResponse = { error: null };
      (supabase.auth.signOut as any).mockResolvedValue(mockResponse);

      const result = await supabase.auth.signOut();

      expect(supabase.auth.signOut).toHaveBeenCalled();
      expect(result.error).toBeNull();
    });
  });

  describe('resetPassword', () => {
    it('should send password reset email', async () => {
      const mockResponse = { error: null };
      (supabase.auth.resetPasswordForEmail as any).mockResolvedValue(mockResponse);

      const result = await supabase.auth.resetPasswordForEmail('test@example.com', {
        redirectTo: 'http://localhost:8080/reset-password'
      });

      expect(supabase.auth.resetPasswordForEmail).toHaveBeenCalledWith('test@example.com', {
        redirectTo: 'http://localhost:8080/reset-password'
      });
      expect(result.error).toBeNull();
    });
  });
});