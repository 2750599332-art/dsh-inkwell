/**
 * Prompt enhancer — Client half.
 *
 * One icon-only button in the composer's trailing control row
 * (`conversation.input.right`), rendered immediately before the model picker.
 * Pressing it rewrites the composer draft through the plugin's Host route
 * `POST /plugins/prompt-enhancer/enhance`.
 *
 * API CONTRACT — VERIFIED STATICALLY, NOT GUESSED
 * Everything below was read from the shipped bundles, not inferred:
 *  - `conversation.input.right` is a per-session `list` slot declared as a
 *    child of `conversation.composer.bar`, and the InputBar renders it as
 *    `renderSlot("conversation.input.right", {})` immediately before
 *    `renderSlot("conversation.input.model", …)` inside
 *    `div.trailing > div.standardControls`.
 *    (dsh-client-ui-conversation/lib/client.js: lines ~22107-22111 and the
 *    slot declaration at ~22982-22989.)
 *  - The standard seat for that slot is provided by ui-conversation as
 *    `ctx.uiSession.provide({ hooks: ["conversation", "input"],
 *    props: ["inputActions"] })`, so entries receive a `useInput` snapshot
 *    selector hook and an `inputActions` action face.
 *    (Same bundle, lines ~22775-22791; ui-session adds `sessionId` at
 *    dsh-client-ui-session/lib/client.js ~755-764.)
 *  - `InputState` (what `useInput(s => s)` yields) is composed as
 *    `{ draft, attachmentIds, draftRev, phase, claim?, occurrences, queue }`.
 *    (Same bundle, `SessionInputShell.compose()`, lines ~16048-16059.)
 *  - `inputActions` is `SessionInputShell.actions`, whose members are
 *    `insertQuote, captureInsertion, insertText, setDraft, persistDraft,
 *    addAttachments, removeAttachment, pruneAttachments, submit`.
 *    (Same bundle, lines ~15368-15395.) Its `setDraft(text)` JSDoc states it
 *    replaces the whole draft and lands the caret at the end.
 *
 * The verified names are tried FIRST. The extra probes behind them exist only
 * so a future rename degrades to a still-working button instead of a crash,
 * and each resolution is logged so one round against the live page is enough
 * to correct it.
 */
