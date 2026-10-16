# 英语录制节奏助手 v0.3.0

首个可分发版本，面向语录平台的英语对话实时纠错补充录制任务。

## 主要功能

- 自动识别剧本轮次、句末静音时长和红词轮。
- 普通轮读完后提示按标注秒数保持安静。
- 读完红词后固定继续朗读 5 秒，再自动进入该轮句末静音。
- 原平台真实录音区始终排在助手下方，并随助手一起拖动。
- 支持主按钮和页面内全局 `F8`；不占用空格键。
- 支持折叠、关闭和点击浏览器工具栏扩展图标恢复。

## 安装

1. 在本 Release 的 **Assets** 中下载 `english-recording-assistant.zip`。不要下载 GitHub 自动生成的 `Source code (zip)` 或 `Source code (tar.gz)`。
2. 完整解压 ZIP 到不会被随手删除或移动的固定目录，确认该目录第一层可以直接看到 `manifest.json`。安装后不要移动、重命名或删除这个目录。
3. 在浏览器扩展管理页开启开发者模式，选择“加载已解压的扩展程序”：

   - Chrome：`chrome://extensions`
   - Microsoft Edge：`edge://extensions`
   - 联想浏览器：`slbrowser://extensions`

4. 选择刚才的解压目录并刷新语录任务页。

联想浏览器必须在语录任务页使用“极速模式”。IE 模式无法运行这个 Chromium 扩展。

## 已验证环境

- Google Chrome 桌面版
- Microsoft Edge 桌面版

其他 Chromium 桌面浏览器需要支持 Manifest V3 和加载已解压扩展。Firefox、Safari、Internet Explorer、IE 模式和移动端浏览器暂不支持。

联想浏览器已确认可以加载扩展，但尚未在极速模式的真实任务页完成全部录制流程验收。

## 安装包校验

`english-recording-assistant.zip` SHA-256：

```text
EE2876858449F2D21FAEBAD70EBDB02A8B5293FFEBAE3B2997ACFFDDACEE1485
```

## 权限与隐私

本扩展的 API 权限只申请 `storage`，内容脚本只在语录的两个指定域名下运行。它不申请麦克风权限，不读取、保存或上传录音，也不会替代原平台的开始录音、结束、回听和提交操作。

完整安装、使用、更新和故障排查方法请查看项目 `README.md`。
