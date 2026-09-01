; Inno Setup script — compile with ISCC.exe on Windows
#define AppVersion "0.3.0"

[Setup]
AppId={{A1B2C3D4-E5F6-7890-ABCD-EF1234567890}
AppName=SketchCoder
AppVersion={#AppVersion}
AppPublisher=SketchCoder
DefaultDirName={autopf}\SketchCoder
DefaultGroupName=SketchCoder
OutputDir=..\..\dist
OutputBaseFilename=SketchCoder-Windows-x64-Setup
Compression=lzma2
SolidCompression=yes
ArchitecturesAllowed=x64compatible
ArchitecturesInstallIn64BitMode=x64compatible
PrivilegesRequired=lowest

[Files]
Source: "..\..\dist\SketchCoder-Windows-x64\*"; DestDir: "{app}"; Flags: recursesubdirs

[Icons]
Name: "{group}\SketchCoder"; Filename: "{app}\SketchCoder.exe"
Name: "{userdesktop}\SketchCoder"; Filename: "{app}\SketchCoder.exe"; Tasks: desktopicon

[Tasks]
Name: "desktopicon"; Description: "Create a desktop shortcut"; GroupDescription: "Additional icons:"

[Run]
Filename: "{app}\SketchCoder.exe"; Description: "Launch SketchCoder"; Flags: nowait postinstall skipifsilent
