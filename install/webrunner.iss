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
OutputDir=..\build
OutputBaseFilename=prism-win32
SetupIconFile=..\app\chrome\icons\default\webrunner.ico
Compression=lzma
SolidCompression=yes

[Languages]
Name: english; MessagesFile: compiler:Default.isl

[Components]
Name: main; Description: Prism; Types: full compact custom; Flags: fixed
Name: runtime; Description: XUL Runner Runtime; Types: full custom

[Files]
Source: ..\app\webrunner.exe; DestDir: {app}; Components: main; Flags: ignoreversion
Source: ..\app\application.ini; DestDir: {app}; Components: main; Flags: ignoreversion
Source: ..\app\chrome\*; DestDir: {app}\chrome; Components: main; Flags: ignoreversion recursesubdirs createallsubdirs; Excludes: "*.icns,*.xpm"
Source: ..\app\defaults\*; DestDir: {app}\defaults; Components: main; Flags: ignoreversion recursesubdirs createallsubdirs
Source: ..\app\extensions\*; DestDir: {app}\extensions; Components: main; Flags: ignoreversion recursesubdirs createallsubdirs
Source: ..\app\modules\*; DestDir: {app}\modules; Components: main; Flags: ignoreversion recursesubdirs createallsubdirs
Source: ..\app\xulrunner\*; DestDir: {app}\xulrunner; Components: runtime; Flags: ignoreversion recursesubdirs createallsubdirs

[Icons]
Name: {group}\{cm:UninstallProgram,Prism}; Filename: {uninstallexe}

[Registry]
Root: HKCR; Subkey: ".webapp"; ValueType: string; ValueName: ""; ValueData: "WebRunner.App"; Flags: uninsdeletevalue
Root: HKCR; Subkey: "WebRunner.App"; ValueType: string; ValueName: ""; ValueData: "WebRunner Launcher"; Flags: uninsdeletekey
Root: HKCR; Subkey: "WebRunner.App\DefaultIcon"; ValueType: string; ValueName: ""; ValueData: "{app}\chrome\icons\default\webrunner.ico";
Root: HKCR; Subkey: "WebRunner.App\shell\open\command"; ValueType: string; ValueName: ""; ValueData: """{app}\webrunner.exe"" -webapp ""%1""";


