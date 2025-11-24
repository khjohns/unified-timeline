/**
 * Fokuserer på et spesifikt felt og scroller det inn i visning
 * @param fieldId - ID-en til feltet som skal fokuseres
 * @returns true hvis fokusering var vellykket, false ellers
 */
export const focusOnField = (fieldId: string): boolean => {
  const element = document.getElementById(fieldId);

  if (element) {
    // Scroll elementet inn i visning med smooth scrolling
    element.scrollIntoView({
      behavior: 'smooth',
      block: 'center'
    });

    // Fokuser på elementet etter en kort delay for å la scrolling fullføre
    setTimeout(() => {
      element.focus();

      // For input-elementer, vis også cursor
      if (element instanceof HTMLInputElement ||
          element instanceof HTMLTextAreaElement ||
          element instanceof HTMLSelectElement) {
        element.focus();
      }
    }, 300);

    return true;
  }

  return false;
};
