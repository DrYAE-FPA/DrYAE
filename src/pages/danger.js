/* dryae://danger — avertissement avant un site connu pour les arnaques ou les virus */
document.title = TR('Site dangereux') + ' — DrYAE';
const url = new URLSearchParams(location.search).get('u') || '';
let host = ''; try { host = new URL(url).hostname; } catch {}
$('#site').textContent = host || url;
$('#back').onclick = () => { if (history.length > 1) history.back(); else location.href = 'about:blank'; };
$('#more').onclick = () => { $('#go').style.display = 'inline-block'; $('#more').style.display = 'none'; };
$('#go').onclick = async () => { if (!/^https?:/.test(url)) return; await D.call('safeAllow', url); location.href = url; };
setTimeout(() => $('#back').focus(), 50);
