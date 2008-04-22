[Setup]
AppName=Prism
AppVerName=Prism 0.8
AppPublisher=Mozilla
AppPublisherURL=http://www.starkravingfinkle.org
AppSupportURL=http://www.starkravingfinkle.org
AppUpdatesURL=http://www.starkravingfinkle.org
DefaultDirName={pf}\Prism
DefaultGroupName=Prism
AllowNoIcons=yes
OutputDir=.
OutputBaseFilename=prism-win32
SetupIconFile=bin\chrome\icons\default\install-shortcut.ico
Compression=lzma
SolidCompression=yes
PrivilegesRequired=none

[Languages]
Name: english; MessagesFile: compiler:Default.isl

[Components]
Name: main; Description: Prism; Types: full compact custom; Flags: fixed
Name: runtime; Description: XUL Runner Runtime; Types: full custom

[Files]
Source: bin\prism.exe; DestDir: {app}; Components: main; Flags: ignoreversion
Source: bin\application.ini; DestDir: {app}; Components: main; Flags: ignoreversion
Source: bin\chrome\*; DestDir: {app}\chrome; Components: main; Flags: ignoreversion recursesubdirs createallsubdirs; Excludes: "*.icns"
Source: bin\extensions\*; DestDir: {app}\extensions; Components: main; Flags: ignoreversion recursesubdirs createallsubdirs; Excludes: "refractor@developer.mozilla.org\*"
Source: bin\modules\*; DestDir: {app}\modules; Components: main; Flags: ignoreversion recursesubdirs createallsubdirs
Source: bin\xulrunner\*; DestDir: {app}\xulrunner; Components: runtime; Flags: ignoreversion recursesubdirs createallsubdirs

[Icons]
Name: {group}\Prism; Filename: "{app}\prism.exe"; IconFilename: "{app}\chrome\icons\default\install-shortcut.ico"; WorkingDir: "{app}"
Name: {group}\{cm:UninstallProgram,Prism}; Filename: {uninstallexe}

[Registry]
Root: HKCR; Subkey: ".webapp"; ValueType: string; ValueName: ""; ValueData: "Prism.App"; Check: IsAdminLoggedOn; Flags: uninsdeletevalue
Root: HKCR; Subkey: "Prism.App"; ValueType: string; ValueName: ""; ValueData: "Prism Launcher"; Check: IsAdminLoggedOn; Flags: uninsdeletekey
Root: HKCR; Subkey: "Prism.App\DefaultIcon"; ValueType: string; ValueName: ""; ValueData: "{app}\chrome\icons\default\install-shortcut.ico"; Check: IsAdminLoggedOn;
Root: HKCR; Subkey: "Prism.App\shell\open\command"; ValueType: string; ValueName: ""; ValueData: """{app}\prism.exe"" -webapp ""%1"""; Check: IsAdminLoggedOn;


