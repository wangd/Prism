[Setup]
AppName=WebRunner
AppVerName=WebRunner 0.6
AppPublisher=Mozilla
AppPublisherURL=http://www.starkravingfinkle.org
AppSupportURL=http://www.starkravingfinkle.org
AppUpdatesURL=http://www.starkravingfinkle.org
DefaultDirName={pf}\WebRunner
DefaultGroupName=WebRunner
AllowNoIcons=yes
OutputDir=..\build
OutputBaseFilename=webrunner-win32
SetupIconFile=..\app\chrome\icons\default\webrunner.ico
Compression=lzma
SolidCompression=yes

[Languages]
Name: english; MessagesFile: compiler:Default.isl

[Components]
Name: main; Description: WebRunner; Types: full compact custom; Flags: fixed
Name: runtime; Description: XUL Runner Runtime; Types: full custom

[Tasks]
Name: fileassoc; Description: Create associations so WebRunner can automatically launch *.webapp files
Name: gmaildesktopicon; Description: Add GMail web app icon to desktop
Name: gcaldesktopicon; Description: Add Google Calendar web app icon to desktop
Name: gdocsdesktopicon; Description: Add Google Docs && Spreadsheets web app icon to desktop
Name: groupsdesktopicon; Description: Add Google Groups web app icon to desktop
Name: twitterdesktopicon; Description: Add Twitter web app icon to desktop
Name: facebookdesktopicon; Description: Add Facebook web app icon to desktop

[Files]
Source: ..\app\webrunner.exe; DestDir: {app}; Components: main; Flags: ignoreversion
Source: ..\app\application.ini; DestDir: {app}; Components: main; Flags: ignoreversion
Source: ..\app\chrome\*; DestDir: {app}\chrome; Components: main; Flags: ignoreversion recursesubdirs createallsubdirs
Source: ..\app\defaults\*; DestDir: {app}\defaults; Components: main; Flags: ignoreversion recursesubdirs createallsubdirs
Source: ..\app\xulrunner\*; DestDir: {app}\xulrunner; Components: runtime; Flags: ignoreversion recursesubdirs createallsubdirs
Source: .\profiles\gmail.webapp; DestDir: {app}; Components: main; Flags: ignoreversion
Source: .\profiles\gdocs.webapp; DestDir: {app}; Components: main; Flags: ignoreversion
Source: .\profiles\gcalendar.webapp; DestDir: {app}; Components: main; Flags: ignoreversion
Source: .\profiles\groups.webapp; DestDir: {app}; Components: main; Flags: ignoreversion

[Icons]
Name: {group}\{cm:UninstallProgram,WebRunner}; Filename: {uninstallexe}
Name: {userdesktop}\GMail; Filename: {app}\webrunner.exe; Tasks: gmaildesktopicon; Parameters: "-webapp ""{app}\gmail.webapp"""; IconFilename: {app}\chrome\icons\default\gmail.ico
Name: {userdesktop}\Google Calendar; Filename: {app}\webrunner.exe; Tasks: gcaldesktopicon; Parameters: "-webapp ""{app}\gcalendar.webapp"""; IconFilename: {app}\chrome\icons\default\gcalendar.ico
Name: {userdesktop}\Google Docs & Spreadsheets; Filename: {app}\webrunner.exe; Tasks: gdocsdesktopicon; Parameters: "-webapp ""{app}\gdocs.webapp"""; IconFilename: {app}\chrome\icons\default\gdocs.ico
Name: {userdesktop}\Google Groups; Filename: {app}\webrunner.exe; Tasks: groupsdesktopicon; Parameters: "-webapp ""{app}\groups.webapp"""; IconFilename: {app}\chrome\icons\default\groups.ico
Name: {userdesktop}\Twitter; Filename: {app}\webrunner.exe; Tasks: twitterdesktopicon; Parameters: "-webapp ""{app}\twitter.webapp"""; IconFilename: {app}\chrome\icons\default\twitter.ico
Name: {userdesktop}\Facebook; Filename: {app}\webrunner.exe; Tasks: facebookdesktopicon; Parameters: "-webapp ""{app}\facebook.webapp"""; IconFilename: {app}\chrome\icons\default\facebook.ico

[Registry]
Root: HKCR; Subkey: ".webapp"; ValueType: string; ValueName: ""; ValueData: "WebRunner.App"; Tasks: fileassoc; Flags: uninsdeletevalue
Root: HKCR; Subkey: "WebRunner.App"; ValueType: string; ValueName: ""; ValueData: "WebRunner Launcher"; Tasks: fileassoc; Flags: uninsdeletekey
Root: HKCR; Subkey: "WebRunner.App\DefaultIcon"; ValueType: string; ValueName: ""; ValueData: "{app}\chrome\icons\default\webrunner.ico";  Tasks: fileassoc;
Root: HKCR; Subkey: "WebRunner.App\shell\open\command"; ValueType: string; ValueName: ""; ValueData: """{app}\webrunner.exe"" -webapp ""%1"""; Tasks: fileassoc;


