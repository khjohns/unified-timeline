/**
 * Helper function for showing toast messages with automatic dismissal
 *
 * @param setToastMessage - The setter function for the toast message state
 * @param message - The message to display
 * @param duration - How long to show the message in milliseconds (default: 3000)
 *
 * @example
 * ```tsx
 * showToast(setToastMessage, 'Lagret!');
 * showToast(setToastMessage, 'Feil oppstod', 5000);
 * ```
 */
export const showToast = (
  setToastMessage: ((message: string) => void) | undefined,
  message: string,
  duration = 3000
): void => {
  if (!setToastMessage) return;

  setToastMessage(message);
  setTimeout(() => setToastMessage(''), duration);
};
