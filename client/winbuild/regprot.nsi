OutFile "regprot.exe"

RequestExecutionLevel user

!addplugindir ./

!include FileFunc.nsh
!include StrFunc.nsh
!include UAC.nsh

!insertmacro GetParameters
!insertmacro GetOptions

${StrTok}

Function .onInit
${GetParameters} $R0

${GetOptions} $R0 "/Protocol" $R1
IfErrors 0 +2
GoTo autostart
${StrTok} $R2 $R1 "/" "0" "0"

; Delete the existing entry for this protocol
DeleteRegKey HKLM "SOFTWARE\Classes\$R2"

${GetOptions} $R0 "/Unregister" $R3
IfErrors register +1
GoTo finish

register:
${GetOptions} $R0 "/ApplicationPath" $R1
${StrTok} $R3 $R1 "/" "0" "0"

${GetOptions} $R0 "/ApplicationName" $R4

; Use UAC to elevate privileges on Vista
UAC::RunElevated

; Register our protocol keys
WriteRegStr HKLM "SOFTWARE\Classes\$R2" "EditFlags" 2
WriteRegStr HKLM "SOFTWARE\Classes\$R2" "URL Protocol" ""
; WriteRegStr HKLM "SOFTWARE\Classes\$R2\DefaultIcon" "" "$\"$R3$\",1"
WriteRegStr HKLM "SOFTWARE\Classes\$R2\shell\open\command" "" "$\"$R3$\" -url $\"%1$\""
WriteRegStr HKLM "SOFTWARE\Classes\$R2\shell\open\ddeexec" "" "$\"%1$\",,0,0,,,,"
WriteRegStr HKLM "SOFTWARE\Classes\$R2\shell\open\ddeexec" "NoActivateHandler" ""
WriteRegStr HKLM "SOFTWARE\Classes\$R2\shell\open\ddeexec\Application" "" "$R4"
WriteRegStr HKLM "SOFTWARE\Classes\$R2\shell\open\ddeexec\Topic" "" "WWW_OpenURL"
GoTo finish

autostart:
${GetOptions} $R0 "/AutoStart" $R1
IfErrors 0 +2
GoTo finish
${StrTok} $R2 $R1 "/" "0" "0"

UAC::RunElevated

DeleteRegValue HKCU "Software\Microsoft\Windows\CurrentVersion\Run" "$R2"

${GetOptions} $R0 "/ApplicationPath" $R3
IfErrors finish +1
WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Run" "$R2" "$R3"

finish:
Quit
FunctionEnd

Section
SectionEnd
