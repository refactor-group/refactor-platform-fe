import { useState } from 'react';

type Platform = 'mac' | 'windows' | 'linux' | 'unknown';

interface KeyboardShortcuts {
  bold: string;
  italic: string;
  underline: string;
  strikethrough: string;
  highlight: string;
  code: string;
  link: string;
  undo: string;
  redo: string;
  selectAll: string;
  find: string;
  save: string;
}

function detectPlatform(): Platform {
  if (typeof window === 'undefined') {
    return 'unknown';
  }

  const userAgent = window.navigator.userAgent.toLowerCase();
  const navPlatform = window.navigator.platform?.toLowerCase() || '';

  // Check for macOS
  if (
    navPlatform.includes('mac') ||
    userAgent.includes('mac') ||
    /iphone|ipad|ipod/.test(userAgent)
  ) {
    return 'mac';
  }

  // Check for Windows
  if (navPlatform.includes('win') || userAgent.includes('windows')) {
    return 'windows';
  }

  // Check for Linux
  if (navPlatform.includes('linux') || userAgent.includes('linux')) {
    return 'linux';
  }

  // Fallback: detect by checking if Cmd key works (Mac-specific)
  try {
    const isMac = /Mac|iPod|iPhone|iPad/.test(window.navigator.platform);
    if (isMac) return 'mac';
  } catch {
    // Ignore errors
  }

  // Default to Windows/Linux shortcuts for unknown platforms
  return 'windows';
}

/**
 * Custom hook to detect the user's platform and provide appropriate keyboard shortcuts
 */
export const useKeyboardShortcuts = () => {
  const [platform] = useState<Platform>(detectPlatform);

  const getShortcuts = (): KeyboardShortcuts => {
    const isMac = platform === 'mac';
    const modKey = isMac ? '⌘' : 'Ctrl';
    const _altKey = isMac ? '⌥' : 'Alt';
    const shiftKey = '⇧';

    return {
      bold: `${modKey}B`,
      italic: `${modKey}I`,
      underline: `${modKey}U`,
      strikethrough: `${modKey}${shiftKey}S`,
      highlight: `${modKey}${shiftKey}H`,
      code: `${modKey}E`,
      link: `${modKey}K`,
      undo: `${modKey}Z`,
      redo: isMac ? `${modKey}${shiftKey}Z` : `${modKey}Y`,
      selectAll: `${modKey}A`,
      find: `${modKey}F`,
      save: `${modKey}S`,
    };
  };

  const formatShortcut = (shortcut: string): string => {
    return shortcut;
  };

  /**
   * Get the modifier key for the current platform
   */
  const getModifierKey = (): string => {
    return platform === 'mac' ? '⌘' : 'Ctrl';
  };

  /**
   * Get the alt key for the current platform
   */
  const getAltKey = (): string => {
    return platform === 'mac' ? '⌥' : 'Alt';
  };

  /**
   * Check if the current platform is Mac
   */
  const isMac = platform === 'mac';

  /**
   * Check if the current platform is Windows
   */
  const isWindows = platform === 'windows';

  /**
   * Check if the current platform is Linux
   */
  const isLinux = platform === 'linux';

  return {
    platform,
    shortcuts: getShortcuts(),
    formatShortcut,
    getModifierKey,
    getAltKey,
    isMac,
    isWindows,
    isLinux,
  };
};

/**
 * Helper function to format keyboard shortcuts consistently
 */
export const formatKeyboardShortcut = (
  keys: string[],
  platform: Platform = 'unknown'
): string => {
  const isMac = platform === 'mac';
  
  return keys
    .map(key => {
      switch (key.toLowerCase()) {
        case 'cmd':
        case 'meta':
          return isMac ? '⌘' : 'Ctrl';
        case 'ctrl':
          return isMac ? '⌃' : 'Ctrl';
        case 'alt':
          return isMac ? '⌥' : 'Alt';
        case 'shift':
          return '⇧';
        case 'enter':
          return '↵';
        case 'tab':
          return '⇥';
        case 'backspace':
          return '⌫';
        case 'delete':
          return isMac ? '⌦' : 'Del';
        case 'escape':
          return 'Esc';
        case 'space':
          return 'Space';
        case 'up':
          return '↑';
        case 'down':
          return '↓';
        case 'left':
          return '←';
        case 'right':
          return '→';
        default:
          return key.toUpperCase();
      }
    })
    .join(isMac ? '' : '+');
};

/**
 * Hook specifically for TipTap editor shortcuts
 */
export const useTipTapShortcuts = () => {
  const { shortcuts, platform, isMac } = useKeyboardShortcuts();

  const editorShortcuts = {
    // Text formatting
    bold: shortcuts.bold,
    italic: shortcuts.italic,
    underline: shortcuts.underline,
    strikethrough: shortcuts.strikethrough,
    highlight: shortcuts.highlight,
    code: shortcuts.code,
    
    // Block formatting
    heading1: `${isMac ? '⌘' : 'Ctrl'}${isMac ? '⌥' : 'Alt'}1`,
    heading2: `${isMac ? '⌘' : 'Ctrl'}${isMac ? '⌥' : 'Alt'}2`,
    heading3: `${isMac ? '⌘' : 'Ctrl'}${isMac ? '⌥' : 'Alt'}3`,
    paragraph: `${isMac ? '⌘' : 'Ctrl'}${isMac ? '⌥' : 'Alt'}0`,
    
    // Lists
    bulletList: `${isMac ? '⌘' : 'Ctrl'}⇧8`,
    orderedList: `${isMac ? '⌘' : 'Ctrl'}⇧7`,
    taskList: `${isMac ? '⌘' : 'Ctrl'}⇧9`,
    
    // Insert
    link: shortcuts.link,
    horizontalRule: `${isMac ? '⌘' : 'Ctrl'}⇧-`,
    codeBlock: `${isMac ? '⌘' : 'Ctrl'}${isMac ? '⌥' : 'Alt'}C`,
    blockquote: `${isMac ? '⌘' : 'Ctrl'}⇧B`,
    
    // Actions
    undo: shortcuts.undo,
    redo: shortcuts.redo,
    find: shortcuts.find,
    selectAll: shortcuts.selectAll,
    save: shortcuts.save,
  };

  return {
    shortcuts: editorShortcuts,
    platform,
    isMac,
    formatShortcut: (keys: string[]) => formatKeyboardShortcut(keys, platform),
  };
};