window.__ModuleLoader__.load({
  id: '@local/prompt-enhancer',
  factory(require) {
    const React = require('react');
    const h = React.createElement;

    const NS = 'prompt-enhancer';
    const LOG = '[prompt-enhancer]';
    const ENDPOINT = '/plugins/prompt-enhancer/enhance';
    const SETTINGS_ENDPOINT = '/plugins/prompt-enhancer/settings';
    const MODELS_ENDPOINT = '/plugins/prompt-enhancer/models';
    const CSS_ID = 'prompt-enhancer/button.css';

    // One in-flight request per session; survives a remount of the entry.
    const inFlight = new Map();

    const DICTS = {
      en: {
        'action.enhance': 'Enhance prompt',
        'action.enhancing': 'Enhancing prompt…',
        'action.empty': 'Type something first: the composer is empty',
        'action.unavailable': 'Prompt enhancer is unavailable in this composer',
        'action.revert': 'Revert to the pre-enhancement text',
        'action.reverted': 'Reverted to the pre-enhancement text',
        'error.generic': 'Prompt enhancement failed. Try again',
        'error.network': 'Cannot reach the prompt enhancement service. Check that it is running',
        'error.empty_result': 'The model returned no usable prompt. Try again',
        'settings.title': 'Prompt enhancer',
        'settings.description':
          'Set the direction the rewrite should follow. These keywords shape the tone, register, and level of detail of every enhanced prompt. Leave the box empty to keep the default behaviour.',
        'settings.keywordsLabel': 'Style keywords',
        'settings.keywordsPlaceholder': 'e.g.\nconcise\nformal tone\nbeginner friendly',
        'settings.keywordsHint':
          'Keywords affect how the prompt is written, never what it asks for: they cannot add a technology or a requirement the original text did not mention.',
        'settings.modelLabel': 'Enhancement model',
        'settings.modelDefault': "Use the agent's current model",
        'settings.modelHint':
          "The model prompt enhancement runs on. Independent of the agent's own model selection.",
        'settings.modelUnavailable': 'Model list unavailable',
        'settings.save': 'Save',
        'settings.saving': 'Saving…',
        'settings.saved': 'Saved',
        'settings.saveFailed': 'Could not save. Try again',
        'settings.loading': 'Loading…',
        'settings.loadFailed': 'Could not read the saved keywords',
        'settings.clear': 'Clear',
        'settings.retry': 'Retry',
        'settings.noChanges': 'No unsaved changes: the box already matches what is stored',
      },
      zh: {
        'action.enhance': '增强提示词',
        'action.enhancing': '正在增强提示词…',
        'action.empty': '输入框还是空的，先写点内容再增强',
        'action.unavailable': '当前输入框无法使用提示词增强',
        'action.revert': '退回：恢复到优化前的内容',
        'action.reverted': '已退回优化前的内容',
        'error.generic': '提示词增强失败，请重试',
        'error.network': '无法连接到提示词增强服务，请确认服务正在运行',
        'error.empty_result': '模型没有返回可用的提示词，请重试',
        'settings.title': '提示词增强',
        'settings.description':
          '设置提示词优化方向的关键词。这些关键词会影响每个增强后提示词的语气、风格和详细程度。留空则保持默认行为。',
        'settings.keywordsLabel': '风格关键词',
        'settings.keywordsPlaceholder': '例如：\n简洁\n正式\n面向初学者',
        'settings.keywordsHint':
          '关键词只影响提示词的写法，不改变它的要求：不会因此引入原文未提及的技术选型，也不会新增原文未提出的需求。',
        'settings.modelLabel': '优化模型',
        'settings.modelDefault': '跟随智能体当前模型',
        'settings.modelHint': '提示词优化所使用的模型，与智能体自身的模型选择互不影响。',
        'settings.modelUnavailable': '模型列表不可用',
        'settings.save': '保存',
        'settings.saving': '保存中…',
        'settings.saved': '已保存',
        'settings.saveFailed': '保存失败，请重试',
        'settings.loading': '加载中…',
        'settings.loadFailed': '无法读取已保存的关键词',
        'settings.clear': '清空',
        'settings.retry': '重试',
        'settings.noChanges': '没有需要保存的改动：输入框内容与已保存的关键词一致',
      },
    };

    const CSS = `
.dpe-root{position:relative;display:inline-flex;align-items:center;flex:none}
.dpe-button{
  appearance:none;-webkit-appearance:none;
  box-sizing:border-box;display:grid;place-items:center;
  width:28px;height:28px;padding:0;margin:0;flex:none;
  border:0;border-radius:999px;background:transparent;
  color:var(--dsw-alias-label-primary,CanvasText);
  cursor:pointer;transition:background-color .12s ease,opacity .12s ease;
}
@media (hover:hover){.dpe-button:hover:not(:disabled){background:var(--dsw-alias-interactive-bg-hover-solid,var(--dsw-alias-interactive-bg-hover,rgba(127,127,127,.14)))}}
.dpe-button:focus-visible{outline:2px solid var(--dsw-alias-brand-primary,#5686fe);outline-offset:1px}
.dpe-button:disabled{opacity:.5;cursor:default}
/* No [data-state=done]:disabled override here, deliberately.
   It used to force opacity:1 + cursor:pointer "because the draft may have been
   emptied afterwards", but the state machine already keeps done enabled in that
   case (disabled here is !canRevert, and canRevert never looks at the draft).
   So the only way to reach done+disabled is a composer with no draft writer —
   a revert that genuinely cannot run. Restoring full opacity and a pointer
   cursor there presented a dead control as live, and it also broke the rule
   that the base layer is identical across states: opacity is part of the base
   layer, so done now dims on the same terms as every sibling. */
.dpe-icon{display:block;pointer-events:none;overflow:visible}
/* ---- four-state glyph morph -------------------------------------------
   The box is ALWAYS 16x16 and the button always 28x28, so a state change can
   never move the row. Only paint animates; nothing here changes layout. */
.dpe-glyph{transform-box:fill-box;transform-origin:center}
/* star -> ring: the star's outline scales shut while the ring draws in, so the
   silhouette travels continuously instead of cross-fading. */
.dpe-star{
  transform-origin:center;
  transition:transform .34s cubic-bezier(.4,0,.2,1),opacity .22s ease;
}
.dpe-ring{
  transform-origin:center;
  transform:rotate(-90deg) scale(.35);
  opacity:0;
  transition:transform .34s cubic-bezier(.4,0,.2,1),opacity .26s ease;
}
/* ring: the spinner. A dashed ring reads as motion even mid-rotation. */
.dpe-ring-track,.dpe-ring-arc{fill:none;stroke-linecap:round}
.dpe-ring-track{stroke:currentColor;opacity:.22}
.dpe-ring-arc{stroke:currentColor;stroke-dasharray:11 40;transform-origin:center}
/* ---- revert glyph: the user's supplied artwork -------------------------
   The supplied file (revert.png) is the user's own image, byte for byte. It
   cannot be shown as an <img>: it is indexed PNG with no tRNS, so its
   #f7f7f7 page-white plate is REAL opaque pixels — on the dark theme that
   reads as a stuck white chip, which is worse than the arrow it replaces.
   It also cannot be masked directly: with no alpha channel, mask-image
   would mask with the image's own luminance, i.e. mostly-opaque everywhere.

   So the ink is lifted into an alpha mask (revert-mask.png, generated from
   revert.png by a luminance ramp — see that file's provenance in the task
   report). Geometry, stroke weight and the artwork's own 5-level
   antialiasing ramp are the user's pixels, unchanged; only the CHANNEL it
   occupies moved from colour to alpha. A plain <rect> then paints through
   that mask in currentColor, so this glyph is driven by exactly the same
   token as the star and the ring and adapts to the theme by itself — which
   is what makes the done state visually part of the same row.
   mask-size:contain keeps the artwork's intrinsic 137:131 ratio (a bare
   width/height would stretch it). */
.dpe-revert{
  transform-origin:center;
  transform:scale(.4) rotate(-35deg);
  opacity:0;
  transition:transform .34s cubic-bezier(.4,0,.2,1),opacity .26s ease;
  fill:currentColor;
  -webkit-mask-image:url("data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAALcAAAC3CAMAAABnsD+tAAAAwFBMVEUAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAALOy8QAAAAQHRSTlMA/8p9OQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAgVWr8QAAAhxJREFUeNrtnNFuwjAMRRPb///No1LXwQoa0nLd3emc9oEndDDGSUidMQAAAAAAAAAAAP4RUZ7ac6an9pzlqe0nvmu7iR/aXuJ32k4/zgdtH2+00UYbbbTRRhtttH+hHUQbbbTRRhtttNFGG2037feI7d6v7T6TWfXntN/4WMfL9NH+Tpal9hb1xRuJTdrLE6bRe+3+UK/4wmzpFZ/hKr5uXIuHemsU8h/H+fq8XpLbfVzbnbcxU53lwglKhrKwSGdWFbokF08JS5bk6rnsKV9cxEd6psrZ3Ee8DKvKM3GjhWZcM3IuTnJb8TJNlRim4um0D6ioKd3lMJ3EUxLwBvHQvL1cvDQB14uHohY2iNdX1QqrP8Vljzmr67jsvcURD02Cy8VTU1H04i3fpTQPYziJCxNFKl7Shg+huLZR5X5EVg1t4uVJqCphSrc4Y3h57+Khm8zG0InH8PPeJlnSxYPKe4jX9cMKvFspe++w8k577zTtXMa7twwWZbD1eUvTNEnTNCnP6u2aJmEa7vIM9zQNd5iG2/RUFadwVxDuizpByrKWOE1NalrW7vI8oKmmZbhT1O7QqU0HX2Nqh82IE6qOGHVmh18pSWXPlyyvU9g21TFlFe07r/W9dSLli9ajXJ92Hh1qdYV2KX7mHu2A7fEOVVn16GAs0ybdtLTui/fqBUJLvAWnFZT2jALd2Raex6gDAAAAAAAAAABcwgdaFBNwt02j7AAAAABJRU5ErkJggg==");
  mask-image:url("data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAALcAAAC3CAMAAABnsD+tAAAAwFBMVEUAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAALOy8QAAAAQHRSTlMA/8p9OQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAgVWr8QAAAhxJREFUeNrtnNFuwjAMRRPb///No1LXwQoa0nLd3emc9oEndDDGSUidMQAAAAAAAAAAAP4RUZ7ac6an9pzlqe0nvmu7iR/aXuJ32k4/zgdtH2+00UYbbbTRRhtttH+hHUQbbbTRRhtttNFGG2037feI7d6v7T6TWfXntN/4WMfL9NH+Tpal9hb1xRuJTdrLE6bRe+3+UK/4wmzpFZ/hKr5uXIuHemsU8h/H+fq8XpLbfVzbnbcxU53lwglKhrKwSGdWFbokF08JS5bk6rnsKV9cxEd6psrZ3Ee8DKvKM3GjhWZcM3IuTnJb8TJNlRim4um0D6ioKd3lMJ3EUxLwBvHQvL1cvDQB14uHohY2iNdX1QqrP8Vljzmr67jsvcURD02Cy8VTU1H04i3fpTQPYziJCxNFKl7Shg+huLZR5X5EVg1t4uVJqCphSrc4Y3h57+Khm8zG0InH8PPeJlnSxYPKe4jX9cMKvFspe++w8k577zTtXMa7twwWZbD1eUvTNEnTNCnP6u2aJmEa7vIM9zQNd5iG2/RUFadwVxDuizpByrKWOE1NalrW7vI8oKmmZbhT1O7QqU0HX2Nqh82IE6qOGHVmh18pSWXPlyyvU9g21TFlFe07r/W9dSLli9ajXJ92Hh1qdYV2KX7mHu2A7fEOVVn16GAs0ybdtLTui/fqBUJLvAWnFZT2jALd2Raex6gDAAAAAAAAAABcwgdaFBNwt02j7AAAAABJRU5ErkJggg==");
  -webkit-mask-repeat:no-repeat;mask-repeat:no-repeat;
  -webkit-mask-position:center;mask-position:center;
  /* contain, never 100% 100%: the artwork is 137x131, not square. */
  -webkit-mask-size:contain;mask-size:contain;
}
/* ---- state: idle (star) ---- */
.dpe-button[data-state=idle] .dpe-star{transform:scale(1);opacity:1}
/* ---- state: morphing (star collapsing, ring growing) ---- */
.dpe-button[data-state=morphing] .dpe-star{transform:scale(.2);opacity:0}
.dpe-button[data-state=morphing] .dpe-ring{transform:rotate(-90deg) scale(1);opacity:1}
/* ---- state: busy (rotating ring) ---- */
.dpe-button[data-state=busy] .dpe-star{transform:scale(.2);opacity:0}
.dpe-button[data-state=busy] .dpe-ring{transform:rotate(-90deg) scale(1);opacity:1}
.dpe-ring-arc{animation:dpe-spin 1.1s linear infinite}
@media (prefers-reduced-motion:reduce){.dpe-ring-arc{animation-duration:2.6s}}
/* ---- state: done (revert arrow) ---- */
.dpe-button[data-state=done] .dpe-star{transform:scale(.2);opacity:0}
.dpe-button[data-state=done] .dpe-ring{transform:rotate(-90deg) scale(.35);opacity:0}
.dpe-button[data-state=done] .dpe-revert{transform:scale(1) rotate(0deg);opacity:1}
/* The done state deliberately declares NO background, NO colour and NO
   border of its own. It used to paint a persistent brand tint
   (color-mix(... 12% ...) plus color:brand-primary) to mark "a revert is
   available", and that is exactly what made this control look like it
   belonged to a different group: every sibling in the composer row —
   attach, model picker, send — is transparent until hover. The state is
   already carried by the glyph and by the aria-label; the plate under it
   must stay identical to idle's. Hover/focus/disabled therefore fall
   through to the shared .dpe-button rules above, unchanged. */
@keyframes dpe-spin{to{transform:rotate(360deg)}}
.dpe-button[data-busy]{cursor:progress}
.dpe-error{
  /* Above the button, not below: this row is the composer's last line, so a
     bubble hanging below it lands outside the card and gets clipped. Placed
     upward it sits over the editor area, inside the card's bounds. */
  position:absolute;right:0;bottom:calc(100% + 6px);z-index:30;
  box-sizing:border-box;max-width:260px;padding:4px 8px;
  border-radius:var(--dsw-radius-lg,8px);
  border:1px solid var(--dsw-alias-border-l2,rgba(127,127,127,.28));
  background:var(--dsw-specific-menu,Canvas);
  color:var(--dsw-alias-label-secondary,CanvasText);
  font-size:12px;line-height:18px;white-space:normal;
  pointer-events:none;
}
.dpe-sr{position:absolute;width:1px;height:1px;margin:-1px;padding:0;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap;border:0}
/* ---- settings section ---- */
.dpe-section{display:flex;flex-direction:column;gap:10px;max-width:560px}
.dpe-section-head{font-size:15px;font-weight:600;color:var(--dsw-alias-label-primary,CanvasText)}
.dpe-section-desc{margin:0;font-size:13px;line-height:1.6;color:var(--dsw-alias-label-secondary,CanvasText)}
.dpe-section-label{font-size:13px;font-weight:600;color:var(--dsw-alias-label-primary,CanvasText)}
.dpe-section-input{
  box-sizing:border-box;width:100%;padding:8px 10px;
  font:inherit;font-size:13px;line-height:1.6;
  color:var(--dsw-alias-label-primary,CanvasText);
  background:var(--dsw-alias-bg-layer-1,Canvas);
  border:1px solid var(--dsw-alias-border-l2,rgba(127,127,127,.3));
  border-radius:var(--dsw-radius-md,8px);
  resize:vertical;min-height:110px;
}
.dpe-section-input:focus-visible{outline:2px solid var(--dsw-alias-brand-primary,#5686fe);outline-offset:1px}
.dpe-section-input:disabled{opacity:.6}
/* A select reuses the textarea's box but must not inherit its multi-line
   geometry: no resize handle, one row tall, and room for the native arrow.

   The asymmetric padding is deliberate. The textarea sets padding:8px 10px, so
   its text starts 11px from its border box (1px border + 10px padding). The
   select used to set padding:4px 8px, which put ITS text at 9px — the two
   controls of the same field group had visibly different left text edges
   (measured 31.0px vs 29.0px). A 10px left padding restores the shared edge;
   the right side stays at 8px so the native disclosure arrow keeps its room.
   Height is 36px to match the Host's own settings inputs (its search field is
   height:36px), where this control previously stood 2px short at 34px. */
.dpe-section-select{
  appearance:auto;-webkit-appearance:auto;
  min-height:0;height:36px;padding:4px 8px 4px 10px;
  resize:none;cursor:pointer;
}
.dpe-section-select:disabled{cursor:default}
.dpe-section-hint{margin:0;font-size:12px;line-height:1.55;color:var(--dsw-alias-label-secondary,CanvasText)}
.dpe-section-actions{display:flex;align-items:center;gap:8px;flex-wrap:wrap}
.dpe-section-save,.dpe-section-clear,.dpe-section-retry{
  appearance:none;box-sizing:border-box;
  padding:6px 14px;font:inherit;font-size:13px;font-weight:600;
  border-radius:var(--dsw-radius-sm,8px);cursor:pointer;
  border:1px solid transparent;
  transition:background-color .12s ease,color .12s ease,border-color .12s ease;
}
/* Keyboard focus must be visible on all three actions (WCAG 2.4.7).
   These buttons previously declared NO :focus-visible rule at all: the UA
   default ring was suppressed by appearance:none plus the transparent border,
   so tabbing to 保存 produced a byte-identical computed style to the resting
   state (measured: outline-style=none, box-shadow=none) — a keyboard user could
   not see where they were. The ring mirrors the composer button's rule so the
   two surfaces of this plugin agree, but is offset 2px here because these
   buttons sit in a row with 8px gaps and need the extra clearance. */
.dpe-section-save:focus-visible,.dpe-section-clear:focus-visible,.dpe-section-retry:focus-visible{
  outline:2px solid var(--dsw-alias-brand-primary,#5686fe);
  outline-offset:2px;
}
.dpe-section-retry{
  color:var(--dsw-alias-label-primary,CanvasText);
  background:transparent;
  border-color:var(--dsw-alias-border-l2,rgba(127,127,127,.3));
}
.dpe-section-retry:hover:not(:disabled){background:var(--dsw-alias-interactive-bg-hover-solid,rgba(127,127,127,.12))}
/* Primary action: a SOLID inverted block.
   The label is the page background token and the fill is the label token, i.e.
   the exact ink/ground swap the design system itself uses for its primary
   button (--dsw-alias-button-primary-fill is --dsw-alias-brand-primary, which
   in the shipped themes resolves to the label ink: #0f1115 light, #f9fafb
   dark, and is paired with --dsw-alias-label-primary-foreground).
   Never hardcode #fff here: against the real dark token (#f9fafb) a white
   label is 1.05:1 and the button reads as a blank chip.
   The enabled fill carries NO border of its own (transparent), matching the
   clear button's geometry exactly — only the fill differs, so the two read as
   one pair rather than as two different button families. */
.dpe-section-save{
  color:var(--dsw-alias-bg-base,#fff);
  background:var(--dsw-alias-label-primary,#0f1115);
  border-color:transparent;
}
/* Hover nudges the brightness of the SAME token pair instead of reaching for a
   second token: every --dsw-alias-* colour this block names is on the
   Theme-provider guarantee list, and brightness scales fill and label
   together, so the measured contrast barely moves. */
.dpe-section-save:hover:not(:disabled){filter:brightness(.94)}
.dpe-section-clear{
  color:var(--dsw-alias-label-primary,CanvasText);
  background:transparent;
  border-color:var(--dsw-alias-border-l2,rgba(127,127,127,.3));
}
.dpe-section-clear:hover:not(:disabled){background:var(--dsw-alias-interactive-bg-hover-solid,rgba(127,127,127,.12))}
/* Disabled: a MUTED PAIR OF COLORS, never a blanket opacity.
   Opacity fades a filled button's background and its label together, so a
   white-on-brand label collapses to grey-on-grey: the settings page used to
   open with 3.86:1 (dark) and 1.43:1 (light) on its primary action, which is
   exactly the "pale grey box with invisible text" that was reported. Fading
   also made the control look broken rather than unavailable.
   Instead: keep the box a real, bounded control (layer fill + visible border)
   and give the label the secondary ink token. Measured >= 5.7:1 in every
   shipped theme and in both synthetic probe themes.
   ALL THREE share this one declaration — they are peers in the same action
   row, so one muted treatment covers them and no member may look different. */
.dpe-section-save:disabled,.dpe-section-clear:disabled,.dpe-section-retry:disabled{
  opacity:1;cursor:default;
  color:var(--dsw-alias-label-secondary,CanvasText);
  background:var(--dsw-alias-bg-layer-1,Canvas);
  border-color:var(--dsw-alias-border-l2,rgba(127,127,127,.3));
}
/* Availability is painted by the :disabled rule above and NOTHING else.
   There used to be a second rule here keyed on [data-empty=true]. It was
   redundant with :disabled — and actively wrong once Save's data-empty was
   repointed to mean "save unavailable" while Clear's still meant "box is
   empty": a model-only change made Save pressable with a blank box, so the
   two attributes disagreed and a pressable Save could be painted muted.
   One attribute name carrying two meanings is the defect; removing the rule
   leaves :disabled as the single source of truth for how a control looks. */
/* The disabled save button shares the SAME border token as clear/retry.
   It previously overrode border-color with --dsw-alias-label-secondary, which
   in the shipped dark theme is rgb(207,211,214) — a near-white hairline around
   a dark fill, i.e. a conspicuous white ring on a control that is supposed to
   look unavailable. One border token for the whole disabled group: they are
   peers, so they must not differ in outline weight. */
.dpe-section-status{font-size:12px;color:var(--dsw-alias-label-secondary,CanvasText)}
`;

    /** Console diagnostics: one line naming the probe that won, or that none did. */
    function note(message) {
      try {
        console.log(LOG + ' ' + message);
      } catch (_ignored) {}
    }
    function warn(message, error) {
      try {
        console.warn(LOG + ' ' + message, error);
      } catch (_ignored) {}
    }

    // ---------------------------------------------------------------- styles
    // `styles.insert(css)` is the contracted seam. The module is resolved
    // defensively because a missing module-table entry must not break the
    // plugin; the fallback is the pattern shipped third-party plugins use
    // (a <style> element tagged with the owning package id, which the module
    // system claims and removes on unload).
    let stylesApi;
    try {
      const mod = require('styles');
      if (mod && typeof mod.insert === 'function') stylesApi = mod;
    } catch (error) {
      stylesApi = undefined;
    }

    function installStyles() {
      if (stylesApi !== undefined) {
        try {
          const dispose = stylesApi.insert(CSS);
          note('styles.insert(css) installed');
          return () => {
            try {
              if (typeof dispose === 'function') dispose();
            } catch (_ignored) {}
          };
        } catch (error) {
          warn('styles.insert(css) threw; falling back to a tagged <style>', error);
        }
      } else {
        note('"styles" module unavailable; using a tagged <style> element');
      }
      if (typeof document === 'undefined') return () => {};
      try {
        const tag = document.createElement('style');
        tag.dataset.plugin = '@local/prompt-enhancer';
        tag.dataset.pluginCss = CSS_ID;
        tag.textContent = CSS;
        document.head.appendChild(tag);
        return () => {
          try {
            tag.remove();
          } catch (_ignored) {}
        };
      } catch (error) {
        warn('style installation failed entirely', error);
        return () => {};
      }
    }

    // ------------------------------------------------------- capability probes
    /**
     * Latch the first callable hook ever handed to the entry. The renderer
     * caches the standard seat per slot declaration, so this identity is
     * stable; latching keeps the hook-call count from oscillating regardless.
     */
    function useStable(fn) {
      const ref = React.useRef(fn);
      if (typeof ref.current !== 'function' && typeof fn === 'function') ref.current = fn;
      return ref.current;
    }

    /** READ: normalize an InputState snapshot (or a bare string) into the draft. */
    function draftOf(snapshot) {
      if (typeof snapshot === 'string') return snapshot;
      if (snapshot === null || typeof snapshot !== 'object') return '';
      // `draft` is the verified field (SessionInputShell.compose()); the rest
      // are bounded fallbacks in case the shape is renamed.
      const keys = ['draft', 'text', 'value'];
      for (let i = 0; i < keys.length; i += 1) {
        const value = snapshot[keys[i]];
        if (typeof value === 'string') return value;
      }
      return '';
    }

    /**
     * WRITE: replace the whole draft, using the first callable writer.
     * `setDraft` is the verified member; it lands the caret at the end, which
     * is exactly the restored caret position we want.
     */
    function writeDraft(actions, text) {
      if (actions === null || typeof actions !== 'object') return null;
      const candidates = ['setDraft', 'replaceText', 'setText', 'updateText', 'setValue'];
      for (let i = 0; i < candidates.length; i += 1) {
        const name = candidates[i];
        const writer = actions[name];
        if (typeof writer !== 'function') continue;
        try {
          writer.call(actions, text);
          return name;
        } catch (error) {
          warn('draft writer "' + name + '" threw', error);
        }
      }
      const ins = actions.insertText;
      const capture = actions.captureInsertion;
      if (typeof ins === 'function' && typeof capture === 'function') {
        try {
          const span = capture.call(actions);
          ins.call(actions, text, span);
          return 'insertText';
        } catch (error) {
          warn('draft writer "insertText" threw', error);
        }
      }
      return null;
    }

    /** Resolve the current active locale tag for the request body. */
    function activeLocale(fallback) {
      try {
        if (typeof document !== 'undefined') {
          const tag = document.documentElement?.lang;
          if (typeof tag === 'string' && tag !== '') return tag;
        }
      } catch (_ignored) {}
      return fallback;
    }

    // -------------------------------------------------------------- component
    /**
     * The four-state glyph.
     *
     * One 16x16 SVG holds all three shapes at once and the STATE decides which
     * of them is painted. That is what keeps the morph continuous and the row
     * still: the DOM box never changes size, no node is added or removed, and
     * the transitions only touch transform/opacity — properties that cannot
     * reflow the toolbar.
     *
     *   idle     star          the affordance
     *   morphing star -> ring  a brief, deliberate transition window
     *   busy     ring, spinning
     *   done     revert arrow  click restores the pre-enhancement draft
     */
    function StateGlyph(props) {
      const state = props.state;
      return h(
        'svg',
        {
          className: 'dpe-icon',
          viewBox: '0 0 16 16',
          width: 16,
          height: 16,
          fill: 'none',
          'aria-hidden': true,
          focusable: false,
        },
        // Star: the idle affordance.
        h('path', {
          className: 'dpe-glyph dpe-star',
          d: 'M8 1.6l1.15 2.9a3.2 3.2 0 0 0 1.85 1.85l2.9 1.15-2.9 1.15a3.2 3.2 0 0 0-1.85 1.85L8 13.4l-1.15-2.9a3.2 3.2 0 0 0-1.85-1.85L2.1 7.5l2.9-1.15a3.2 3.2 0 0 0 1.85-1.85L8 1.6z',
          stroke: 'currentColor',
          strokeWidth: 1.2,
          strokeLinejoin: 'round',
        }),
        // Ring: the busy indicator. Track + arc, never a filled disc, so the
        // silhouette of the star's outline is preserved through the morph.
        h(
          'g',
          { className: 'dpe-glyph dpe-ring' },
          h('circle', { className: 'dpe-ring-track', cx: 8, cy: 8, r: 5.2, strokeWidth: 1.3 }),
          h('circle', { className: 'dpe-ring-arc', cx: 8, cy: 8, r: 5.2, strokeWidth: 1.6 })
        ),
        // Revert: the user's own artwork, not a drawn glyph.
        // A full-box rect painted in currentColor THROUGH the artwork's alpha
        // mask (see .dpe-revert). Nothing is drawn by hand here: no path, no
        // stroke, no invented geometry — just a canvas for the supplied image.
        h('rect', {
          className: 'dpe-glyph dpe-revert',
          x: 0,
          y: 0,
          width: 16,
          height: 16,
        })
      );
    }

    /** How long the star -> ring morph is allowed to run before the spin owns it. */
    const MORPH_MS = 340;
    /**
     * Window after a revert in which a further press is treated as the tail of
     * the same gesture. Kept under a typical double-click interval (500ms) so a
     * deliberate enhance is never blocked, but long enough to absorb the second
     * click of a double-press on the revert arrow.
     */
    const REVERT_GUARD_MS = 400;
    /**
     * Last-resort watchdog on one enhancement request.
     *
     * Every ordinary outcome settles the promise chain: a 2xx, a 4xx/5xx, a
     * transport error, or our own abort. A HUNG request has none of those — a
     * stalled socket, a proxy that never answers, or a body stream that stops
     * mid-flight leaves `fetch`/`response.json()` pending forever, so `finish()`
     * never runs and the glyph stays `busy` with the button disabled for the
     * life of the page. That is a stuck control with no way out, and it is
     * reachable: the Host's own budget (index.js: DEFAULT_TIMEOUT_MS = 90s)
     * only fires if the Host PROCESS is alive to answer.
     *
     * Set well ABOVE the Host's budget, so a slow-but-healthy call still gets
     * the Host's own 504 (with its better message) instead of this generic
     * one. The watchdog therefore never changes a normal call's behaviour; it
     * only ends a request that would otherwise never end.
     */
    const REQUEST_WATCHDOG_MS = 120000;

    function PromptEnhancerButton(props) {
      const safe = props !== null && typeof props === 'object' ? props : {};
      const t =
        typeof safe.t === 'function'
          ? safe.t
          : (key) => {
              const table = DICTS.en;
              return typeof table[key] === 'string' ? table[key] : key;
            };

      const useInput = useStable(safe.useInput);
      // Verified seat: SnapshotSelectorHook<InputState>. Called unconditionally
      // for a given entry; a missing hook yields no draft, never a throw.
      let snapshot;
      try {
        snapshot = typeof useInput === 'function' ? useInput((state) => state) : undefined;
      } catch (error) {
        warn('useInput selector threw; treating the draft as unreadable', error);
        snapshot = undefined;
      }

      const draft = draftOf(snapshot);
      const readCapable = typeof useInput === 'function';
      const actions = safe.inputActions;
      const writeCapable =
        actions !== null &&
        typeof actions === 'object' &&
        ['setDraft', 'replaceText', 'setText', 'updateText', 'setValue'].some(
          (name) => typeof actions[name] === 'function'
        );

      const sessionId = typeof safe.sessionId === 'string' ? safe.sessionId : '';
      const [busy, setBusy] = React.useState(false);
      const [error, setError] = React.useState(null);
      const [reverted, setReverted] = React.useState(false);
      const [morphing, setMorphing] = React.useState(false);
      /**
       * The pending revert target: the draft the user had immediately before the
       * last successful enhancement, or null when nothing is pending.
       *
       * It is held in BOTH a ref and state, and every mutation goes through
       * `armSnapshot` / `clearSnapshot` below, so the two CANNOT drift:
       *  - `pendingRevertRef` is the synchronous truth the click handler reads,
       *    because a press can land in the same tick as the write; and
       *  - `pendingRevert` is the truth the glyph paints from (`data-state`).
       * An earlier version kept the snapshot in a ref ALONE, so consuming it did
       * not re-render: the revert arrow stayed on screen while pressing it did
       * nothing. One value, two views, one writer — that is what makes paint and
       * behaviour share a single source of truth.
       */
      const [pendingRevert, setPendingRevert] = React.useState(null);
      const pendingRevertRef = React.useRef(null);
      const morphTimerRef = React.useRef(null);
      const abortRef = React.useRef(null);
      const timerRef = React.useRef(null);
      const revertedTimerRef = React.useRef(null);
      /** Ends a request that would otherwise stay pending forever (see REQUEST_WATCHDOG_MS). */
      const watchdogRef = React.useRef(null);
      /**
       * Synchronous single-flight guard for the enhance path.
       *
       * The module-level `inFlight` map cannot carry this on its own: it is
       * keyed by `sessionId` and is skipped entirely when the entry is handed
       * no `sessionId` (`sessionId === ''`), and even when it is keyed, it is
       * only read after the press has already been admitted. `busy` is React
       * state, so several clicks dispatched in ONE tick all observe the same
       * pre-render `busy === false`. The result is N identical POSTs and N
       * `setDraft` writes from a "single" press — the exact class of bug the
       * 400ms revert guard exists to prevent on the revert side. A ref is the
       * only value that is already updated by the time the next click runs.
       */
      const requestingRef = React.useRef(false);
      /** Monotonic per-mount request token; see `isCurrent` in the click handler. */
      const requestSeqRef = React.useRef(0);
      /** The draft + attachment count captured when a submit started; null while none is. */
      const submitDraftRef = React.useRef(null);
      /**
       * The last revert: when it landed and the text it restored. A press that
       * arrives inside `REVERT_GUARD_MS` with that same text still in the box is
       * the tail of the same "undo" gesture (a double-press on the arrow), and
       * re-enhancing the text the user just restored is the opposite of what
       * they asked for, so it is swallowed. Any edit in between clears the
       * match, so a deliberate enhance is never blocked.
       */
      const lastRevertRef = React.useRef({ at: 0, text: null });
      const mountedRef = React.useRef(true);

      // Report which probes resolved, once per entry mount.
      const reportedRef = React.useRef(false);
      if (!reportedRef.current) {
        reportedRef.current = true;
        note(
          'probe read=' +
            (readCapable ? 'useInput -> InputState.draft' : 'NONE') +
            ' write=' +
            (writeCapable ? 'inputActions.setDraft' : 'NONE') +
            (readCapable && writeCapable ? '' : ' (button stays disabled)')
        );
      }

      /**
       * The ONLY two places the snapshot changes. Both update the ref and the
       * state together on purpose: a clear that misses the state re-render is
       * exactly the "arrow is still showing but the revert is gone" bug.
       */
      const armSnapshot = React.useCallback((value) => {
        pendingRevertRef.current = value;
        setPendingRevert(value);
      }, []);
      const clearSnapshot = React.useCallback(() => {
        pendingRevertRef.current = null;
        setPendingRevert(null);
      }, []);

      React.useEffect(() => {
        mountedRef.current = true;
        return () => {
          mountedRef.current = false;
          try {
            abortRef.current?.abort();
          } catch (_ignored) {}
          try {
            if (morphTimerRef.current !== null) clearTimeout(morphTimerRef.current);
          } catch (_ignored) {}
          try {
            if (timerRef.current !== null) clearTimeout(timerRef.current);
          } catch (_ignored) {}
          try {
            if (revertedTimerRef.current !== null) clearTimeout(revertedTimerRef.current);
          } catch (_ignored) {}
          try {
            if (watchdogRef.current !== null) clearTimeout(watchdogRef.current);
          } catch (_ignored) {}
          // Release the synchronous single-flight latch too: the whole point of
          // dropping the entry is to leave no state that would refuse a press
          // if this component is ever remounted.
          requestingRef.current = false;
          if (sessionId !== '') inFlight.delete(sessionId);
        };
      }, [sessionId]);

      // A session switch invalidates the snapshot: restoring another session's
      // pre-enhancement text into this composer would be data corruption. The
      // clear goes through `clearSnapshot`, so the glyph flips back with it.
      React.useEffect(() => {
        clearSnapshot();
        setReverted(false);
        setMorphing(false);
      }, [sessionId, clearSnapshot]);

      /**
       * Cancel a pending revert when the draft is SUBMITTED.
       *
       * The distinguishing signal is `InputState.phase`, not the draft text.
       * Verified against the shipped composer (dsh-client-ui-conversation:
       * SessionInputShell.compose() publishes `phase: core.phase` from the
       * SubmitMachine): phase is 'plain' | 'claimed' | 'adjudicating' |
       * 'submitting' | 'sending', and ONLY a submit moves it off 'plain'
       * (`submit()` dispatches 'enter', which either adjudicates, submits a
       * claim, or sends). Typing, pasting, hand-clearing the box, and our own
       * `setDraft` all publish 'plain' unchanged. So "phase left plain" is a
       * composer-only fact, while "draft became empty" is ambiguous — a user who
       * simply clears the box must NOT lose the revert.
       *
       * The send is confirmed at SETTLEMENT rather than at its start: an attempt
       * the Host refuses returns to 'plain' with the draft untouched, and the
       * user may still want the enhancement undone. A successful submit clears
       * the committed text (the composer's own commit-draft effect retains only
       * what was typed during the flight), so a changed draft — or released
       * attachments — at settlement means the content left the composer.
       */
      const inputPhase =
        snapshot !== null && typeof snapshot === 'object' && typeof snapshot.phase === 'string'
          ? snapshot.phase
          : '';
      const submitInFlight =
        inputPhase === 'adjudicating' || inputPhase === 'submitting' || inputPhase === 'sending';
      const attachmentCount =
        snapshot !== null && typeof snapshot === 'object' && Array.isArray(snapshot.attachmentIds)
          ? snapshot.attachmentIds.length
          : 0;
      React.useEffect(() => {
        if (submitInFlight) {
          // Freeze what the composer held when the send started.
          if (submitDraftRef.current === null) {
            submitDraftRef.current = { draft, attachmentCount };
          }
          return;
        }
        const submitted = submitDraftRef.current;
        if (submitted === null) return;
        submitDraftRef.current = null;
        if (pendingRevertRef.current === null) return;
        // Two independent proofs that the content actually left the composer:
        // the text was committed away, or the sent attachments were released.
        // A refused/failed send returns to 'plain' with BOTH untouched, and the
        // user may still want the enhancement undone, so keep the snapshot.
        const draftLeft = draft !== submitted.draft;
        const attachmentsReleased = attachmentCount < submitted.attachmentCount;
        if (!draftLeft && !attachmentsReleased) return;
        clearSnapshot();
        setReverted(false);
        note('pending revert cancelled: the draft was submitted');
      }, [submitInFlight, draft, attachmentCount, clearSnapshot]);

      const showError = React.useCallback((message) => {
        setError(message);
        try {
          if (timerRef.current !== null) clearTimeout(timerRef.current);
          timerRef.current = setTimeout(() => {
            if (mountedRef.current) setError(null);
          }, 5000);
        } catch (_ignored) {}
      }, []);

      const trimmed = typeof draft === 'string' ? draft.trim() : '';
      /**
       * Resolve the single visual state from the flags, in precedence order.
       *
       * `busy` wins over everything because an in-flight request owns the
       * glyph; `morphing` is the short window at the head of `busy` where the
       * star is still collapsing. `done` is a persistent, actionable state that
       * survives until the user reverts or enhances again — it must not depend
       * on the draft being non-empty, or emptying the box would silently strand
       * the user with no way back.
       */
      const hasSnapshot = pendingRevert !== null;
      const state = busy ? (morphing ? 'morphing' : 'busy') : hasSnapshot ? 'done' : 'idle';

      /**
       * A `done` button is actionable, and a `done` button is never inert.
       *
       * `state === 'done'` is only reachable while a snapshot is armed, and a
       * snapshot is only ever armed AFTER a writer accepted the enhanced prompt
       * (see the arm site below), so "arrow painted" already implies "a writer
       * existed". Gating the press on a second, independent `writeCapable`
       * re-check is what produced the reported "the arrow is there but clicking
       * it does nothing": the two conditions could disagree.
       *
       * So the only thing that may disable the revert affordance is an in-flight
       * enhancement (which already paints the busy glyph instead of the arrow).
       * If a write still fails at press time, `onRevert` surfaces an error
       * notice — a visible reaction, never a silent no-op.
       */
      const canRevert = hasSnapshot && !busy;
      const disabled = hasSnapshot
        ? !canRevert
        : !readCapable || !writeCapable || busy || trimmed === '';

      const idleLabel = !readCapable || !writeCapable ? t('action.unavailable') : trimmed === '' ? t('action.empty') : t('action.enhance');
      const label =
        state === 'done'
          ? t('action.revert')
          : state === 'busy' || state === 'morphing'
            ? t('action.enhancing')
            : idleLabel;

      /** Restore the pre-enhancement draft. Idempotent and never destructive. */
      const onRevert = React.useCallback(() => {
        const target = pendingRevertRef.current;
        if (target === null) return;
        const used = writeDraft(actions, target);
        if (used === null) {
          // Keep the snapshot: the user can try again once a writer exists.
          warn('no draft writer accepted the revert');
          showError(t('error.generic'));
          return;
        }
        // Consume through the single writer, so the painted state and the
        // handler's truth change in the same step and cannot disagree.
        clearSnapshot();
        lastRevertRef.current = { at: Date.now(), text: target };
        setReverted(true);
        note('draft reverted via "' + used + '"');
        try {
          if (revertedTimerRef.current !== null) clearTimeout(revertedTimerRef.current);
          revertedTimerRef.current = setTimeout(() => {
            if (mountedRef.current) setReverted(false);
          }, 2200);
        } catch (_ignored) {}
      }, [actions, clearSnapshot, showError, t]);

      const onClick = React.useCallback(
        (event) => {
          try {
            event?.preventDefault?.();
            event?.stopPropagation?.();
          } catch (_ignored) {}
          // The revert button is the same button in a different state. Read the
          // REF here, never a render-time value: a press can land in the same
          // tick as the write, and the ref is the only synchronous truth.
          if (pendingRevertRef.current !== null && !busy) {
            onRevert();
            return;
          }
          // A second press inside the guard window with the restored text still
          // untouched belongs to the same "undo" gesture: the revert was already
          // consumed, so the safest thing this press can do is nothing. Without
          // this it fell through to the enhance branch and re-enhanced the text
          // the user had just restored.
          const lastRevert = lastRevertRef.current;
          if (Date.now() - lastRevert.at < REVERT_GUARD_MS && draft === lastRevert.text) return;
          if (busy || trimmed === '') return;
          if (sessionId !== '' && inFlight.has(sessionId)) return;
          // Synchronous single-flight: `busy` is React state and still reads
          // false for every click dispatched in the same tick, and the map
          // above is bypassed when this entry has no sessionId. The ref is
          // already true by the time the next click runs.
          if (requestingRef.current) return;
          requestingRef.current = true;

          const controller = typeof AbortController === 'function' ? new AbortController() : null;
          abortRef.current = controller;
          if (sessionId !== '') inFlight.set(sessionId, controller);
          // Enter the morph window first, then hand the glyph to the spinner.
          setMorphing(true);
          setBusy(true);
          setError(null);
          try {
            if (morphTimerRef.current !== null) clearTimeout(morphTimerRef.current);
            morphTimerRef.current = setTimeout(() => {
              if (mountedRef.current) setMorphing(false);
            }, MORPH_MS);
          } catch (_ignored) {}

          /**
           * Settle THIS request and only this one.
           *
           * The sequence token matters because a watchdog-timed-out request
           * can still settle later (a transport that ignores `abort`, or a
           * body stream that finally errors). Without the token, that stale
           * settlement would clear `busy` and the single-flight latch while a
           * NEWER request is in flight, re-enabling the button under a live
           * spinner and permitting a second concurrent POST. Comparing the
           * token makes every late callback a no-op.
           */
          const token = (requestSeqRef.current += 1);
          const isCurrent = () => requestSeqRef.current === token;
          const finish = () => {
            if (!isCurrent()) return;
            requestingRef.current = false;
            if (sessionId !== '') inFlight.delete(sessionId);
            try {
              if (morphTimerRef.current !== null) clearTimeout(morphTimerRef.current);
            } catch (_ignored) {}
            try {
              if (watchdogRef.current !== null) {
                clearTimeout(watchdogRef.current);
                watchdogRef.current = null;
              }
            } catch (_ignored) {}
            if (mountedRef.current) {
              setMorphing(false);
              setBusy(false);
            }
          };
          // Watchdog: a request that never settles has no `.then`, no `.catch`
          // and no abort, so without this the busy state is permanent. It
          // settles the UI through `finish()` itself rather than relying on
          // the abort being honoured — a transport that ignores `signal` would
          // otherwise leave the glyph spinning even after the notice appeared.
          try {
            if (watchdogRef.current !== null) clearTimeout(watchdogRef.current);
            watchdogRef.current = setTimeout(() => {
              watchdogRef.current = null;
              if (!isCurrent()) return;
              try {
                controller?.abort();
              } catch (_ignored) {}
              finish();
              if (!mountedRef.current) return;
              showError(t('error.network'));
            }, REQUEST_WATCHDOG_MS);
          } catch (_ignored) {}

          let pending;
          try {
            pending = fetch(ENDPOINT, {
              method: 'POST',
              headers: { 'content-type': 'application/json' },
              body: JSON.stringify({ text: draft, locale: activeLocale(NS) }),
              signal: controller?.signal,
            });
          } catch (error) {
            warn('fetch failed to start', error);
            showError(t('error.network'));
            finish();
            return;
          }

          Promise.resolve(pending)
            .then((response) =>
              Promise.resolve(response.json()).then(
                (body) => ({ response, body }),
                () => ({ response, body: null })
              )
            )
            .then(({ response, body }) => {
              // A superseded request must not touch the composer: writing its
              // prompt would overwrite text the user is editing now, and arming
              // its snapshot would offer a revert to a draft nobody saw.
              if (!mountedRef.current || !isCurrent()) return;
              const ok = body !== null && typeof body === 'object' && body.ok === true;
              if (response.ok === true && ok && typeof body.prompt === 'string' && body.prompt.trim() !== '') {
                const previous = draft;
                const used = writeDraft(actions, body.prompt);
                if (used === null) {
                  warn('no draft writer accepted the enhanced prompt');
                  showError(t('error.generic'));
                } else {
                  // Keep the pre-enhancement text as the revert target: `previous`
                  // is the draft captured when THIS enhancement was pressed.
                  // Stored only after the write succeeded, so a failed write
                  // cannot arm a revert that would paste back text nobody saw.
                  armSnapshot(previous);
                  note('draft replaced via "' + used + '"');
                }
                return;
              }
              if (response.ok === true && ok) {
                showError(t('error.empty_result'));
                return;
              }
              const detail =
                body !== null && typeof body === 'object' && typeof body.error === 'string' ? body.error : '';
              if (detail !== '') warn('host rejected the request: ' + detail);
              showError(t('error.generic'));
            })
            .catch((failure) => {
              if (failure?.name === 'AbortError') return;
              if (!mountedRef.current || !isCurrent()) return;
              warn('request failed', failure);
              showError(t('error.network'));
            })
            .then(finish, finish);
        },
        [actions, armSnapshot, busy, draft, onRevert, sessionId, showError, t, trimmed]
      );

      return h(
        'span',
        { className: 'dpe-root' },
        h(
          'button',
          {
            type: 'button',
            className: 'dpe-button',
            'aria-label': label,
            'aria-busy': busy ? 'true' : undefined,
            title: error !== null ? label + ' — ' + error : label,
            disabled,
            'data-state': state,
            'data-busy': busy ? '' : undefined,
            'data-prompt-enhancer': '',
            onClick,
          },
          h(StateGlyph, { state })
        ),
        error !== null
          ? h('span', { className: 'dpe-error', role: 'alert' }, error)
          : null,
        h(
          'span',
          { className: 'dpe-sr', 'aria-live': 'polite' },
          error !== null ? error : reverted ? t('action.reverted') : state === 'done' ? t('action.revert') : busy ? t('action.enhancing') : ''
        )
      );
    }

    /**
     * The slot entry never blanks: a render or hook failure inside the button
     * degrades to nothing rendered for this entry, not the whole row.
     */
    class Guard extends React.Component {
      constructor(props) {
        super(props);
        this.state = { failed: false };
      }
      static getDerivedStateFromError() {
        return { failed: true };
      }
      componentDidCatch(error) {
        warn('button render failed; entry suppressed', error);
      }
      render() {
        // Optional-chained: a renderer that hands a boundary null props (or a
        // shim that does) must not turn this guard into the crash it exists to
        // prevent.
        try {
          if (this.state !== null && typeof this.state === 'object' && this.state.failed === true) return null;
          const children = this.props !== null && this.props !== undefined ? this.props.children : null;
          return children === undefined ? null : children;
        } catch (error) {
          warn('guard render failed; entry suppressed', error);
          return null;
        }
      }
    }

    /**
     * The plugin's own settings page (`settings.section`).
     *
     * One field: the style keywords the rewrite should follow. The page reads
     * on mount (so it always shows what is actually stored), edits a local
     * draft, and saves explicitly — an autosave would fire a write on every
     * keystroke of a text the user is still composing.
     */
    function SettingsSection(props) {
      const safe = props !== null && typeof props === 'object' ? props : {};
      const t =
        typeof safe.t === 'function'
          ? safe.t
          : (key) => (typeof DICTS.en[key] === 'string' ? DICTS.en[key] : key);

      const [text, setText] = React.useState('');
      const [saved, setSaved] = React.useState('');
      /**
       * The enhancement-model setting, kept as its own state pair beside the
       * keywords. `model` is the value being edited, `modelSaved` what is on
       * disk; the two are separate so the save button can tell whether THIS
       * setting changed, and so neither setting's edit can mark the other
       * dirty. '' means "follow the agent's current model".
       */
      const [model, setModel] = React.useState('');
      const [modelSaved, setModelSaved] = React.useState('');
      /** The account's catalog, read live. Never cached to disk. */
      const [modelGroups, setModelGroups] = React.useState([]);
      const [modelsState, setModelsState] = React.useState('loading');
      const [status, setStatus] = React.useState('loading');
      // The server's own reason for a rejected save, shown next to the badge so
      // a refusal names its cause instead of reading as a broken button.
      const [saveFailDetail, setSaveFailDetail] = React.useState('');
      const [busy, setBusy] = React.useState(false);
      const mountedRef = React.useRef(true);
      /**
       * `loadedRef` records whether the stored list was ever read successfully.
       * It gates SAVING, not just rendering: while the load has failed we do not
       * know what is on disk, so accepting an edit would silently overwrite the
       * user's saved keywords with whatever this page currently shows. That was
       * a real data-loss path — a transient GET failure left an empty box, and
       * typing plus Save replaced the stored list.
       */
      const loadedRef = React.useRef(false);
      /** One write at a time; a fast second click must not POST twice. */
      const inFlightRef = React.useRef(false);
      const savedTimerRef = React.useRef(null);
      const [attempt, setAttempt] = React.useState(0);

      React.useEffect(() => {
        mountedRef.current = true;
        return () => {
          mountedRef.current = false;
          try {
            if (savedTimerRef.current !== null) clearTimeout(savedTimerRef.current);
          } catch (_ignored) {}
        };
      }, []);

      // Load what is stored, so reopening the page echoes the saved value.
      React.useEffect(() => {
        let cancelled = false;
        loadedRef.current = false;
        setStatus('loading');
        (async () => {
          try {
            const response = await fetch(SETTINGS_ENDPOINT, { method: 'GET' });
            const body = await response.json().catch(() => null);
            if (cancelled || !mountedRef.current) return;
            const ok = response.ok === true && body !== null && typeof body === 'object' && Array.isArray(body.keywords);
            if (!ok) throw new Error('the settings service did not return a keyword list');
            const joined = body.keywords.join('\n');
            loadedRef.current = true;
            setText(joined);
            setSaved(joined);
            // The model choice is its own field; a document written before it
            // existed simply reads as ''.
            const chosen = typeof body.model === 'string' ? body.model : '';
            setModel(chosen);
            setModelSaved(chosen);
            setStatus('ready');
          } catch (error) {
            if (cancelled || !mountedRef.current) return;
            warn('settings load failed', error);
            setStatus('load-failed');
          }
        })();
        return () => {
          cancelled = true;
        };
      }, [attempt]);

      // Load the account's model catalog. Read from the Host every time the
      // page opens — this plugin never keeps its own list, so the picker is
      // always exactly what the account can run right now.
      React.useEffect(() => {
        let cancelled = false;
        (async () => {
          try {
            const response = await fetch(MODELS_ENDPOINT, { method: 'GET' });
            const body = await response.json().catch(() => null);
            if (cancelled || !mountedRef.current) return;
            if (response.ok === true && body !== null && Array.isArray(body.groups)) {
              setModelGroups(body.groups);
              setModelsState('ready');
            } else {
              setModelsState('unavailable');
            }
          } catch (error) {
            if (cancelled || !mountedRef.current) return;
            warn('model catalog load failed', error);
            setModelsState('unavailable');
          }
        })();
        return () => {
          cancelled = true;
        };
      }, [attempt]);

      const parse = (value) =>
        String(value)
          .split('\n')
          .map((line) => line.trim())
          .filter((line) => line !== '');

      /** The value the server will store, as a comparable string. */
      const canonical = (value) => parse(value).join('\n');

      // Compare NORMALISED text, not raw text: "  a  \n\n b " and "a\nb" are
      // the same stored list, so a whitespace-only edit must not arm the button
      // (and the loaded text already came back normalised, which would
      // otherwise mark a freshly opened page as dirty).
      // Both settings contribute to "is there something to save", and each is
      // compared against its own saved value: editing one never marks the
      // other changed.
      const keywordsDirty = canonical(text) !== canonical(saved);
      const modelDirty = model !== modelSaved;
      const dirty = keywordsDirty || modelDirty;

      const onSave = React.useCallback(() => {
        // Guard on a ref, not on `busy`: three clicks in one tick all read the
        // same stale `busy===false` and each fire their own POST.
        if (inFlightRef.current) return;
        if (!loadedRef.current) {
          setStatus('load-failed');
          return;
        }
        inFlightRef.current = true;
        setBusy(true);
        // A new attempt drops the previous attempt's reason.
        setSaveFailDetail('');
        setStatus('saving');
        (async () => {
          try {
            const response = await fetch(SETTINGS_ENDPOINT, {
              method: 'POST',
              headers: { 'content-type': 'application/json' },
              body: JSON.stringify({ keywords: parse(text), model }),
            });
            const body = await response.json().catch(() => null);
            if (!mountedRef.current) return;
            if (response.ok === true && body !== null && body.ok === true && Array.isArray(body.keywords)) {
              // Echo the SERVER's normalised list: trimming and de-duplication
              // happen there, so this is what the next enhancement will read.
              const joined = body.keywords.join('\n');
              setText(joined);
              setSaved(joined);
              // The server echoes the model route it stored; adopting it keeps
              // the control showing exactly what the next enhancement will use.
              const storedModel = typeof body.model === 'string' ? body.model : model;
              setModel(storedModel);
              setModelSaved(storedModel);
              setStatus('saved');
              // Clear the badge after a moment; a permanent "Saved" label reads
              // as a stuck state the next time the page is looked at.
              try {
                if (savedTimerRef.current !== null) clearTimeout(savedTimerRef.current);
                savedTimerRef.current = setTimeout(() => {
                  if (mountedRef.current) setStatus((current) => (current === 'saved' ? 'ready' : current));
                }, 2000);
              } catch (_ignored) {}
            } else {
              // Carry the server's own reason into the badge instead of a flat
              // "save failed": a rejected save told the user nothing about WHY,
              // so a refusal caused by a now-removed limit looked like a broken
              // button. `saveFailDetail` is cleared on the next attempt.
              const reason =
                body !== null && typeof body === 'object' && typeof body.error === 'string' ? body.error.trim() : '';
              setSaveFailDetail(reason);
              setStatus('save-failed');
            }
          } catch (error) {
            warn('settings save failed', error);
            if (mountedRef.current) {
              setSaveFailDetail('');
              setStatus('save-failed');
            }
          } finally {
            inFlightRef.current = false;
            if (mountedRef.current) setBusy(false);
          }
        })();
        // `model` MUST be in the dependency list: the POST body is built from
        // this closure, so omitting it froze the request at the model value the
        // component had when Save was first created — a model-only change was
        // then sent as whatever was selected at mount time (usually "").
      }, [text, model]);

      const onClear = React.useCallback(() => {
        setText('');
        setStatus('ready');
      }, []);

      const onRetry = React.useCallback(() => {
        setAttempt((n) => n + 1);
      }, []);

      const loadFailed = status === 'load-failed';
      const message =
        status === 'saved'
          ? t('settings.saved')
          : status === 'save-failed'
            ? // Prefer the server's explanation; fall back to the generic copy
              // only when the failure had no reason attached (a network error).
              saveFailDetail !== ''
              ? t('settings.saveFailed') + ': ' + saveFailDetail
              : t('settings.saveFailed')
            : loadFailed
              ? t('settings.loadFailed')
              : status === 'saving'
                ? t('settings.saving')
                : status === 'loading'
                  ? t('settings.loading')
                  : '';

      // Whether the keyword box currently holds anything. This single fact
      // drives BOTH actions' availability, so save and clear can never
      // disagree with each other or with what the box shows.
      const boxEmpty = text.trim() === '';

      // Why the primary action cannot be pressed right now. The disabled STATE
      // is load-bearing (an unchanged document must not send a no-op write, and
      // a failed load must not overwrite settings that were never read), so the
      // reason is surfaced instead of the gate being loosened.
      const saveBlockedReason = loadFailed
        ? t('settings.loadFailed')
        : status === 'loading'
          ? t('settings.loading')
          : busy
            ? t('settings.saving')
            : !dirty
              ? t('settings.noChanges')
              : '';
      // Save answers "did ANY setting change", not "is the keyword box full".
      // It used to require a non-empty box, which made a model-only change
      // unsaveable whenever the keywords happened to be blank — the same
      // `boxEmpty` flag that legitimately gates Clear was gating Save too.
      // Clear is the one that must follow the box: with nothing typed there is
      // nothing to clear.
      const saveDisabled = busy || loadFailed || status === 'loading' || !dirty;
      const clearDisabled = busy || status === 'loading' || loadFailed || boxEmpty;

      /**
       * A stored model that the live catalog does not list still has to be
       * SHOWN. `<select value>` with no matching `<option>` silently falls back
       * to the first option, so a saved `provider::model` whose provider is
       * temporarily unlisted (adapter not loaded, model retired, sign-in
       * changed) painted the control as "follow the agent" while
       * `modelSaved` still held the real value. The UI then disagreed with
       * what is stored, and the first edit to either setting persisted the
       * WRONG model — the displayed default instead of the saved choice.
       *
       * The fix is one extra option that exists only in that mismatch, so the
       * control keeps showing the truth without pretending the entry is
       * selectable from the catalog.
       */
      let modelInCatalog = model === '';
      for (let gi = 0; gi < modelGroups.length && !modelInCatalog; gi += 1) {
        const group = modelGroups[gi];
        const entries = group !== null && typeof group === 'object' && Array.isArray(group.models) ? group.models : [];
        for (let mi = 0; mi < entries.length; mi += 1) {
          if (String(group.provider) + '::' + String(entries[mi].id) === model) {
            modelInCatalog = true;
            break;
          }
        }
      }
      const showRetainedModel = model !== '' && !modelInCatalog;

      return h(
        'div',
        { className: 'dpe-section' },
        h('div', { className: 'dpe-section-head' }, t('settings.title')),
        h('p', { className: 'dpe-section-desc' }, t('settings.description')),
        h('label', { className: 'dpe-section-label', htmlFor: 'dpe-keywords' }, t('settings.keywordsLabel')),
        h('textarea', {
          id: 'dpe-keywords',
          className: 'dpe-section-input',
          rows: 6,
          spellCheck: false,
          placeholder: t('settings.keywordsPlaceholder'),
          value: text,
          // Editing is refused while the stored value is unknown: anything
          // typed then saved would replace keywords the user cannot see.
          disabled: busy || status === 'loading' || loadFailed,
          onChange: (event) => {
            setText(event.target.value);
            if (status === 'saved' || status === 'save-failed') setStatus('ready');
          },
        }),
        h('p', { className: 'dpe-section-hint' }, t('settings.keywordsHint')),
        // The enhancement-model picker: its own row, its own value, its own
        // hint. Options come from the account's live catalog; '' is the
        // explicit "follow the agent" default and is always present.
        h('label', { className: 'dpe-section-label', htmlFor: 'dpe-model' }, t('settings.modelLabel')),
        h(
          'select',
          {
            id: 'dpe-model',
            className: 'dpe-section-input dpe-section-select',
            value: model,
            disabled: busy || status === 'loading' || loadFailed || modelsState === 'loading',
            onChange: (event) => {
              setModel(event.target.value);
              if (status === 'saved' || status === 'save-failed') setStatus('ready');
            },
          },
          h('option', { value: '' }, t('settings.modelDefault')),
          showRetainedModel
            ? h('option', { value: model }, model + ' · ' + t('settings.modelUnavailable'))
            : null,
          modelGroups.flatMap((group) =>
            group.models.map((entry) =>
              h(
                'option',
                { key: group.provider + '::' + entry.id, value: group.provider + '::' + entry.id },
                group.name + ' · ' + entry.name
              )
            )
          )
        ),
        h(
          'p',
          { className: 'dpe-section-hint' },
          modelsState === 'unavailable' ? t('settings.modelUnavailable') + ' — ' + t('settings.modelHint') : t('settings.modelHint')
        ),
        h(
          'div',
          { className: 'dpe-section-actions' },
          h(
            'button',
            {
              type: 'button',
              className: 'dpe-section-save',
              onClick: onSave,
              disabled: saveDisabled,
              // Paint and behaviour read the same flag, so the muted look can
              // never appear on a button that still works (or vice versa).
              // For Save that flag is "is save unavailable", NOT "is the box
              // empty": a pending model change is saveable with a blank box.
              'data-empty': saveDisabled ? 'true' : 'false',
              // A greyed control with no explanation reads as broken. Keyboard
              // and screen-reader users get the same reason through
              // aria-disabled + the title; pointer users get it on hover.
              'aria-disabled': saveDisabled ? 'true' : 'false',
              title: saveDisabled && saveBlockedReason !== '' ? saveBlockedReason : undefined,
            },
            busy ? t('settings.saving') : t('settings.save')
          ),
          h(
            'button',
            {
              type: 'button',
              className: 'dpe-section-clear',
              onClick: onClear,
              // Clearing only edits the local draft, which still has to be
              // Saved. It is unavailable exactly while the box is empty —
              // there is nothing to clear, so it joins save in the muted look
              // rather than sitting there looking pressable.
              disabled: clearDisabled,
              'data-empty': boxEmpty ? 'true' : 'false',
              'aria-disabled': clearDisabled ? 'true' : 'false',
              title:
                clearDisabled && !busy && loadFailed === false && status !== 'loading'
                  ? t('settings.keywordsHint')
                  : undefined,
            },
            t('settings.clear')
          ),
          loadFailed
            ? h(
                'button',
                { type: 'button', className: 'dpe-section-retry', onClick: onRetry, disabled: busy },
                t('settings.retry')
              )
            : null,
          message !== ''
            ? h('span', { className: 'dpe-section-status', role: 'status' }, message)
            : null
        )
      );
    }

    return {
      name: 'prompt-enhancer', // = fiber.name → entry.registrant (client-runner:555)
      inject: ['slots', 'locale'],
      apply(ctx) {
        // Dictionaries first: the slot's `t` must resolve on its first render.
        // The service throws when a namespace already holds a locale, which
        // happens on a re-apply before the previous effect's cleanup settles;
        // that is not fatal (the old dictionary is still installed), so the
        // failure is contained rather than allowed to abort `apply`.
        ctx.effect(() => {
          try {
            return ctx.locale.register(NS, {
              en: DICTS.en,
              zh: DICTS.zh,
            });
          } catch (error) {
            warn('locale registration skipped', error);
            return () => {};
          }
        }, 'prompt-enhancer: copy');
        const t = ctx.locale.bind(NS);

        ctx.effect(installStyles, 'prompt-enhancer: styles');

        ctx.slots.inject('conversation.input.right', () =>
          ctx.slots.register(
            {
              name: 'conversation.input.right',
              id: 'prompt-enhancer',
              // Negative order sorts this entry ahead of the row's other
              // occupants (the WorkBuddy credit readout registers at 4) while
              // the whole row still renders before `conversation.input.model`.
              order: -20,
              inject: () => ({ t }),
            },
            (props) => h(Guard, null, h(PromptEnhancerButton, props))
          )
        );

        // The plugin's own page in Settings, positioned just after the shipped
        // `plugins` section (order 15) so it sits with the other plugin pages.
        ctx.slots.inject('settings.section', () => {
          const disposeSection = ctx.slots.register(
            {
              name: 'settings.section',
              id: 'prompt-enhancer',
              order: 16,
              locale: NS,
              label: () => t('settings.title'),
              inject: () => ({ t }),
            },
            (props) => h(Guard, null, h(SettingsSection, props))
          );
          const disposeIcon = ctx.slots.inject('settings.section.icon', () =>
            ctx.slots.register({ name: 'settings.section.icon', id: 'prompt-enhancer', locale: NS }, () =>
              h(
                'svg',
                {
                  viewBox: '0 0 16 16',
                  width: 16,
                  height: 16,
                  fill: 'none',
                  'aria-hidden': true,
                  focusable: false,
                },
                h('path', {
                  d: 'M8 1.6l1.15 2.9a3.2 3.2 0 0 0 1.85 1.85l2.9 1.15-2.9 1.15a3.2 3.2 0 0 0-1.85 1.85L8 13.4l-1.15-2.9a3.2 3.2 0 0 0-1.85-1.85L2.1 7.5l2.9-1.15a3.2 3.2 0 0 0 1.85-1.85L8 1.6z',
                  stroke: 'currentColor',
                  strokeWidth: 1.2,
                  strokeLinejoin: 'round',
                })
              )
            )
          );
          return () => {
            try {
              disposeIcon();
            } catch (_ignored) {}
            try {
              disposeSection();
            } catch (_ignored) {}
          };
        });
      },
    };
  },
});
