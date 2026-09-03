# 情绪知了 · 本地自动保存版（v0.4.1）

保留五步情绪日志、原版界面和字段、认知扭曲说明、只读历史、删除及趋势分析。**无密码、无加密。双击启动文件打开网页，日志自动保存在项目文件夹，不需要每次选择文件。**

这不是安装包 App，也不再是直接双击 HTML 的版本：用一个很小的 Node.js 本地服务负责保存文件，浏览器负责显示界面。

## 首次安装（可交给 AI Agent）

需要 **Node.js 24 或更高版本，以及随 Node 附带的 npm**。仓库验证版本见 [.nvmrc](.nvmrc)（24.16.0），Windows 和 macOS 都使用同一份源码。已有兼容版本不必重新安装，不要求精确等于验证版本。

1. 缺少 Node 时，从 [Node.js 官方下载页](https://nodejs.org/en/download)安装适合本机系统和 CPU 的 Node.js 24。安装可能需要本人授权；安装后重新打开终端/Agent，使环境变量生效。不要修改已有项目的运行环境或关闭安全防护。
2. [下载源码 ZIP](https://github.com/apcg2/emotion-vault/archive/refs/heads/main.zip)并解压到本人可写的固定文件夹，或用 Git 克隆。下载 ZIP 不需要安装 Git。不要放进系统保护目录或多人共享/自动公开同步目录。
3. 在解压后的项目根目录（能看到 package.json）执行：

```sh
node --version
npm --version
npm ci
npm run build
```

Windows PowerShell 如果阻止 npm.ps1，使用 `npm.cmd ci` 和 `npm.cmd run build`，不要关闭执行策略。首次安装依赖和构建需要联网；日常使用不需要 npm 安装、构建或外网。

**构建成功后会自动记录本次使用的 Node 完整路径到 `.local/node-path.txt`。** 双击启动优先使用该路径，即使系统默认是 Node 22，也不用每天切换版本。已有有效绑定会保留，不因换一个终端重新构建而悄悄更改；此配置只在本机，已从 Git 排除，不进入源码 ZIP。

如果 Agent 使用的是自己的受管 Node，它必须确认这个可执行文件在普通系统终端中也能独立运行、安装位置会保留。不能把“仅在 Agent 内启动成功”当成安装完成；无法保证独立运行时，应从官方来源另行安装一份用户可用的 Node 24，而不是覆盖其他项目的 Node 22。不要修改全局 PATH 来迁就这个项目，不要绕过 Agent 的运行权限。

### 已装好旧版：只修复双击启动

保留 `data/`，更新到 v0.4.1 源码后，让 Agent 用**已经验证的 Node 24 完整路径**执行一次 `scripts/configure-runtime.mjs`。无需为此重装依赖或重建未变的界面。不要直接输入裸 `node`，因为它可能仍指向 Node 22。

例如 Windows PowerShell（先进入实际项目目录，示例 Node 路径须替换为真实路径）：

```powershell
& 'C:\Tools\node24\node.exe' .\scripts\configure-runtime.mjs
cmd /c .\启动.cmd --check
```

Mac 同样用完整路径执行，例如 `/实际路径/node scripts/configure-runtime.mjs`，然后 `zsh ./启动.command --check`。如果原绑定已失效或需要换版本，用新 Node 的完整路径运行 `scripts/configure-runtime.mjs --replace`；只更新 Node 路径，不改日志。不要手写别人的电脑路径或上传 `.local/`。

**最终验收不能只做 `--check` 或健康检查：** 先正常停止 Agent 为这份项目启动的后台服务，再从普通系统终端/桌面实际运行 `启动.cmd` 或 `启动.command`。核对启动窗口显示的 Node 版本与完整路径、浏览器页面正常打开、停止后可再次启动。已有数据只读验证，不自动新增或删除。Agent 无法操作桌面时，应明确请本人双击验收，不能声称已验证。

## 以后每次打开

- **Windows：双击“启动.cmd”。**
- **macOS：双击“启动.command”。** 如果 ZIP 解压后缺少执行权限，让 Agent 为这个文件执行 `chmod +x "启动.command"`，或本人在项目终端运行 `zsh "./启动.command"`。若系统询问权限，由本人确认，不绕过系统保护。
- 自动打开 **[http://localhost:3001/](http://localhost:3001/)**。没有自动打开时，手动访问这个地址。
- 使用期间保留启动窗口。结束时在窗口按 **Ctrl+C**，等待服务退出后再关闭窗口。直接关闭浏览器不会停止本地服务。
- 同一项目已启动时，再次双击只打开网页，不重复启动。3001 被其他程序/另一份项目占用时会明确报错，不会替你结束进程。
- 也可在项目目录使用 `npm start`；`npm start -- --no-open` 不自动打开浏览器。
- 双击或 `npm start` 都优先使用项目绑定的 Node。路径失效时明确报错，不自动回退到系统旧版本；重新配置即可，不必重装依赖。

不要直接打开 `index.html` 或 `dist/emotion-vault.html`：它们需要本地服务才能读写日志。页面会提示正确启动方法，不会退回浏览器存储。

## 日志在哪里

```text
emotion-vault/
├── 启动.cmd                  Windows 日常入口
├── 启动.command              Mac 日常入口
├── dist/emotion-vault.html   首次构建生成的界面
├── .local/node-path.txt     本机专用 Node 路径，不随源码发布
├── data/                    服务首次启动后生成，不随仓库发布
│   ├── logs.json             全部日志，自动读取和保存
│   ├── backups/              每次变更前的明文备份
│   └── .server.lock          运行期间的锁文件
├── app/、components/         界面源码
├── lib/log-document.ts       共享字段及 JSON 格式校验
├── lib/server-client.ts      本地连接；数据只临时保留在页面内存
├── scripts/server.mjs        仅本机可访问的网页和日志接口
├── scripts/store.mjs         磁盘读写、备份、冲突保护
├── scripts/launch.mjs        启动、重复启动检测和打开浏览器
├── scripts/configure-runtime.mjs  首次绑定/修复本机 Node 路径
├── scripts/build-html.mjs    将界面和依赖许可证打包到 HTML
└── test/                    使用隔离合成数据的测试
```

首页显示日志文件完整路径。**清理浏览器不会删除已保存的日志；删除项目 data 文件夹会。** 搬家或备份时必须保留整个 data 目录，不只是源码。

- 没有 data/logs.json 时才创建空日志；已有有效文件会继续读取，绝不自动清空。
- 不读取、迁移、解密或删除旧版浏览器数据、旧版手选 JSON，也不导入模拟记录。旧版本保留在 [v0.2.0](https://github.com/apcg2/emotion-vault/releases/tag/v0.2.0) 和 [v0.3.0](https://github.com/apcg2/emotion-vault/releases/tag/v0.3.0)。
- 保存先生成备份和临时文件，再替换主文件并读回核对；失败不显示成功。响应丢失时要求重新读取并核对，避免盲目重试。
- 其他页面改变记录后，过期的删除请求会被拒绝。请返回首页“重新读取”后重新确认。不要用外部编辑器同时修改数据。
- 格式损坏、超过 16 MB、磁盘空间或权限异常时会停止相应读写并提示；不会把错误当作空数据。单次请求限 1 MB。
- 尚未点击保存的输入可能因刷新、关页、崩溃丢失；自动保存指点击保存后自动写入固定文件，不是草稿实时保存。

## 隐私和备份

**日志、下载副本及自动备份全部是明文。** 能读取这些文件或访问本机服务的人都可以看到内容。共享电脑上请使用独立系统账户及系统磁盘保护。

服务只监听 127.0.0.1，不开放局域网，不部署云端，不使用数据库、遥测或 CDN；页面仅向同源本地服务发送请求。接口检查 Host/Origin，并使用每次启动生成的内存令牌防止其他网站直接读写。这个令牌不是用户密码，也不是加密，无法防止有本机权限的程序访问日志。

- 不使用 localStorage、sessionStorage、IndexedDB 或隐藏缓存作为日志存储。
- `data/` 已加入 Git 忽略规则，**但不要手工上传 data 或含日志的整个项目压缩包**。
- 每次变更前保留备份，包括删除前的内容；“删除日志”不等于从备份中彻底擦除。备份不自动清理，会逐渐占用磁盘空间。
- 定期在停止服务后，将 data 目录复制到另一安全位置。自动备份与主文件在同一磁盘，不能防止磁盘损坏或项目被删。
- “下载副本”下载当前页面已读取的数据，仅作额外备份，不会自动导入。恢复备份前停止服务并另存当前主文件，再由本人确认将选定的有效备份复制为 data/logs.json。

### 异常退出后提示“目录已锁定”

锁文件用于避免两份服务同时写日志，不能盲目删除。

先确认之前的启动窗口已经退出，并让 Agent/本人核对本机进程与 `data/.server.lock` 中的 PID，确认没有服务正在使用**这份项目**；不自动杀进程。确认是异常退出留下的锁后，仅移除该 `data/.server.lock` 再启动。若不确定，停止操作并求助。不要删除 data 目录或 logs.json。

## 可直接复制给 AI Agent 的安装提示词

> 请在我的本地电脑安装并运行 https://github.com/apcg2/emotion-vault 最新源码，不使用旧版 HTML Release。保留原版 UI、功能、字段和交互，不重新设计。先判断 Windows/macOS 和 CPU 架构，检查 Node.js 与 npm；按 README 使用兼容的 Node.js 24 或更高版本，优先保留已有兼容版本，缺少时从官方来源安装，安装授权由我操作。只下载 ZIP 时不必安装 Git。进入含 package.json 的项目根目录，执行 npm ci、npm run build，然后使用 Windows 的启动.cmd 或 macOS 的启动.command；必要时仅为这个 .command 文件补执行权限。确认 http://localhost:3001/ 可访问，告诉我项目路径、data/logs.json 的完整保存位置，以及今后双击启动和 Ctrl+C 停止的方法。新版无密码、无加密，由本地服务自动保存文件，不使用浏览器存储，不需要每次选择 JSON。不读取、迁移、删除或上传旧日志，不导入模拟数据，不覆盖已有 data，不部署云端、不打包 App。验证写入时只能用另建的隔离测试目录和合成数据，不动我的真实日志。若环境只能访问云端容器，先告知，不在那里安装。若权限或运行时 broker 拒绝操作，走正式授权流程一次；仍被拒就停止，给我准确工作目录和需在系统终端执行的命令，不反复探测或绕过限制。

> 启动环境要求：必须使用在普通系统终端中也能独立运行、会长期保留的 Node 24；不能仅借用 Agent 临时环境就宣布完成。构建会记录 .local/node-path.txt；已构建项目可用 Node 24 完整路径执行 scripts/configure-runtime.mjs 修复，已有失效绑定用 --replace。不要覆盖系统 Node 22 或修改全局 PATH。最后正常停止你为本项目启动的后台服务，再通过仓库启动.cmd/启动.command 实际启动，确认显示的 Node 路径和版本正确，并可停止后再次启动；不能只运行 node scripts/launch.mjs 或检查 HTTP 200。无法进行桌面验收时请让我双击并确认。保留 data；本机路径配置不上传 GitHub。

## 源码维护与验证

界面采用 React、Tailwind 和 Recharts；Vite 只用于构建。运行时是 Node 内置 HTTP 和文件系统，没有 Express、数据库、Cloudflare、Next.js 或后台云服务。Node 24 同时运行共享的可擦除 TypeScript 格式校验文件，因此不是完全脱离 Node 的静态交付。

```sh
npm ci
npm run lint
npm test
npm run build
npm start
```

修改源码后重新构建，并停止旧服务再启动；`npm run dev` 是“构建并启动”，不启用热更新。更新前备份 data，停止旧服务，在原目录更新源码并构建，不能覆盖/删除 data。若更换到全新目录，应由本人决定是否携带数据，Agent 不自动迁移。

可选演示页是地址末尾 `#demo-data`，只有明确点击按钮才追加此前七天的标注模拟数据，默认不导入。

[Windows/macOS 自动检查](https://github.com/apcg2/emotion-vault/actions/workflows/windows.yml)同时安装真实 Node 22 和 Node 24，验证旧版本在 PATH 时启动脚本仍选用项目绑定的 Node 24（含中文/空格路径），并通过原生脚本实际启动隔离测试服务。也覆盖失效配置不回退、重新绑定、安装、构建、磁盘读写/备份、接口安全、只读详情。测试只使用临时目录中的合成数据；这不等于已人工验证你的 Windows 桌面、安全弹窗或浏览器组合。

手工验收请用另建的测试副本：双击启动 → 保存合成日志 → 查看只读详情及分析 → Ctrl+C 停止 → 重启确认还在 → 删除 → 重启确认删除生效。日常无需重新安装依赖。
