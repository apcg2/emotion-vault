@echo off
setlocal EnableExtensions DisableDelayedExpansion
rem Keep this bootstrap ASCII with CRLF, including the file stored in Git.
chcp 65001 >nul
pushd "%~dp0"
if errorlevel 1 goto directory_error
set "EMOTION_NODE="
for /f "delims=" %%N in ('where.exe node.exe 2^>nul') do if not defined EMOTION_NODE set "EMOTION_NODE=%%N"
if defined EMOTION_NODE goto run
if defined ProgramFiles if exist "%ProgramFiles%\nodejs\node.exe" set "EMOTION_NODE=%ProgramFiles%\nodejs\node.exe"
if defined EMOTION_NODE goto run
if defined ProgramW6432 if exist "%ProgramW6432%\nodejs\node.exe" set "EMOTION_NODE=%ProgramW6432%\nodejs\node.exe"
if defined EMOTION_NODE goto run
if defined LocalAppData if exist "%LocalAppData%\Programs\nodejs\node.exe" set "EMOTION_NODE=%LocalAppData%\Programs\nodejs\node.exe"
if defined EMOTION_NODE goto run
if defined NVM_SYMLINK if exist "%NVM_SYMLINK%\node.exe" set "EMOTION_NODE=%NVM_SYMLINK%\node.exe"
if not defined EMOTION_NODE goto node_missing

:run
"%EMOTION_NODE%" "%~dp0scripts\launch.mjs" %*
set "EMOTION_EXIT=%ERRORLEVEL%"
popd
if not "%EMOTION_EXIT%"=="0" pause
exit /b %EMOTION_EXIT%

:node_missing
echo Node.js was not found. Install Node.js 24 LTS for Windows:
echo https://nodejs.org/en/download
echo Then close and reopen this window.
echo First setup in the project folder: npm.cmd ci
echo Then run: npm.cmd run build
echo See README.md for the Chinese installation guide.
popd
pause
exit /b 1

:directory_error
echo Cannot open the project folder. Extract the entire ZIP before starting.
pause
exit /b 1
