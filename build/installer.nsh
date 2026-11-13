; DrYAE — sélecteur de langue de l'installateur (anglais par défaut)
!define MUI_LANGDLL_WINDOWTITLE "Installer Language"
!define MUI_LANGDLL_INFO "Please select a language."

!macro preInit
  ; langue proposée par défaut dans la liste : English
  StrCpy $LANGUAGE 1033
!macroend

!macro customInstall
  ; la langue choisie est transmise à DrYAE (lue au premier démarrage).
  ; Non écrite lors d'une mise à jour silencieuse, pour garder la langue de l'utilisateur.
  ${IfNot} ${Silent}
    FileOpen $0 "$INSTDIR\lang.txt" w
    FileWrite $0 "$LANGUAGE"
    FileClose $0
  ${EndIf}
!macroend

!macro customUnInstall
  Delete "$INSTDIR\lang.txt"
  ; 1.7.0 : déclaration « navigateur par défaut » retirée (si l'utilisateur l'avait activée)
  ${IfNot} ${isUpdated}
    DeleteRegValue HKCU "Software\RegisteredApplications" "DrYAE"
    DeleteRegKey HKCU "Software\Clients\StartMenuInternet\DrYAE"
    DeleteRegKey HKCU "Software\Classes\DrYAEURL"
    DeleteRegKey HKCU "Software\Classes\DrYAEHTML"
    DeleteRegKey HKCU "Software\Classes\DrYAEPDF"
  ${EndIf}
!macroend
