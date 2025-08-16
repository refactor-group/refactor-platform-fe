// TipTap v3 Extensions - Using StarterKit + additional extensions
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import Highlight from "@tiptap/extension-highlight";
import TaskList from "@tiptap/extension-task-list";
import TaskItem from "@tiptap/extension-task-item";
import CodeBlockLowlight from "@tiptap/extension-code-block-lowlight";
import Placeholder from "@tiptap/extension-placeholder";
import { TextStyle } from "@tiptap/extension-text-style";
import Collaboration from "@tiptap/extension-collaboration";
import CollaborationCaret from "@tiptap/extension-collaboration-caret";
import { ReactNodeViewRenderer } from "@tiptap/react";
import type { Extensions as TiptapExtensions } from "@tiptap/core";
import CodeBlock from "@/components/ui/coaching-sessions/code-block";
import { createLowlight } from "lowlight";
import { all } from "lowlight";
import { TiptapCollabProvider } from "@hocuspocus/provider";
import { ConfiguredLink } from "./extended-link-extension";
import { generateCollaborativeUserColor } from "@/lib/tiptap-utils";

// Initialize lowlight with all languages
const lowlight = createLowlight(all);

export const Extensions = (
  doc: any,
  provider?: TiptapCollabProvider | null,
  user?: { name: string; color: string }
): TiptapExtensions => {
  console.log('🔧 Creating extensions with:', { hasDoc: !!doc, hasProvider: !!provider, user });
  
  try {
    // Base extensions - conditionally include history based on collaboration
    const baseExtensions: TiptapExtensions = [
      // StarterKit includes: Document, Paragraph, Text, Bold, Italic, Strike, 
      // Heading, BulletList, OrderedList, ListItem, Code, CodeBlock, 
      // Blockquote, HorizontalRule, HardBreak, Dropcursor, Gapcursor, History
      StarterKit.configure({
        // Disable code block from starter kit so we can use our custom one
        codeBlock: false,
        // Disable link from starter kit so we can use our custom configured link
        link: false,
        // Only disable undoRedo when we have both provider AND doc (active collaboration)
        undoRedo: (provider && doc) ? false : undefined,
      }),
      
      // Additional text formatting
      // Underline is included in StarterKit v3, so we don't need to add it separately
      Highlight,
      TextStyle, // Required for text styling in v3
      
      // Task lists
      TaskList,
      TaskItem.configure({
        nested: true,
      }),
      
      // Custom code block with syntax highlighting
      CodeBlockLowlight.extend({
        addNodeView() {
          return ReactNodeViewRenderer(CodeBlock);
        },
      }).configure({ 
        lowlight,
        defaultLanguage: 'plaintext',
      }),
      
      // Placeholder
      Placeholder.configure({
        placeholder: ({ node }) => {
          if (node.type.name === 'heading') {
            return `Heading ${node.attrs.level}...`;
          }
          return 'Start typing your coaching notes...';
        },
      }),
      
      // Links
      ConfiguredLink,
    ];
    
    // History is already included in StarterKit when history: true
    
    const extensions: TiptapExtensions = baseExtensions;
    
    console.log('✅ Base extensions created successfully:', extensions.length);

    // Add collaboration extensions only if doc and provider are properly initialized
    if (doc && provider && typeof doc === 'object' && typeof provider === 'object') {
      try {
        console.log('✅ Initializing collaboration extensions with provider:', provider);
        console.log('📄 Provider validation:', {
          hasProvider: !!provider,
          providerType: typeof provider,
          hasDocument: provider && 'document' in provider,
          documentType: provider && provider.document ? typeof provider.document : 'undefined'
        });
        console.log('📄 Doc object validation:', { 
          hasDoc: !!doc, 
          docType: typeof doc, 
          hasClientID: 'clientID' in doc,
          hasGetXmlFragment: typeof doc.getXmlFragment === 'function'
        });
        
        // Validate that the Y.js document is properly initialized
        if (!doc.clientID && doc.clientID !== 0) {
          console.warn('⚠️ Y.js document missing clientID - may not be properly initialized');
        }
        
        try {
          // Based on TipTap example: use the Y.Doc directly for Collaboration
          const collaborationExt = Collaboration.configure({
            document: doc, // Use the Y.Doc directly as shown in TipTap example
            // Enable Y.js undo manager for collaborative undo/redo
            yUndoOptions: {
              trackedOrigins: [null],
            },
          });
          console.log('✅ Collaboration extension created:', collaborationExt);
          extensions.push(collaborationExt);
          
          // CollaborationCaret uses the provider with enhanced styling
          const collaborationCaretExt = CollaborationCaret.configure({
            provider: provider,
            user: user || {
              name: 'Anonymous',
              color: generateCollaborativeUserColor(),
            },
            render: (user) => {
              const container = document.createElement('span');
              container.classList.add('collaboration-cursor__container');
              container.style.position = 'relative';
              container.style.display = 'inline-block';

              const cursor = document.createElement('span');
              cursor.classList.add('collaboration-cursor__caret');
              cursor.setAttribute('style', `border-color: ${user.color}; --collaboration-user-color: ${user.color};`);

              const label = document.createElement('div');
              label.classList.add('collaboration-cursor__label');
              label.setAttribute('style', `background-color: ${user.color}; --collaboration-user-color: ${user.color};`);
              label.insertBefore(document.createTextNode(user.name), null);

              container.appendChild(cursor);
              container.appendChild(label);

              return container;
            },
          });
          console.log('✅ Collaboration caret extension created:', collaborationCaretExt);
          extensions.push(collaborationCaretExt);
        } catch (extError) {
          console.error('❌ Error creating collaborative extensions:', extError);
          // Don't throw - fallback to non-collaborative mode
          console.warn('⚠️ Falling back to non-collaborative mode due to extension creation error');
        }
        console.log('✅ Collaboration extensions processing completed');
      } catch (error) {
        console.error('❌ Failed to initialize collaboration extensions:', error);
        console.error('❌ Error details:', { doc, provider, user });
        console.warn('⚠️ Continuing without collaboration due to initialization error');
      }
    } else {
      // Only warn if we're expecting collaboration but it failed, not for fallback extensions
      if (doc !== null || provider !== null) {
        console.warn('⚠️ Collaboration not initialized - missing doc or provider:', { doc: !!doc, provider: !!provider });
      }
    }
    
    console.log('🎯 Returning extensions:', extensions.length);
    return extensions;
    
  } catch (error) {
    console.error('❌ Critical error creating extensions:', error);
    // Return minimal safe extensions
    return [StarterKit];
  }
};
