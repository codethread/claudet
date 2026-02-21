# 002 - Markdown Rendering

**Status**: Implemented
**Created**: 2025-11-02
**Last Updated**: 2025-11-02

## Overview

Add markdown rendering to chat messages in the UI. Messages from both the user and Claude should support basic markdown formatting including headers, bold, italic, code blocks, links, and lists. This will improve readability and allow for richer message content in the chat interface.

## Functional Requirements

- **FR-1**: Install `markdown-to-jsx` library as a dependency
- **FR-2**: Create a reusable `MarkdownMessage` component that renders markdown content
- **FR-3**: Replace plain text rendering in chat messages (line 440 of `src/frontend/APITester.tsx`) with markdown component
- **FR-4**: Support the following markdown features:
  - Headers (H1-H6)
  - Bold text (`**bold**`)
  - Italic text (`*italic*`)
  - Inline code (`` `code` ``)
  - Code blocks with language highlighting (``` ```language ```)
  - Unordered lists
  - Ordered lists
  - Links (`[text](url)`)
  - Blockquotes
- **FR-5**: Configure safe rendering to prevent XSS attacks
- **FR-6**: Style markdown elements to match the existing dark/light theme
- **FR-7**: Ensure external links open in new tabs with `rel="noopener noreferrer"`

## Non-Functional Requirements

- **NFR-1**: Bundle size should remain minimal (markdown-to-jsx adds ~7.5KB gzipped)
- **NFR-2**: Markdown rendering should not significantly impact chat performance
- **NFR-3**: Component should be accessible with proper semantic HTML
- **NFR-4**: Markdown styles should be consistent with existing UI design
- **NFR-5**: Code blocks should have syntax highlighting with appropriate contrast in both themes

## Acceptance Criteria

- **AC-1**: Running `bun add markdown-to-jsx` successfully installs the library
- **AC-2**: A new `MarkdownMessage.tsx` component exists in `src/frontend/components/`
- **AC-3**: Chat messages render markdown with the following verified:
  - `# Header` renders as H1
  - `**bold**` renders as bold text
  - `*italic*` renders as italic text
  - `` `code` `` renders as inline code with distinct styling
  - Code blocks render with appropriate background and font
  - Links are clickable and open in new tabs
  - Lists (both ordered and unordered) render correctly
- **AC-4**: All existing E2E tests pass with markdown rendering enabled
- **AC-5**: New E2E test added to verify markdown rendering in chat messages
- **AC-6**: Dark mode and light mode both display markdown with appropriate contrast
- **AC-7**: Running `bun run validate` passes all checks (type-check, test, test:e2e, build)
- **AC-8**: Screenshots in `tests/screenshots/` are updated to show markdown rendering

## Out of Scope

- Advanced markdown features (tables, task lists, footnotes)
- GitHub Flavored Markdown (GFM) extensions
- LaTeX/math equation rendering
- Mermaid diagram support
- Real-time markdown preview in input field
- Markdown editor/toolbar for composing messages
- Streaming markdown rendering during Claude's response

## Dependencies

None - this is a new feature addition.

## Notes

### Why markdown-to-jsx?

Based on research of available markdown libraries:

1. **Lightweight**: Only 7.5KB gzipped (vs 42.6KB for react-markdown)
2. **Security**: XSS protection by default (no `dangerouslySetInnerHTML`)
3. **React-native**: Returns React components, not HTML strings
4. **TypeScript**: Full TypeScript support with type definitions
5. **Customizable**: Can override rendering for specific elements
6. **Fast**: Suitable for chat applications with frequent updates

### Styling Considerations

- Code blocks should use monospace font (matching existing log display)
- Inline code should have subtle background and padding
- Links should use primary color with hover effect
- Headers should have appropriate sizing and spacing
- Blockquotes should have left border accent
- Lists should have proper indentation

### Component Location

The `MarkdownMessage` component should be created at:
```
src/frontend/components/MarkdownMessage.tsx
```

### Current Implementation Reference

Currently, messages are rendered as plain text in `APITester.tsx:440`:
```tsx
<div className="text-sm whitespace-pre-wrap">{msg.content}</div>
```

This needs to be replaced with:
```tsx
<MarkdownMessage content={msg.content} />
```

### Testing Requirements

E2E tests should verify:
1. Basic markdown formatting renders correctly
2. Links work and open in new tabs
3. Code blocks display with proper styling
4. Markdown works in both user and assistant messages
5. Long messages with complex markdown don't break layout
6. Mobile viewport handles markdown content appropriately
