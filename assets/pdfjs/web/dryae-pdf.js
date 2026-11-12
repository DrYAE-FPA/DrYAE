// DrYAE : réglages du lecteur PDF (pdf.js, Mozilla, Apache-2.0) — signature activée, langue de DrYAE
document.addEventListener('webviewerloaded', () => {
  try {
    const O = window.PDFViewerApplicationOptions;
    O.set('enableSignatureEditor', true);
    O.set('enableHighlightFloatingButton', true);
    O.set('isEvalSupported', false);
    const lang = new URLSearchParams(location.search).get('lang');
    if (lang) O.set('localeProperties', { lang });
  } catch (e) { console.error('DrYAE pdf', e); }
});
