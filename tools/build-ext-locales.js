// Génère extension/_locales/*/messages.json (langue de Chrome, anglais par défaut)
const fs = require('fs'), path = require('path');
const M = {
  extDesc: ['Sends Chrome downloads, detected videos and magnet links to DrYAE.', 'Envoie les téléchargements, les vidéos détectées et les liens magnet de Chrome vers DrYAE.', 'Envía a DrYAE las descargas de Chrome, los vídeos detectados y los enlaces magnet.', 'Envia para o DrYAE as transferências do Chrome, os vídeos detetados e as ligações magnet.', 'Передаёт в DrYAE загрузки Chrome, найденные видео и magnet-ссылки.', 'يرسل إلى DrYAE تنزيلات Chrome ومقاطع الفيديو المكتشفة وروابط magnet.'],
  connected: ['connected', 'connecté', 'conectado', 'ligado', 'подключено', 'متصل'],
  offline: ['offline', 'hors ligne', 'sin conexión', 'offline', 'не в сети', 'غير متصل'],
  offHint: ["DrYAE is not running. Open the app on your PC: downloads will stay in Chrome in the meantime.", "DrYAE n'est pas lancé. Ouvre l'application sur ton PC : les téléchargements resteront dans Chrome en attendant.", 'DrYAE no está abierto. Abre la aplicación en tu PC: mientras tanto, las descargas quedarán en Chrome.', 'O DrYAE não está aberto. Abre a aplicação no teu PC: entretanto, as transferências ficam no Chrome.', 'DrYAE не запущен. Откройте приложение на ПК: пока загрузки останутся в Chrome.', 'DrYAE غير مفتوح. افتح التطبيق على حاسوبك: ستبقى التنزيلات في Chrome في هذه الأثناء.'],
  pageBtn: ["Download this page's video", 'Télécharger la vidéo de cette page', 'Descargar el vídeo de esta página', 'Transferir o vídeo desta página', 'Скачать видео с этой страницы', 'تنزيل فيديو هذه الصفحة'],
  intercept: ['Send Chrome downloads to DrYAE', 'Envoyer les téléchargements de Chrome à DrYAE', 'Enviar las descargas de Chrome a DrYAE', 'Enviar as transferências do Chrome para o DrYAE', 'Отправлять загрузки Chrome в DrYAE', 'إرسال تنزيلات Chrome إلى DrYAE'],
  detected: ['Media detected in this tab', 'Médias détectés sur cet onglet', 'Contenido multimedia detectado en esta pestaña', 'Multimédia detetada neste separador', 'Медиа, найденные в этой вкладке', 'الوسائط المكتشفة في هذه العلامة'],
  playHint: ['Play a video: it will appear here.', "Lance la lecture d'une vidéo : elle apparaîtra ici.", 'Reproduce un vídeo: aparecerá aquí.', 'Reproduz um vídeo: vai aparecer aqui.', 'Запустите видео: оно появится здесь.', 'شغّل فيديو: سيظهر هنا.'],
  dlWith: ['Download with DrYAE', 'Télécharger avec DrYAE', 'Descargar con DrYAE', 'Transferir com o DrYAE', 'Скачать с помощью DrYAE', 'تنزيل باستخدام DrYAE'],
  kVideo: ['video', 'vidéo', 'vídeo', 'vídeo', 'видео', 'فيديو'],
  kAudio: ['audio', 'audio', 'audio', 'áudio', 'аудио', 'صوت'],
  kHls: ['stream', 'flux', 'flujo', 'fluxo', 'поток', 'تدفق'],
  kSub: ['subtitles', 'sous-titres', 'subtítulos', 'legendas', 'субтитры', 'ترجمة'],
  media: ['media', 'média', 'multimedia', 'multimédia', 'медиа', 'وسائط'],
  mLink: ['Download link with DrYAE', 'Télécharger le lien avec DrYAE', 'Descargar el enlace con DrYAE', 'Transferir a ligação com o DrYAE', 'Скачать ссылку с помощью DrYAE', 'تنزيل الرابط باستخدام DrYAE'],
  mPage: ["Download this page's video with DrYAE", 'Télécharger la vidéo de cette page avec DrYAE', 'Descargar el vídeo de esta página con DrYAE', 'Transferir o vídeo desta página com o DrYAE', 'Скачать видео с этой страницы с помощью DrYAE', 'تنزيل فيديو هذه الصفحة باستخدام DrYAE'],
  mSel: ['Download selected link with DrYAE', 'Télécharger le lien sélectionné avec DrYAE', 'Descargar el enlace seleccionado con DrYAE', 'Transferir a ligação selecionada com o DrYAE', 'Скачать выбранную ссылку с помощью DrYAE', 'تنزيل الرابط المحدد باستخدام DrYAE'],
  units: ['B KB MB GB', 'o Ko Mo Go', 'B KB MB GB', 'B KB MB GB', 'Б КБ МБ ГБ', 'بايت ك.ب م.ب ج.ب'],
};
const LOC = [['en'], ['fr'], ['es'], ['pt_PT', 'pt_BR'], ['ru'], ['ar']];
const base = path.join(__dirname, '..', 'extension', '_locales');
fs.rmSync(base, { recursive: true, force: true });
LOC.forEach((codes, i) => {
  const j = Object.fromEntries(Object.entries(M).map(([k, v]) => [k, { message: v[i] }]));
  for (const c of codes) { fs.mkdirSync(path.join(base, c), { recursive: true }); fs.writeFileSync(path.join(base, c, 'messages.json'), JSON.stringify(j, null, 1)); }
});
console.log('ok');
