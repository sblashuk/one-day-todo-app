# Daylist design language

Daylist should feel calm, focused, and quietly optimistic: a private paper list refined into a modern interface. Preserve the warm editorial character when extending the product. Prefer a few deliberate elements, generous space, and clear hierarchy over dense controls or decorative variety.

`src/styles/index.css` is the executable source of truth for token values, breakpoints, and component styles. This document defines the intent behind those choices and how new interface work should fit them.

## Foundations

### Color

- **Paper and card** form the warm neutral canvas. Use paper for page backgrounds, paper-deep for subtle depth, and card for raised working surfaces.
- **Ink and muted ink** carry primary and supporting text. Keep important content dark and supporting copy visibly quieter while maintaining readable contrast.
- **Forest and sage** provide structure, focus, selected states, and gentle atmospheric color. Forest is the primary action color; sage is a soft supporting surface.
- **Coral** is a small, energetic accent for the brand mark, the add action, and focus emphasis. Reserve it so it continues to signal attention.
- **Line and semantic error colors** separate content and communicate failure. Errors use a pale coral surface with a dark red foreground rather than relying on color alone.

Avoid introducing another accent family when an existing semantic color fits. Use translucency and the existing palette for layers, hover surfaces, and gradients.

### Typography

- Use the system sans-serif stack for interface copy, labels, inputs, counts, and actions.
- Use the display serif stack for page titles, card headings, and expressive empty or error headings.
- Keep display text large, tightly tracked, and compact in line height. Keep body copy comfortable and restrained in width.
- Eyebrows and the brand lockup use small uppercase sans-serif text with bold weight and wide letter spacing.
- Build hierarchy through scale, weight, and spacing. Avoid adding more typefaces or using color as the only distinction.

### Shape, depth, and spacing

- Cards and input groups use softly rounded corners; compact secondary controls may use pills or circles.
- Borders are light and warm. Shadows are broad and low-contrast, used only to separate primary working surfaces from the page.
- Use generous page gutters and vertical space around major sections, with tighter spacing inside a related control or row.
- Decorative geometry stays abstract and quiet: soft gradients, radial washes, and thin rings may support the composition without competing with content.

## Layout

The authentication view is an asymmetric split composition: an expressive brand panel beside a centered form card. The todo view is a single focused column beneath a translucent top bar. Constrain reading and task content rather than stretching it across wide screens.

On tablet and desktop, the profile forms one centered, moderately narrow column for its navigation, heading, and activity card. The twelve-week calendar and empty-state message sit at a smaller readable measure beneath the card's full-width header. On desktop, the profile heading and vertical rhythm should keep the calendar legend visible within a 768px-tall viewport at standard zoom; shorter viewports scroll naturally.

At narrower widths, preserve hierarchy by simplifying the composition:

- Collapse the authentication split into one column and let the form overlap the lower edge of the brand panel.
- Hide supporting brand copy before removing primary identity or instructions.
- Stack the todo heading and count when they no longer fit comfortably.
- Stack the add field and button on small screens, making the action full-width and easy to target.

Prefer fluid sizing with `clamp()` and content-led breakpoints. The interface must remain usable at the existing 320px minimum viewport width and must not introduce horizontal scrolling for ordinary content.

## Interface patterns

- **Primary actions** use solid forest surfaces with white text. The add action uses coral to distinguish the product's central daily action.
- **Secondary actions** are quiet outlined pills or text actions. Destructive actions stay visually subdued until hover or focus reveals their error treatment.
- **Forms** group labels, controls, and field-level errors. Inputs use warm white surfaces, visible borders, and a focus ring. Invalid controls expose both text and accessible state.
- **Lists** read as one card divided into calm, full-width rows. Completion uses a custom circular check plus muted, struck-through text; removal remains a separate labeled action.
- **Status surfaces** retain the same visual language: centered spinners for loading, a dashed and spacious empty state, and tinted banners or cards for retryable errors.
- **Account menus** use a forest initials seal as their compact trigger and a paper popover for Profile and Sign out. Keep the same control on every authenticated screen, derive its initials from the account email, and leave the full email to Profile content rather than the top bar. Menu-local pending and error states must not displace the page's working content.
- **Brand elements** remain minimal: the DAYLIST wordmark, coral leaf-like dot, editorial headline, and short focus-oriented copy.

Reuse these patterns before creating a new component treatment. A new pattern should have a distinct semantic role and should be expressed through the shared theme or a reusable class rather than isolated literal values.

## Interaction and accessibility

- Every interactive control needs a visible hover, focus-visible, disabled, and pending state where applicable.
- Keep focus rings high-contrast and offset from the control. Custom controls must preserve the native input and its keyboard behavior.
- Give icon-only actions an accessible name; decorative marks and symbols stay hidden from assistive technology.
- Initials avatars are buttons, not profile images: expose their account-menu purpose and expanded state, dismiss their menu on outside interaction or Escape, and return focus to the trigger after Escape.
- Pair validation and failures with concise text, `aria-invalid` or alert semantics, and a recovery action when recovery is possible.
- Announce loading and changing counts where useful without making decorative animation audible.
- Preserve semantic headings, labels, lists, buttons, and form controls. Visual restyling must not weaken the rendered-interface test seam.
- Keep transitions short and functional. Motion should confirm interaction, and the interface must remain understandable without it.

## Extending the system

Start from the established palette, type roles, spacing rhythm, and component patterns. Check new work at desktop and small-screen layouts, in default, hover, focus, disabled, pending, empty, and error states that apply. The result is complete when it feels like the same quiet daily workspace and its visible behavior remains accessible and covered at the rendered interface.
