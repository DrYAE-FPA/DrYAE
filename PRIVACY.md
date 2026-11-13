# Politique de confidentialité / Privacy policy — DrYAE

## Français
DrYAE ne collecte **aucune donnée personnelle**. Il n'y a ni compte, ni statistiques d'utilisation, ni publicité, ni traceur.
Tout ce que vous faites (liste de téléchargements, historique, favoris, mots de passe chiffrés par Windows, réglages) reste **sur votre ordinateur**.

DrYAE se connecte à Internet uniquement :
- pour les **téléchargements et les pages** que vous demandez vous-même ;
- pour **vérifier les mises à jour** sur GitHub (github.com/DrYAE-FPA/DrYAE). Cela se désactive dans Paramètres → À propos → « Rechercher automatiquement les mises à jour » ;
- pour **mettre à jour les listes du bloqueur de publicités** (EasyList, uBlock Origin…). Cela se désactive en coupant le bloqueur dans les paramètres du navigateur ;
- pour **mettre à jour la liste des trackers torrent** publique (github.com/ngosang/trackerslist). Cela se désactive dans Paramètres → Torrents ;
- pour **mettre à jour yt-dlp**, seulement quand vous cliquez sur le bouton prévu ;
- pour le **traducteur** (extension intégrée), seulement quand vous demandez une traduction : le texte à traduire est envoyé au service choisi dans les paramètres (Google Traduction par défaut, DeepL ou LibreTranslate). Le **traducteur de scans** lit le texte des images sur votre PC ; seul le texte trouvé est envoyé pour être traduit. La lecture du texte des images se fait sur votre PC (modèle multilingue fourni avec DrYAE) ; pour certaines écritures (coréen, thaï, arabe, cyrillique…), les données de lecture sont téléchargées la première fois depuis GitHub (tesseract-ocr/tessdata_fast), ou, pour les modèles supplémentaires, depuis huggingface.co / github.com. Le texte tapé dans la fenêtre du traducteur est envoyé au même service pendant que vous écrivez. La détection « texte déjà dans votre langue » se fait sur votre PC ; les captures d'écran des lumières tamisées restent sur votre PC (dossier Images\\DrYAE) ;
- pour la **vérification des mots de passe**, seulement quand vous la lancez : les 5 premiers caractères d'une empreinte SHA-1 de chaque mot de passe sont envoyés au service public Pwned Passwords (api.pwnedpasswords.com). Le mot de passe lui-même ne quitte jamais votre PC.
- pour la **protection contre les sites dangereux** : une fois par semaine, DrYAE télécharge une liste publique de sites d'hameçonnage (Phishing.Database, depuis github.com). La vérification se fait **sur votre PC** : les adresses que vous visitez ne sont envoyées à personne. Cela se désactive dans Paramètres → Confidentialité et sécurité ;
- pour les **modèles de lecture supplémentaires** du traducteur de scans (coréen, cyrillique, arabe, thaï, devanagari), seulement quand vous les demandez : ils sont téléchargés une fois (depuis huggingface.co ou github.com) puis gardés sur votre PC. Les images ne quittent jamais votre PC ;
- pour la **traduction IA des scans** (facultative, désactivée par défaut), seulement si vous l'activez avec **votre propre clé** Google Gemini : l'image de la page et le texte lu sont envoyés à Google (generativelanguage.googleapis.com). La clé reste sur votre PC (chiffrée par Windows). Par défaut, seules les pages difficiles à lire sont envoyées ;
- pour **mettre à jour les extensions Chrome** installées, depuis le Chrome Web Store (désactivable dans les paramètres des extensions) ;
- pour les **icônes des sites**, demandées au site que vous visitez comme le ferait la page elle-même.

Le **refus automatique des bandeaux de cookies**, le **mode lecture**, la **lecture à voix haute**, le **lecteur PDF**, les **pages gardées hors ligne**, les **notes** et l'**import depuis un autre navigateur** fonctionnent entièrement sur votre PC. Le bouton **« Signaler un problème »** crée un petit fichier sur votre Bureau (versions, Windows, dernières erreurs, sans mots de passe, historique ni adresses complètes) : rien n'est envoyé tant que vous ne le joignez pas vous-même à un signalement. L'**export de vos données** crée un fichier sur votre PC (chiffré par un mot de passe si vous y incluez vos mots de passe). Le détail est aussi visible dans Paramètres → Confidentialité et sécurité → « Ce que DrYAE envoie sur internet ».

Ces services ne reçoivent que ce que reçoit n'importe quel site visité : votre adresse IP et le nom du logiciel. DrYAE ne leur envoie aucune information sur vous ni sur vos fichiers.

## English
DrYAE collects **no personal data**: no account, no usage statistics, no ads, no trackers. Your download list, history, bookmarks, passwords (encrypted by Windows) and settings stay **on your computer**.

DrYAE only connects to the Internet:
- for the **downloads and pages you request**;
- to **check for updates** on GitHub. You can turn this off in Settings → About;
- to **update the ad-blocker lists**. Turning the ad blocker off stops this;
- to **update the public torrent tracker list**. You can turn this off in Settings → Torrents;
- to **update yt-dlp**, only when you click the button;
- for the **translator** (built-in extension), only when you ask for a translation: the text is sent to the service chosen in settings (Google Translate by default, DeepL or LibreTranslate). The **image text translator** reads image text on your PC; only the text found is sent for translation. Reading text in images happens on your PC (multilingual model shipped with DrYAE); for some scripts (Korean, Thai, Arabic, Cyrillic…), the reading data is downloaded the first time from GitHub (tesseract-ocr/tessdata_fast). Text typed in the translator window is sent to the same service as you type. Detecting "text already in your language" happens on your PC; dimmed-lights screenshots stay on your PC (Pictures\\DrYAE folder);
- for the **password check-up**, only when you run it: the first 5 characters of a SHA-1 hash of each password are sent to the public Pwned Passwords service (api.pwnedpasswords.com). The password itself never leaves your PC.
- for **dangerous-site protection**: once a week, DrYAE downloads a public list of phishing sites (Phishing.Database, from github.com). The check happens **on your PC**: the addresses you visit are not sent to anyone. You can turn this off in Settings → Privacy and security;
- for the image text translator's **extra reading models** (Korean, Cyrillic, Arabic, Thai, Devanagari), only when you ask for them: they are downloaded once (from huggingface.co or github.com) and then kept on your PC. Images never leave your PC;
- for the optional **AI scan translation** (off by default), only if you turn it on with **your own** Google Gemini key: the page image and the text read are sent to Google (generativelanguage.googleapis.com). The key stays on your PC (encrypted by Windows). By default, only pages that are hard to read are sent;
- to **update installed Chrome extensions** from the Chrome Web Store (can be turned off in the extension settings);
- for **site icons**, requested from the site you visit, as the page itself would.

**Automatic cookie-banner refusal**, **reading mode**, **read aloud**, the **PDF viewer**, **pages kept offline**, **notes** and **import from another browser** run entirely on your PC. The **"Report a problem"** button creates a small file on your Desktop (versions, Windows, latest errors, with no passwords, history or full addresses): nothing is sent unless you attach it to a report yourself. **Exporting your data** creates a file on your PC (encrypted with a password if you include your passwords). The full list is also shown in Settings → Privacy and security → "What DrYAE sends over the internet".

These services only receive what any website receives: your IP address and the software name. Nothing about you or your files is sent.
