# UI Design Mockups: Enhanced Coaching Notes Toolbar
## Based on TipTap SimpleEditor Template

---

## 1. Design Overview

### 1.1 Design Principles
- **Progressive Disclosure**: Show common tools first, advanced features on-demand
- **Context-Aware**: Toolbar adapts based on selection and content type
- **Mobile-First**: Touch-optimized with responsive breakpoints
- **Coaching-Focused**: Quick access to session-specific tools

### 1.2 Toolbar Architecture
```
┌─────────────────────────────────────────────────────────────────┐
│ Primary Toolbar (Always Visible)                               │
├─────────────────────────────────────────────────────────────────┤
│ Secondary Toolbar (Contextual)                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## 2. Desktop Toolbar Design

### 2.1 Primary Toolbar - Default State
```
┌──────────────────────────────────────────────────────────────────────────────┐
│ ┌──────────┬───────────────┬──────────────┬────────────┬─────────┬────────┐ │
│ │ Template │ Text Format   │ Lists        │ Insert     │ Coach   │ More   │ │
│ │    ▼     │ B I U S ─ 🎨 │ • 1. ☑       │ 🔗 📷 📊    │ 💡 ✅    │  ⋯     │ │
│ └──────────┴───────────────┴──────────────┴────────────┴─────────┴────────┘ │
│                                                                              │
│ ┌──────────────────────────────────────────────────────────────────────┐   │
│ │                         Editor Content Area                          │   │
│ │                                                                       │   │
│ └──────────────────────────────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────────────────────────────────┘
```

### 2.2 Detailed Toolbar Groups

#### Group 1: Template Selector (Coaching-Specific)
```
┌─────────────────┐
│ 📝 Template  ▼  │ ← Click to expand
└─────────────────┘
        ↓
┌──────────────────────────┐
│ 🎯 Initial Session       │
│ 📅 Regular Check-in      │
│ 🎖️ Goal Review          │
│ 🔄 Retrospective         │
│ 📋 Action Planning       │
│ ─────────────────────    │
│ ➕ Create Custom...      │
│ 📁 Manage Templates...   │
└──────────────────────────┘
```

#### Group 2: Text Formatting
```
┌─────────────────────────────────┐
│  B  │  I  │  U  │  S  │  H  │ 🎨│  ← Individual toggle buttons
└─────────────────────────────────┘
 Bold  Italic Under Strike High Color

Color Picker Dropdown:
┌──────────────────┐
│ Text Color       │
│ ● ● ● ● ● ● ●   │
│ ● ● ● ● ● ● ●   │
│ Background       │
│ ○ ○ ○ ○ ○ ○ ○   │
└──────────────────┘
```

#### Group 3: Paragraph Formatting
```
┌──────────────────────────────┐
│ ¶ Normal  ▼ │ ≡ │ ≡ │ ≡ │ ≡ │
└──────────────────────────────┘
      ↓         Left Center Right Justify
┌─────────────┐
│ ¶ Paragraph │
│ H1 Title    │
│ H2 Heading  │
│ H3 Subhead  │
│ " Quote     │
│ 💡 Callout  │
└─────────────┘
```

#### Group 4: Lists & Tasks
```
┌────────────────────┐
│  •  │  1. │  ☑  │  │  ← List types
└────────────────────┘
Bullet Ordered Tasks

Task List Special Features:
- Auto-converts "- [ ]" to checkbox
- Keyboard shortcut: Cmd+Shift+X
- Supports nested tasks
```

#### Group 5: Insert Menu
```
┌─────────────────────┐
│  🔗  │  📷  │  📊  │  ← Insert elements
└─────────────────────┘
 Link  Image  Table

Extended Insert (via dropdown):
┌────────────────────┐
│ 🔗 Link           │
│ 📷 Image          │
│ 📊 Table          │
│ ─────────────     │
│ 📹 Video          │
│ 💻 Code Block     │
│ ➖ Divider        │
│ 📝 Note Box       │
│ ⚠️ Alert Box      │
└────────────────────┘
```

#### Group 6: Coaching Tools (Unique Features)
```
┌──────────────────────────┐
│  💡  │  ✅  │  👥  │  📌  │
└──────────────────────────┘
Action Summary Mention Bookmark

