@echo off
chcp 65001 >nul
setlocal
pushd "%~dp0"
if errorlevel 1 exit /b 1
set "EMOTION_NODE=node"
where node >nul 2>nul
if not errorlevel 1 goto run
set "EMOTION_NODE=%ProgramFiles%\nodejs\node.exe"
if exist "%EMOTION_NODE%" goto run
set "EMOTION_NODE=%LOCALAPPDATA%\Programs\nodejs\node.exe"
if exist "%EMOTION_NODE%" goto run
set "EMOTION_NODE=%NVM_SYMLINK%\node.exe"
if exist "%EMOTION_NODE%" goto run
echo Node.js was not found. Install Node.js 24, then follow README for first setup.
set "EMOTION_RESULT=1"
goto finish
:run
"%EMOTION_NODE%" scripts\launch.mjs %*
set "EMOTION_RESULT=%ERRORLEVEL%"
:finish
popd
if not "%EMOTION_RESULT%"=="0" pause
exit /b %EMOTION_RESULT%
