@echo off
setlocal
chcp 65001 >nul
pushd "%~dp0"
if errorlevel 1 goto directory_error
where node.exe >nul 2>&1
if errorlevel 1 goto node_missing

node.exe "%~dp0scripts\launch.mjs" %*
set "EMOTION_EXIT=%ERRORLEVEL%"
popd
if not "%EMOTION_EXIT%"=="0" pause
exit /b %EMOTION_EXIT%

:node_missing
echo 未找到 Node.js。请先安装 Node.js 24，再按 README 完成首次安装和构建。
echo 此启动文件不会自动安装软件，也不会修改系统权限。
popd
pause
exit /b 1

:directory_error
echo 无法打开项目文件夹。请先完整解压项目，不要从压缩包中直接运行。
pause
exit /b 1