Action Item Quick Add:
┌─────────────────────────────┐
│ ✅ Create Action Item       │
│ ┌─────────────────────────┐ │
│ │ Description...          │ │
│ └─────────────────────────┘ │
│ Owner: [Select...]    Due: []│
│ [Create] [Cancel]           │
└─────────────────────────────┘
```

### 2.3 Contextual/Floating Toolbar
```
When text is selected:
┌─────────────────────────────────────┐
│  B  I  U  │  🔗  │  💬  │  🎨  │  ⋯  │
└─────────────────────────────────────┘
         ↑
    Appears above selection

When hovering over link:
┌──────────────────────────────┐
│ 🔗 example.com               │
│ [Edit] [Unlink] [Open]       │
└──────────────────────────────┘
```

---

## 3. Mobile Toolbar Design

### 3.1 Mobile Primary Toolbar (Collapsed)
```
┌─────────────────────────────────┐
│ ┌───┬─────────────────────┬───┐ │
│ │ ≡ │   Coaching Notes    │ ⋯ │ │
│ └───┴─────────────────────┴───┘ │
│ ┌─────────────────────────────┐ │
│ │ B I U │ • │ 🔗 │ 💡 │ ▶    │ │
│ └─────────────────────────────┘ │
└─────────────────────────────────┘
   Menu    Essential Tools    More
```

### 3.2 Mobile Expanded Toolbar (Swipe Up)
```
┌─────────────────────────────────┐
│ ┌─────────────────────────────┐ │
│ │      Text Formatting        │ │
│ │  B   I   U   S   H   🎨     │ │
│ └─────────────────────────────┘ │
│ ┌─────────────────────────────┐ │
│ │         Lists               │ │
│ │   •    1.    ☑              │ │
│ └─────────────────────────────┘ │
│ ┌─────────────────────────────┐ │
│ │         Insert              │ │
│ │  🔗   📷   📊   💻           │ │
│ └─────────────────────────────┘ │
│ ┌─────────────────────────────┐ │
│ │      Coaching Tools         │ │
│ │  💡   ✅   👥   📌           │ │
│ └─────────────────────────────┘ │
└─────────────────────────────────┘
```

### 3.3 Mobile Context Menu (Long Press)
```
On text selection:
┌─────────────────┐
│ Cut             │
│ Copy            │
│ Paste           │
│ ───────────     │
│ Bold            │
│ Italic          │
│ Link...         │
│ Comment...      │
│ ───────────     │
│ Create Action   │
└─────────────────┘
```

---

## 4. Advanced Features UI

### 4.1 AI Assistant Panel
```
┌──────────────────────────────────────────────┐
│ 🤖 AI Assistant                         [×]  │
├──────────────────────────────────────────────┤
│ Quick Actions:                               │
│ ┌──────────────┬──────────────┐             │
│ │ Summarize    │ Extract      │             │
│ │ Session      │ Actions      │             │
│ └──────────────┴──────────────┘             │
│ ┌──────────────┬──────────────┐             │
│ │ Improve      │ Generate     │             │
│ │ Writing      │ Follow-up    │             │
│ └──────────────┴──────────────┘             │
│                                              │
│ Custom Prompt:                               │
│ ┌────────────────────────────────┐          │
│ │ Ask AI anything...              │          │
│ └────────────────────────────────┘          │
│                    [Send]                    │
└──────────────────────────────────────────────┘
```

### 4.2 Template Builder Interface
```
┌──────────────────────────────────────────────────────┐
│ Template Builder                               [×]   │
├──────────────────────────────────────────────────────┤
│ Template Name: [____________________]               │
│                                                      │
│ Sections:                                           │
│ ┌──────────────────────────────────────────────┐   │
│ │ 1. Meeting Objectives                    [⚙️] │   │
│ │    Placeholder: {{session.goals}}            │   │
│ └──────────────────────────────────────────────┘   │
│ ┌──────────────────────────────────────────────┐   │
│ │ 2. Discussion Points                     [⚙️] │   │
│ │    • {{auto.previous_actions}}               │   │
│ └──────────────────────────────────────────────┘   │
│ ┌──────────────────────────────────────────────┐   │
│ │ 3. Action Items                          [⚙️] │   │
│ │    ☑ Task list here...                       │   │
│ └──────────────────────────────────────────────┘   │
│                                                      │
│ [+ Add Section]                                     │
│                                                      │
│ Available Variables:                                │
│ {{date}} {{coach.name}} {{coachee.name}}           │
│ {{session.number}} {{goals.current}}               │
│                                                      │
│ [Save Template] [Preview] [Cancel]                  │
└──────────────────────────────────────────────────────┘
```

### 4.3 Collaboration Sidebar
```
┌─────────────────────┐
│ Collaborators    2  │
├─────────────────────┤
│ 👤 Sarah Chen      │
│ 🟢 Active now      │
│ Cursor: Line 42    │
│                    │
│ 👤 Alex Kumar      │
│ 🟡 Idle (2 min)    │
│ Last: Line 18      │
├─────────────────────┤
│ Comments        3  │
├─────────────────────┤
│ 💬 Sarah: "Let's   │
│ focus on the Q2    │
│ goals here"        │
│ └─ Reply...        │
│                    │
│ 💬 Alex: "Added    │
│ action items"      │
│ └─ ✓ Resolved      │
└─────────────────────┘
```

---

## 5. Responsive Behavior

### 5.1 Breakpoint Behaviors
```
Desktop (>1024px):
- Full toolbar with all groups visible
- Floating toolbar on selection
- Sidebars for outline/comments

