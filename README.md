# dsh-inkwell

English | [中文](#中文)

A DeepSeek Harness plugin that adds a one-click prompt-enhance button to the composer toolbar. It rewrites the draft prompt into a clearer, fuller, directly executable version — keeping the original intent and language — and lets you revert to exactly what you had before.

The button sits in the composer's trailing control row, immediately before the model picker.

---

## Features

- **One-click enhancement.** Click the ✦ button and the draft is replaced by an enhanced version, produced through the Harness LLM route.
- **Four-state glyph.** The icon morphs from a star, to a spinner ring while the request runs, to a revert arrow once a result lands. All four states share the same transparent button base as their neighbours, so the toolbar row never shifts or changes shape.
- **Revert.** After a successful enhancement the glyph becomes a revert arrow; clicking it restores the exact pre-enhancement draft. Repeated enhance/revert cycles do not leak state between them.
- **Style keywords.** A settings page holds free-form style keywords that shape how the rewrite is written — tone, register, level of detail.
- **Independent enhancement model.** Choose which model the rewrite runs on, in the same settings page. This choice is independent of the agent's own model selection and never changes it. When left unset, the agent's current model is used.
- **Bilingual UI.** English and Chinese, following the harness locale.

## Installation

### From the Harness UI

Open **Settings → Plugins → Add plugin**, enter the repository URL, and install:

```
https://github.com/2750599332-art/dsh-inkwell
```

### Using the `dsh` CLI

```sh
dsh plugin add https://github.com/2750599332-art/dsh-inkwell
```

### From a local checkout

Point the Harness at the checkout directory, or add it as a bundle in your profile. The package declares `dsh.bundle`, which is what makes it installable.

## Usage

1. Type or paste a prompt in the composer.
2. Click the ✦ button in the tool row.
3. The draft is replaced with the enhanced prompt once the model responds.
4. Click the revert arrow to go back to your original text, or just edit the result and keep going.

The button is disabled while the composer is empty, and while an enhancement is already in flight. A second enhancement after a revert snapshots the draft as it stood immediately before *that* enhancement.

## Settings

**Settings → Plugins → Prompt enhancer** (or the settings section named by the plugin's locale entry).

### Style keywords

One keyword per line, for example:

```
concise
formal tone
beginner friendly
```

These affect *how* the prompt is written — its register, tone, and level of detail. They cannot make the rewrite add a technology or a requirement the original text did not mention; that boundary is enforced in the instruction and in a post-generation check. Leaving the box empty keeps the default behaviour.

Saved immediately to `<DSH_HOME>/prompt-enhancer/keywords.json`. Saving keywords and saving the model are independent: one never overwrites the other.

### Enhancement model

A dropdown listing the models the signed-in account currently offers, read live from the Harness LLM service each time the page opens — the plugin keeps no hard-coded model list. The first option, **Use the agent's current model**, is the default.

Model precedence, highest first:

1. the model chosen here
2. this plugin's row `provider` / `model` config pair, if set
3. the agent's own default selection

Saving a model that the account no longer offers is rejected with `unknown-model` rather than silently becoming a route that fails at request time.

## Behaviour notes

- **Language consistency.** Chinese in, Chinese out; English in, English out; mixed input stays naturally mixed. The rewrite never translates and never adds a parallel translation.
- **Output discipline.** The enhanced text is returned on its own — no preamble, no label, no code fence. A near-no-op result (barely longer than the input) triggers exactly one retry, and a reply that invents a technology or requirement the original did not mention triggers one corrective retry, bounded at two model calls.
- **Clean endings.** A reply truncated by the output cap is cut back to its last complete sentence rather than left mid-clause.
- **Send clears the revert.** Submitting the composer content cancels the pending revert; clearing the box by hand does not.

## Requirements

- DeepSeek Harness with the Web GUI (`webServer`) and an LLM adapter (`llm`). Without either, the plugin stays inactive instead of failing to boot.
- The host half is plain ESM using Node builtins only. There are no runtime dependencies.

## Architecture

Two halves, loaded by one bundle patch:

| Half | File | Responsibilities |
|---|---|---|
| Host | `index.js` | Three loopback HTTP routes; route resolution; keyword/model persistence; the rewrite pipeline and its output checks |
| Client | `client.js` | The toolbar button (four-state glyph, revert state machine); the settings page (keywords, model picker, save/retry states) |

### HTTP routes

All three are `exact` routes on the Harness web carrier, admitted only for loopback requests (a `Host`/`Origin` check rejects DNS-rebinding and foreign origins).

| Method | Path | Purpose |
|---|---|---|
| `POST` | `/plugins/prompt-enhancer/enhance` | `{ text, locale? }` → `{ ok: true, prompt }` or `{ ok: false, error, code }` |
| `GET` / `POST` | `/plugins/prompt-enhancer/settings` | `GET` → `{ keywords, model }`; `POST` accepts either field, returns both |
| `GET` | `/plugins/prompt-enhancer/models` | `{ ok: true, groups: [{ provider, name, models: [{ id, name }] }] }` |

### Limits

| Limit | Value |
|---|---|
| Input text | 8 000 characters (`413 text-too-long` beyond) |
| Request body | 256 KiB (`413 body-too-large`) |
| Output target | ~800 characters (soft; complete text is preferred over a hard cut) |
| Model calls per click | at most 2 (the initial attempt plus one bounded retry) |
| Client request watchdog | 120 s, above the 90 s host budget so a slow-but-healthy call still gets the host's own error |

### Files

```
index.js            host half
client.js           client half
cordis.patch.yml    bundle patch — the row that loads this package
locale/en.json      English UI strings
locale/zh.json      Chinese UI strings
icon.svg            plugin icon
revert.png          the revert glyph artwork (supplied asset, used as-is)
revert-mask.png     alpha mask derived from the artwork, so the glyph paints in currentColor
```

## Uninstall

Remove the bundle from your profile, or via the Plugins page. The keyword/model document is user data and stays at `<DSH_HOME>/prompt-enhancer/keywords.json` — delete it manually if you want a clean slate.

## License

MIT

---

<a id="中文"></a>
# 中文

一个 DeepSeek Harness 插件：在输入框工具栏加一个一键提示词增强按钮，把草稿提示词改写成更清晰、更完整、可直接执行的版本，并保留原意与原语言，且随时可以撤回。

按钮位于输入框右侧控制行，紧邻模型选择器之前。

## 功能

- **一键增强** — 点击 ✦ 按钮，草稿经 Harness 的 LLM 路由改写为更完整的版本。
- **四态图标** — 星形 → 旋转圆环（请求中）→ 撤回箭头（已完成）。四态共用与邻居一致的透明按钮底，工具行不位移、不变形。
- **撤回** — 增强成功后图标变为撤回箭头，点击即恢复到增强前的原文；反复增强/撤回不会串状态。
- **风格关键词** — 设置页可填任意风格关键词，影响改写的语气、风格与详细程度。
- **独立的优化模型** — 在设置页单独指定改写所用的模型，与智能体自身的模型选择互不影响；不设置时跟随智能体当前模型。
- **中英双语界面** — 跟随 Harness 的语言设置。

## 安装

在 **设置 → 插件 → 添加插件** 中填入仓库地址并安装：

```
https://github.com/2750599332-art/dsh-inkwell
```

或使用 CLI：

```sh
dsh plugin add https://github.com/2750599332-art/dsh-inkwell
```

## 使用

1. 在输入框写下提示词。
2. 点击工具行的 ✦ 按钮。
3. 模型返回后，草稿被替换为增强后的提示词。
4. 点撤回箭头恢复原文，或直接编辑结果继续使用。

输入框为空时按钮禁用；请求进行中同样禁用。撤回后再增强一次，会以「那一次增强前」的草稿作为新的撤回目标。

## 设置

**设置 → 插件 → 提示词增强**

### 风格关键词

每行一个，例如：

```
简洁
正式
面向初学者
```

这些词只影响提示词的**写法**（语气、风格、详细程度），不会让改写引入原文未提及的技术选型或需求——这条边界由指令与生成后检查双重保证。留空则保持默认行为。

关键词与模型是两项独立设置，保存其一不会覆盖另一项。

### 优化模型

下拉列表来自当前账号实际可用的模型，每次打开设置页时实时读取，插件不内置任何模型清单。首项「跟随智能体当前模型」为默认。

模型优先级（高到低）：设置页所选 → 插件行的 `provider`/`model` 配置 → 智能体默认选择。

保存一个账号已不再提供的模型会被拒绝（`unknown-model`），而不是留成一条到请求时才失败的无效路由。

## 行为说明

- **语言一致** — 中文进中文出，英文进英文出，混合输入自然保持混合；不翻译、不附加平行译文。
- **输出克制** — 只返回增强后的提示词本身，无前缀、无标签、无代码围栏。若结果过于接近原文，或臆造了原文未提及的技术/需求，各有一次纠正重试，最多两次模型调用。
- **结尾完整** — 被输出上限截断的回复会回退到最后一个完整句子，不留半句。
- **发送即取消撤回** — 提交内容后清除待撤回状态；手动清空输入框则不会。

## 依赖

需要带 Web GUI（`webServer`）与 LLM 适配器（`llm`）的 DeepSeek Harness。二者缺一时插件保持不激活，而不是启动失败。

宿主端为纯 ESM，仅使用 Node 内置模块，无运行时依赖。

## 许可证

MIT
