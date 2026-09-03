@echo off
chcp 65001 >nul
setlocal DisableDelayedExpansion
pushd "%~dp0"
if errorlevel 1 exit /b 1
if exist ".local\node-path.txt" goto configured
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
:configured
set "EMOTION_NODE="
set /p "EMOTION_NODE="<".local\node-path.txt"
if not defined EMOTION_NODE goto invalid
if not exist "%EMOTION_NODE%" goto invalid
goto run
:invalid
echo Project Node configuration is invalid. Use Node 24 to run scripts\configure-runtime.mjs --replace.
set "EMOTION_RESULT=1"
goto finish
:run
"%EMOTION_NODE%" scripts\launch.mjs %*
set "EMOTION_RESULT=%ERRORLEVEL%"
:finish
popd
if not "%EMOTION_RESULT%"=="0" pause
exit /b %EMOTION_RESULT%