Tablet (768-1024px):
- Grouped toolbar with dropdowns
- Essential tools visible, rest in "More"
- Collapsible sidebars

Mobile (<768px):
- Minimal toolbar with expandable drawer
- Context menu on long-press
- Full-screen editing mode option
```

### 5.2 Touch Gestures
```
Swipe Right → Undo
Swipe Left → Redo
Swipe Up → Show toolbar
Swipe Down → Hide toolbar
Pinch → Zoom text
Long Press → Context menu
Double Tap → Select word
Triple Tap → Select paragraph
```

---

## 6. Keyboard Shortcuts Overlay

### 6.1 Shortcut Helper (? or Cmd+/)
```
┌──────────────────────────────────────────────┐
│ Keyboard Shortcuts                     [×]   │
├──────────────────────────────────────────────┤
│ Text Formatting                              │
│ Cmd+B          Bold                          │
│ Cmd+I          Italic                        │
│ Cmd+U          Underline                     │
│ Cmd+Shift+S    Strikethrough                 │
│ Cmd+Shift+H    Highlight                     │
│                                              │
│ Coaching Features                            │
│ Cmd+Shift+A    Create Action Item            │
│ Cmd+Shift+M    Insert @Mention               │
│ Cmd+E          Generate Summary              │
│ Cmd+T          Apply Template                │
│                                              │
│ Navigation                                   │
│ Cmd+F          Find in Document              │
│ Cmd+G          Go to Next                   │
│ Cmd+[          Decrease Indent               │
│ Cmd+]          Increase Indent               │
└──────────────────────────────────────────────┘
```

---

## 7. Status Bar Design

### 7.1 Desktop Status Bar
```
┌────────────────────────────────────────────────────────────┐
│ 📝 1,247 words │ 5 min read │ 💾 Saved │ 👥 2 active │ ⚡ │
└────────────────────────────────────────────────────────────┘
   Word count    Read time    Save status  Collaborators  AI
```

### 7.2 Mobile Status Bar (Minimal)
```
┌──────────────────────────┐
│ 1.2k words │ 💾 │ 👥 2  │
└──────────────────────────┘
```

---

## 8. Theme Variations

### 8.1 Light Theme
```css
/* Toolbar */
--toolbar-bg: #FFFFFF;
--toolbar-border: #E5E7EB;
--button-bg: transparent;
--button-hover: #F3F4F6;
--button-active: #3B82F6;
--text-primary: #111827;
--text-secondary: #6B7280;

/* Editor */
--editor-bg: #FFFFFF;
--editor-text: #111827;
--selection-bg: #DBEAFE;
```

### 8.2 Dark Theme
```css
/* Toolbar */
--toolbar-bg: #1F2937;
--toolbar-border: #374151;
--button-bg: transparent;
--button-hover: #374151;
--button-active: #3B82F6;
--text-primary: #F9FAFB;
--text-secondary: #9CA3AF;

/* Editor */
--editor-bg: #111827;
--editor-text: #F9FAFB;
--selection-bg: #1E3A8A;
```

### 8.3 High Contrast (Accessibility)
```css
/* Maximum contrast for visibility */
--toolbar-bg: #000000;
--toolbar-border: #FFFFFF;
--button-bg: #000000;
--button-hover: #FFFFFF;
--button-active: #FFFF00;
--text-primary: #FFFFFF;
--text-secondary: #FFFF00;
```

---

## 9. Animation & Micro-interactions

### 9.1 Toolbar Animations
```
Button Press:
- Scale: 0.95
- Duration: 150ms
- Easing: ease-out

