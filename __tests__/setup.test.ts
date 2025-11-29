/**
 * Simple test to verify testing setup is working
 */

import { describe, it, expect } from 'vitest';

describe('Testing Setup', () => {
  it('should run basic tests', () => {
    expect(1 + 1).toBe(2);
  });

  it('should have access to localStorage mock', () => {
    localStorage.setItem('test', 'value');
    expect(localStorage.getItem('test')).toBe('value');
    localStorage.clear();
  });

  it('should have access to sessionStorage mock', () => {
    sessionStorage.setItem('test', 'value');
    expect(sessionStorage.getItem('test')).toBe('value');
    sessionStorage.clear();
  });
});
