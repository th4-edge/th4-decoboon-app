# 微信小程序自动操作与录屏

本目录用于把装得清官网短视频、产品演示和验收录屏统一切换到**微信开发者工具中的真实小程序**执行。

## 能力组成

1. `miniprogram-automator`：真实小程序运行时导航、点击、输入、滚动和页面读取。
2. 场景 JSON：声明录屏步骤、停留时间、变量和可选操作。
3. `screencapture -l <windowId>`：录制微信开发者工具窗口，保留真实交互过程。
4. `miniprogram-automator.screenshot`：同步采集干净的小程序帧，生成不带开发者工具边框的 MP4。
5. `ffmpeg`：将页面帧生成最终短视频，并校验录制文件。

## 环境要求

- macOS 已允许终端或 Codex 使用“屏幕录制”权限。
- 微信开发者工具已登录，并已信任本地测试项目。
- 本地后端和专用测试企业可用。
- 仅在专用测试环境录制，不使用生产租户、真实客户敏感数据或未授权项目。

## 启动自动化

```bash
/Applications/wechatwebdevtools.app/Contents/MacOS/cli auto \
  --project "$PWD/dist/dev/mp-weixin" \
  --auto-port 9420 \
  --trust-project
```

## 录制老板经营视角

```bash
ZHUANGDEQING_RECORD_DEV_TOKEN="<本地测试员工 devToken>" \
MP_PROJECTID="<本地测试项目ID>" \
npm run record:site
```

## 录制业主同频视角

```bash
ZHUANGDEQING_OWNER_RECORD_TOKEN="<本地测试业主 devToken>" \
MP_PROJECTID="<本地测试项目ID>" \
npm run record:owner
```

## 输出

```text
recordings/<scenario>/<timestamp>/
├── frames/                  # 自动操作后的干净小程序帧
├── page-text/               # 每一步页面文本
├── video/
│   ├── *-clean.mp4          # 由此帧序列生成的官网可用短视频
│   ├── subtitles.srt        # 场景步骤对应的字幕时间轴
│   └── *-window.mov         # 微信开发者工具窗口真实录屏，作为过程证据
└── run.json                 # 场景、窗口、步骤、帧和视频索引
```

如果只需要验证自动化、不启动录屏：

```bash
npm run record:site:dry -- --reuse-session
```

## 规则

- 官网短视频必须来自微信小程序，不得用 Web、H5、接口回放或 Mock 页面冒充。
- 自动操作只使用专用测试企业、测试项目和测试角色。
- `--no-record/--dry-run` 只执行操作和页面采集，不生成视频。
- 默认不执行签署、付款、验收确认、邀请、消息发送和删除等有副作用的动作。
- 有副作用的场景必须单独定义、单独授权，并明确前置数据、正向/反向结果和回滚方式。
- 视频发布前仍需执行业务事实、客户授权、隐私和宣传边界门禁。
