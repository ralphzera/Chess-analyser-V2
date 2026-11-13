' ============================================================================
' ChessCoach Pro — Aplicativo 100% Local (Sem Servidor / Sem Localhost)
' Abre diretamente do disco rigido como janela de aplicativo nativo
' ============================================================================
Option Explicit

Dim fso, shell, appDir, htmlPath, fileUrl

Set fso = CreateObject("Scripting.FileSystemObject")
Set shell = CreateObject("WScript.Shell")
appDir = fso.GetParentFolderName(WScript.ScriptFullName)
htmlPath = appDir & "\public\index.html"
fileUrl = "file:///" & Replace(htmlPath, "\", "/")

On Error Resume Next
Err.Clear
shell.Run "msedge.exe --app=""" & fileUrl & """", 1, False
If Err.Number <> 0 Then
  Err.Clear
  shell.Run "chrome.exe --app=""" & fileUrl & """", 1, False
  If Err.Number <> 0 Then
    shell.Run """" & htmlPath & """", 1, False
  End If
End If
On Error GoTo 0
