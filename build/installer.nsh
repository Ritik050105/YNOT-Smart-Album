!ifndef BUILD_UNINSTALLER
!include "nsDialogs.nsh"
Var FontDownloadCheckbox
Var DownloadFonts
Var ScanFontsCheckbox
Var RunFontScan
!macro customHeader
 ShowInstDetails show
!macroend
!macro customPageAfterChangeDir
 Page custom FontOptionsCreate FontOptionsLeave
!macroend
Function FontOptionsCreate
 nsDialogs::Create 1018
 Pop $0
 ${NSD_CreateLabel} 0 0 100% 35u "Optional fonts: download the Google Fonts library now, inside this installer, so YNOT never has to fetch fonts while you work. Progress appears on the installation screen. Internet access is required; this can take a while."
 Pop $0
 ${NSD_CreateCheckbox} 0 50u 100% 24u "Download fonts during installation (optional)"
 Pop $FontDownloadCheckbox
 ${NSD_SetState} $FontDownloadCheckbox $DownloadFonts
 ${NSD_CreateCheckbox} 0 85u 100% 24u "Detect and load the fonts already on this computer during installation (recommended: no slow font scan later)"
 Pop $ScanFontsCheckbox
 ${if} $RunFontScan == "0"
  ${NSD_SetState} $ScanFontsCheckbox ${BST_UNCHECKED}
 ${else}
  ${NSD_SetState} $ScanFontsCheckbox ${BST_CHECKED}
 ${endIf}
 nsDialogs::Show
FunctionEnd
Function FontOptionsLeave
 ${NSD_GetState} $FontDownloadCheckbox $DownloadFonts
 ${NSD_GetState} $ScanFontsCheckbox $0
 ${if} $0 == ${BST_CHECKED}
  StrCpy $RunFontScan "1"
 ${else}
  StrCpy $RunFontScan "0"
 ${endIf}
FunctionEnd

!endif
; Refresh existing shortcuts even when an update keeps their previous locations.
!macro customInstall
  ; Use the final installation path for every registered launcher.
  StrCpy $appExe "$INSTDIR\${APP_EXECUTABLE_FILENAME}"
  ${if} ${FileExists} "$newStartMenuLink"
    CreateShortCut "$newStartMenuLink" "$appExe" "" "$INSTDIR\resources\ynot-app.ico" 0 "" "" "${APP_DESCRIPTION}"
    WinShell::SetLnkAUMI "$newStartMenuLink" "${APP_ID}"
  ${endIf}
  ${if} ${FileExists} "$newDesktopLink"
    CreateShortCut "$newDesktopLink" "$appExe" "" "$INSTDIR\resources\ynot-app.ico" 0 "" "" "${APP_DESCRIPTION}"
    WinShell::SetLnkAUMI "$newDesktopLink" "${APP_ID}"
  ${endIf}
  WriteRegStr SHELL_CONTEXT "${UNINSTALL_REGISTRY_KEY}" "DisplayIcon" '"$appExe",0'
  WriteRegStr SHCTX "Software\Classes\YNOT Album\DefaultIcon" "" '"$INSTDIR\resources\ynot-app.ico",0'
  WriteRegStr SHCTX "Software\Classes\YNOT Album\shell\open\command" "" '"$appExe" "%1"'
  ; Older per-user shortcuts can shadow an all-users upgrade in Windows Search.
  SetShellVarContext current
  ${if} ${FileExists} "$DESKTOP\${SHORTCUT_NAME}.lnk"
    CreateShortCut "$DESKTOP\${SHORTCUT_NAME}.lnk" "$appExe" "" "$INSTDIR\resources\ynot-app.ico" 0 "" "" "${APP_DESCRIPTION}"
    WinShell::SetLnkAUMI "$DESKTOP\${SHORTCUT_NAME}.lnk" "${APP_ID}"
  ${endIf}
  ${if} ${FileExists} "$SMPROGRAMS\${SHORTCUT_NAME}.lnk"
    CreateShortCut "$SMPROGRAMS\${SHORTCUT_NAME}.lnk" "$appExe" "" "$INSTDIR\resources\ynot-app.ico" 0 "" "" "${APP_DESCRIPTION}"
    WinShell::SetLnkAUMI "$SMPROGRAMS\${SHORTCUT_NAME}.lnk" "${APP_ID}"
  ${endIf}
  ${if} ${FileExists} "$APPDATA\Microsoft\Internet Explorer\Quick Launch\User Pinned\TaskBar\${SHORTCUT_NAME}.lnk"
    CreateShortCut "$APPDATA\Microsoft\Internet Explorer\Quick Launch\User Pinned\TaskBar\${SHORTCUT_NAME}.lnk" "$appExe" "" "$INSTDIR\resources\ynot-app.ico" 0 "" "" "${APP_DESCRIPTION}"
    WinShell::SetLnkAUMI "$APPDATA\Microsoft\Internet Explorer\Quick Launch\User Pinned\TaskBar\${SHORTCUT_NAME}.lnk" "${APP_ID}"
  ${endIf}
  ; Font download runs here, in the installer window; the app's bundled Node runs the same script the Mac installer uses.
  ${if} $DownloadFonts == ${BST_CHECKED}
    DetailPrint "Downloading Google Fonts (safe to cancel the download later; it resumes next time)..."
    System::Call 'Kernel32::SetEnvironmentVariable(t "ELECTRON_RUN_AS_NODE", t "1")'
    nsExec::ExecToLog '"$appExe" "$INSTDIR\resources\prepare-fonts.cjs" "$INSTDIR\resources\googleFontsCatalog.json" "$APPDATA\YNOT Album Studio\google-fonts"'
    Pop $0
    System::Call 'Kernel32::SetEnvironmentVariable(t "ELECTRON_RUN_AS_NODE", n)'
    ${if} $0 != 0
      DetailPrint "Font download did not finish (code $0). YNOT will download fonts on first use instead."
    ${endIf}
  ${endIf}
  ; The fonts already on this computer are found here too, in the installer window (a silent install skips the page, and so the scan): the app adopts the list on its first start.
  ${if} $RunFontScan == "1"
    DetailPrint "Detecting fonts on this computer (this can take a few minutes; the app starts with them ready)..."
    System::Call 'Kernel32::SetEnvironmentVariable(t "ELECTRON_RUN_AS_NODE", t "1")'
    nsExec::ExecToLog '"$appExe" "$INSTDIR\resources\scan-local-fonts.cjs" "$APPDATA\YNOT Album Studio\local-fonts.json"'
    Pop $0
    System::Call 'Kernel32::SetEnvironmentVariable(t "ELECTRON_RUN_AS_NODE", n)'
    ${if} $0 != 0
      DetailPrint "Font detection did not finish (code $0). Use Scan PC & connected drives in the font list later."
    ${endIf}
  ${endIf}
  ${if} $installMode == "all"
    SetShellVarContext all
  ${endIf}
  System::Call 'Shell32::SHChangeNotify(i 0x8000000, i 0, i 0, i 0)'
!macroend
