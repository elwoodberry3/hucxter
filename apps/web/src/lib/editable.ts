/**
 * True when the element takes typed text (text-like inputs, textareas, contenteditable). Used to
 * keep the tab bar out of the keyboard's way and to keep single-key shortcuts from firing while
 * someone types (WCAG 2.2 SC 2.1.4).
 */
export function isEditable(element: EventTarget | Element | null): boolean {
  if (!(element instanceof HTMLElement)) return false;
  if (element.isContentEditable || element instanceof HTMLTextAreaElement) return true;
  return (
    element instanceof HTMLInputElement &&
    !['button', 'checkbox', 'radio', 'submit', 'reset', 'range', 'color', 'file'].includes(
      element.type,
    )
  );
}
