; ***** BEGIN LICENSE BLOCK *****
; Version: MPL 1.1/GPL 2.0/LGPL 2.1
;
; The contents of this file are subject to the Mozilla Public License Version
; 1.1 (the "License"); you may not use this file except in compliance with
; the License. You may obtain a copy of the License at
; http://www.mozilla.org/MPL/
;
; Software distributed under the License is distributed on an "AS IS" basis,
; WITHOUT WARRANTY OF ANY KIND, either express or implied. See the License
; for the specific language governing rights and limitations under the
; License.
;
; The Original Code is Mozilla Prism.
;
; Contributor(s):
; Matthew Gertner, <matthew.gertner@gmail.com>
;
; Alternatively, the contents of this file may be used under the terms of
; either the GNU General Public License Version 2 or later (the "GPL"), or
; the GNU Lesser General Public License Version 2.1 or later (the "LGPL"),
; in which case the provisions of the GPL or the LGPL are applicable instead
; of those above. If you wish to allow use of your version of this file only
; under the terms of either the GPL or the LGPL, and not to allow others to
; use your version of this file under the terms of the MPL, indicate your
; decision by deleting the provisions above and replace them with the notice
; and other provisions required by the GPL or the LGPL. If you do not delete
; the provisions above, a recipient may use your version of this file under
; the terms of any one of the MPL, the GPL or the LGPL.
;
; ***** END LICENSE BLOCK *****

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

${GetOptions} $R0 "/DefaultIcon" $R4
IfErrors 0 +2
GoTo finish

${GetOptions} $R0 "/Unregister" $R3
IfErrors register +1
GoTo unregister

register:
${GetOptions} $R0 "/ApplicationPath" $R1
${StrTok} $R3 $R1 "/" "0" "0"

WriteRegStr HKCU "SOFTWARE\Classes\$R2" "EditFlags" 2
WriteRegStr HKCU "SOFTWARE\Classes\$R2" "URL Protocol" ""
WriteRegStr HKCU "SOFTWARE\Classes\$R2" "FriendlyTypeName" ""
WriteRegStr HKCU "SOFTWARE\Classes\$R2\DefaultIcon" "" "$R4"
WriteRegStr HKCU "SOFTWARE\Classes\$R2\shell\open\command" "" "$\"$R3$\" -url $\"%1$\""
GoTo finish

unregister:
ReadRegStr $R5 HKCU "SOFTWARE\Classes\$R2\DefaultIcon" ""
${If} "$R4" == "$R5"
  DeleteRegKey HKCU "SOFTWARE\Classes\$R2"
${EndIf}
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
