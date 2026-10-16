# 发布指南

本文供项目维护者使用。录制人员只需阅读仓库根目录的 `README.md`。

## 发布前检查

1. 确认准备发布的功能和文档已经提交，工作区没有意外改动：

   ```powershell
   git status --short
   ```

2. 确认 `extension/manifest.json` 与 `package.json` 中的版本号一致。本次示例版本为 `0.3.0`。
3. 如果要发布新版本，同时更新：

   - `extension/manifest.json` 的 `version`
   - `package.json` 的 `version`
   - `CHANGELOG.md`
   - 对应版本的 Release 说明

   提交前全局搜索上一版本号，避免 README、更新日志或 Release 文件名遗漏更新。

4. 运行完整验证：

   ```powershell
   npm test
   npm run test:dom
   npm run test:extension
   npm run test:adversarial
   ```

任何一项失败都不要发布。

## 生成与检查安装包

1. 生成 ZIP：

   ```powershell
   powershell -NoProfile -ExecutionPolicy Bypass -File scripts/package-extension.ps1
   ```

2. 查看压缩包内容：

   ```powershell
   tar -tf dist/english-recording-assistant.zip
   ```

3. 必须确认：

   - `manifest.json` 位于 ZIP 根目录，而不是第二层文件夹中。
   - ZIP 内只有扩展运行文件，不包含录音、测试截图、开发缓存或账号信息。
   - `manifest.json` 中的版本号与本次 Git tag 一致。

4. 生成 SHA-256：

   ```powershell
   Get-FileHash dist/english-recording-assistant.zip -Algorithm SHA256
   ```

   将最终哈希写入 Release 描述；如果提供 `.sha256` 附件，也应和 ZIP 一起上传。重新生成 ZIP 后必须重新计算，不能沿用旧值。

## 创建 Git tag

以下命令以 `0.3.0` 为例。先确保当前提交就是准备发布的提交：

```powershell
$version = '0.3.0'
git tag -a "v$version" -m "英语录制节奏助手 v$version"
git push origin "v$version"
```

分支推送方式取决于仓库实际默认分支，不在脚本中假设一定是 `main` 或 `master`。

## 创建 GitHub Release

1. 打开 GitHub 仓库的 **Releases** 页面，选择 **Draft a new release**。
2. 选择刚推送的 tag，例如 `v0.3.0`。
3. Release 标题填写 `英语录制节奏助手 v0.3.0`。
4. 将 [v0.3.0 发布说明](release-notes-v0.3.0.md) 的正文粘贴到描述中。
5. 上传 `dist/english-recording-assistant.zip` 到 **Assets**。
6. 将最终 ZIP 的 SHA-256 写入描述。
7. 不要把 GitHub 自动生成的 `Source code (zip)` 或 `Source code (tar.gz)` 当作安装包。源码包的根目录不是扩展根目录，普通用户无法直接按 README 安装。
8. 核对版本、说明和资产后发布。

## 发布后验收

不要直接使用本地开发目录完成最终验收，应验证用户真正下载到的文件：

1. 从刚发布的 GitHub Release 重新下载 `english-recording-assistant.zip`。
2. 解压到一个新的临时目录。
3. 分别在 Google Chrome 和 Microsoft Edge 中从该目录重新加载扩展。
4. 刷新真实语录任务页，确认：

   - 助手自动出现并正确识别轮次。
   - 原平台录音区出现在助手正下方。
   - 拖动、折叠、关闭和工具栏恢复正常。
   - 普通轮、红词后 5 秒和句末静音流程正常。
   - 原平台开始录音、结束、回听和提交不受影响。

5. 比对下载文件的 SHA-256 与发布前记录。
6. 如果本次仍声明联想浏览器兼容，还应在极速模式下完成同样的任务页冒烟测试；在此之前只标注为“可安装，真实任务页待完整验收”。

如果真实页面识别失败或原平台操作受到影响，应撤回该 Release 或明确标记为预发布，修复并重新完成全部检查后再发布新版本。