Dropdown Open:
- Slide down: 200ms
- Fade in: 150ms
- Easing: cubic-bezier(0.4, 0, 0.2, 1)

Tool Switch:
- Morph transition: 200ms
- Color fade: 150ms
```

### 9.2 Feedback Animations
```
Action Item Created:
✅ → Scale from 0 → Bounce → Settle (400ms)

Auto-save Indicator:
💾 → Pulse (2s interval) → Checkmark → Fade

Collaboration Cursor:
- Smooth position: 16ms updates
- Name tag fade: 200ms
- Color pulse on typing
```

---

## 10. Implementation Components

### 10.1 Component Structure (React/TypeScript)
```typescript
// Main Toolbar Component
<EditorToolbar>
  <ToolbarGroup name="templates">
    <TemplateSelector />
  </ToolbarGroup>
  
  <ToolbarGroup name="formatting">
    <BoldButton />
    <ItalicButton />
    <UnderlineButton />
    <StrikeButton />
    <HighlightButton />
    <ColorPicker />
  </ToolbarGroup>
  
  <ToolbarGroup name="paragraph">
    <HeadingDropdown />
    <AlignmentButtons />
  </ToolbarGroup>
  
  <ToolbarGroup name="lists">
    <BulletListButton />
    <OrderedListButton />
    <TaskListButton />
  </ToolbarGroup>
  
  <ToolbarGroup name="insert">
    <LinkButton />
    <ImageButton />
    <TableButton />
    <MoreInsertOptions />
  </ToolbarGroup>
  
  <ToolbarGroup name="coaching">
    <ActionItemButton />
    <SummaryButton />
    <MentionButton />
    <BookmarkButton />
  </ToolbarGroup>
  
  <ToolbarGroup name="more">
    <MoreOptionsMenu />
  </ToolbarGroup>
</EditorToolbar>
```

### 10.2 Responsive Container
```typescript
const ResponsiveToolbar = () => {
  const isMobile = useMediaQuery('(max-width: 768px)');
  const isTablet = useMediaQuery('(max-width: 1024px)');
  
  if (isMobile) {
    return <MobileToolbar />;
  }
  
  if (isTablet) {
    return <TabletToolbar />;
  }
  
  return <DesktopToolbar />;
};
```

---

## 11. Accessibility Features

### 11.1 ARIA Labels
```html
<button 
  aria-label="Bold text"
  aria-pressed="true"
  role="button"
  tabindex="0"
>
  <BoldIcon />
</button>

<div 
  role="toolbar"
  aria-label="Text formatting"
  aria-orientation="horizontal"
>
  <!-- Toolbar buttons -->
</div>
```

### 11.2 Keyboard Navigation
- Tab: Navigate between toolbar groups
- Arrow keys: Navigate within groups
- Enter/Space: Activate button
- Escape: Close dropdowns/dialogs
- F10: Focus toolbar

---

## 12. Performance Optimizations

### 12.1 Lazy Loading
```typescript
// Load advanced features on-demand
const AIAssistant = lazy(() => import('./AIAssistant'));
const TemplateBuilder = lazy(() => import('./TemplateBuilder'));
const TableEditor = lazy(() => import('./TableEditor'));
```

### 12.2 Virtualization
- Virtual scrolling for long documents
- Render only visible toolbar buttons
- Defer non-critical UI updates

---

## Summary

This comprehensive toolbar design leverages the TipTap SimpleEditor template while adding coaching-specific features:

**Key Enhancements:**
1. **Template System** - Quick access to coaching templates
2. **Coaching Tools** - Action items, summaries, mentions
3. **Mobile-First** - Touch-optimized with gestures
4. **AI Integration** - Smart assistance panel
5. **Collaboration** - Real-time presence and comments
6. **Accessibility** - WCAG AAA compliant
7. **Performance** - Lazy loading and virtualization

The design maintains the simplicity of the SimpleEditor while providing powerful features for professional coaching sessions. The progressive disclosure pattern ensures new users aren't overwhelmed while power users have quick access to advanced features.