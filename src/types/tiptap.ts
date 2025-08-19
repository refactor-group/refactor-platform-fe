/**
 * TipTap type definitions and utilities
 * Using TipTap's native types instead of reinventing them
 */
import type { Extensions, AnyExtension, Extension } from "@tiptap/core";

/**
 * Re-export TipTap's native types for convenience
 */
export type { Extensions as TiptapExtensions, AnyExtension, Extension };

/**
 * Props for components that accept TipTap extensions
 */
export interface TiptapExtensionProps {
  extensions: Extensions;
}

/**
 * Type guard using TipTap's native extension structure
 * TipTap extensions are objects with a name property and extend from Extension base class
 */
export function isValidTiptapExtension(ext: unknown): ext is AnyExtension {
  return ext != null && 
         typeof ext === 'object' && 
         'name' in ext && 
         typeof (ext as any).name === 'string';
}

/**
 * Check if an extension is a collaboration extension
 */
export function isCollaborationExtension(ext: AnyExtension): boolean {
  return ext.name === 'collaboration' || ext.name === 'collaborationCaret';
}

/**
 * Simple validation wrapper that ensures we have valid TipTap extensions
 * TipTap already handles validation internally, so we just do basic checks
 */
export function validateExtensions(extensions: Extensions): Extensions {
  if (!Array.isArray(extensions)) {
    console.warn('⚠️ Extensions must be an array');
    return [];
  }
  
  // TipTap's Extensions type already ensures proper typing
  // We just filter out any null/undefined values that might have snuck in
  return extensions.filter(ext => {
    if (!ext) {
      if (process.env.NODE_ENV === 'development') {
        console.warn('⚠️ Null or undefined extension found');
      }
      return false;
    }
    
    // Log collaboration extensions in development
    if (process.env.NODE_ENV === 'development' && ext.name && isCollaborationExtension(ext)) {
      console.log('🔍 Found collaborative extension:', ext.name);
    }
    
    return true;
  });
}