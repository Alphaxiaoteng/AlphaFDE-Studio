var e=`---
name: asset-import
description: Use when acquiring or importing media into a OpenChatCut project asset library for video editing or creation, including local/attached videos, user-provided paths, public media URLs, web video/audio/image assets, upload fallback decisions, and deciding between import_media, download_media, or manual user action.
---

# Asset Import

This build runs the editor and its media server locally. There is no hosted import API, no CLI, and no OAuth: media enters the project through the editor UI or through the agent tools below. Pick the path by where the bytes live.

## Path 1 — user's local files (primary)

Ask the user to drag the files into the editor (preview canvas or 我的素材 panel) or use the upload button. The local pipeline then runs automatically: streaming write to \`/media/uploads/\`, conditional transcode (≤1920 long edge, browser-friendly codec, ~8Mbps), audio extraction, and auto-transcription (ASR starts on upload). Do not ask the user to pre-convert, pre-trim, or transcode anything themselves — the pipeline handles it.

The agent cannot read the user's filesystem. If the user gives you a \`/Users/...\` or \`C:\\...\` path, tell them to drop that file into the editor instead; you cannot fetch it.

## Path 2 — public URLs (agent-driven)

Use \`download_media\` with up to 4 URLs per call. The server fetches, stores under \`/media/uploads/\`, and registers pool assets. Prefer this for stock/web media the user pointed at. After download, the asset behaves exactly like an upload (same transcode/ASR pipeline).

## Path 3 — placeholder before bytes (timeline-first work)

Call \`import_media\` with \`{"action":"register_placeholder"}\` to mint a deterministic \`assetId\` and pool row before bytes exist. Use it when you want to lay out the timeline (\`edit_item\` etc.) while an upload is still in flight; the asset relinks automatically when bytes land. Report progress precisely: once the placeholder is registered say the \`assetId\` is known; while bytes are still uploading say so — never claim a file is ready before \`track_progress\` (target=upload) confirms it.

\`import_media\` with \`{"action":"create_session"}\` returns local direct-upload endpoints (\`POST /upload?name=...&assetId=...\`). This is for host-side scripts the *user* runs in their own terminal (e.g. \`curl -T file '/upload?...'\` against the dev server); the agent sandbox cannot reach localhost, so do not try to upload from \`run_code\`.

## Editing discipline

For multi-source edits, build reviewable work from original source assets in the OpenChatCut timeline. Do not locally concatenate, pre-trim, pre-compose, burn captions, or flatten media before import — import originals and do all composition on the timeline so every step stays reviewable and undoable.

For code assets such as hand-authored Motion Graphics, use the \`create-motion-graphics\` skill (\`create_motion_graphic_from_code\` for new assets, asset-code updates for edits) — MG code is not an imported file.

## Storage notes

- Bytes live on the local disk (\`/media/uploads/\`), served directly with Range support. If Cloudflare R2 is configured, uploads mirror to R2 and other devices can hydrate from it; without R2 the project is local-only.
- Local-only is a valid end state: preview, editing, and export all read from disk. Cloud mirroring is only needed for cross-device access.
`,t=`---
name: create-motion-graphics
description: "Use whenever the agent needs to add, create, hand-author, patch, or place Motion Graphic JSX assets in a OpenChatCut project. This is the direct-authoring path: use create_motion_graphic_from_code / edit_asset / edit_item, not motion-graphic-gen or submit_motion_graphic. Covers project/timeline intake, project visual language, editable properties, asset binding, inline JSX authoring, existing asset updates, timeline placement, and verification."
---

# Create Motion Graphics

Use this skill when a OpenChatCut task requires a Motion Graphic asset that the agent will author or patch as inline JSX.

This skill is for direct authoring. Do not translate the request into a Gemini prompt or generation brief, and do not call \`submit_motion_graphic\`, when this workflow is active.

Even though \`submit_motion_graphic\` exists in the tool list, treat it as the generation route, not this one. Ignore that path for MG work; use \`create_motion_graphic_from_code\` for new JSX assets and \`edit_asset\` for existing MG JSX. If the direct-authoring tools are missing, stop and report that the OpenChatCut tool surface is out of date.

Pass source inline through the asset code tools. Do not stage Motion Graphic code in the OpenChatCut repository, \`ai-working/\`, \`/tmp\`, a local HTTP server, generated code files, or guessed backend workspace paths.

## Core Principles

- Inspect project state when canvas size, fps, existing visual language, placement, or timeline conflicts are not already known.
- Identify the required inputs in **Before You Code** before authoring JSX.
- Create or update Motion Graphic assets through the available inline-code asset workflow; use current tool schemas for exact payload shapes.
- Place or move assets through the timeline editing workflow when the edit requires timeline placement.
- Re-read project state and verify the visible frame after structural or visual changes.

## Before You Code

Before writing JSX, identify only the information needed for this edit:

- **Placement**: start time, duration, target layer if known, and the target frame the graphic must compose with.
- **Role in the edit**: what job this Motion Graphic performs in the video.
- **Content**: exact text, numbers, media, or visual facts that must appear.
- **Timing**: whether internal motion should sync to speech, music, or a visual event.
- **Visual source**: user-provided style, project Design Style, brand colors/fonts, or an accepted existing Motion Graphic.
- **Editable fields**: which text, colors, numbers, booleans, image, or video values should become properties.

Ask only for missing high-leverage inputs that would materially change the result.

## Align With The User

You are the junior designer; the user is the manager. Direction is the high-leverage choice — surfacing it before authoring is much cheaper than reauthoring after.

Style alignment gate:

Separate visual direction from batch permission. A user-named text/custom style can choose the direction, but it does not permit multiple MGs until the user has confirmed a representative MG. Batch authoring is permitted only by an active Design Style, a selected visual preset, or a previously accepted representative MG.

- If there is no active Design Style and the user has not named a style, stop before authoring and ask the user to choose a direction.
- Generic quality adjectives are goals, not a named visual style. If the user only says the MGs should feel clean, premium, modern, professional, polished, or similar, offer catalog presets instead of inventing a direction.
- Prefer catalog Design Style presets: call \`manage_design_style\` with \`action: "list"\`, present 3-6 reasonable choices, and let the user pick or override.
- Load the \`widget-forms\` skill and use \`ask_followup_questions\` with a single-select field of preset names; this build has no preset thumbnails, so concise numbered choices are the standard route.
- You may recommend one choice, but still show the choice set. The point is visual alignment, not a single best guess.
- When it isn't obvious, also ask whether the MG sits over the video as an overlay or takes the whole frame.

Before authoring, choose the branch:

- One MG: use the active Design Style, accepted example, or user-named direction and proceed.
- Multiple MGs with an active Design Style, selected visual preset, or previously accepted representative MG: proceed with a batch design map.
- Multiple MGs with only a textual/custom direction, however clear: create exactly one representative MG, place it, render its composed frame, then stop for confirmation. Do not create a second MG asset or item before the user confirms.
- Multiple MGs with only generic quality adjectives: use the visual preset picker first.

When the task needs visual style alignment, check the active project Design Style first. If there is no active Design Style and the user has not given a clear style direction, use the style alignment gate above.

Saved user design styles are a library, not project confirmation. If \`manage_design_style list\` shows saved styles but no active project Design Style, do not infer or choose one silently; use \`action: "list"\` and explicit alignment unless the user selects a saved style or asks you to use one.

Catalog Design Style presets are named starting points with style summaries (no image previews in this build). When no active Design Style or user style is set, first look at the available catalog candidates with \`action: "list"\` and show 3-6 reasonable starting points as concise numbered choices (name + one-line summary). They do not need to match every detail of the user's request; presets set useful expectations and can be adapted in authoring. Do not force catalog presets when none are reasonably close; use text directions only then.

When using catalog presets, call \`manage_design_style\` with \`action: "list"\`. Pick 6 matches using each preset's \`description\` as agent-facing matching guidance when there are enough reasonable matches; use fewer only when fewer presets genuinely fit. Never render the full catalog as user-facing choices. Use \`ask_followup_questions\` with one single-select field, mapping each preset to \`{id: presetId, label: name}\`; this build has no thumbnails, so concise numbered choices are the standard route. Do not invent \`value\`, \`name\`, or \`media\` for catalog choices, and do not mix custom non-preset directions into the same visual picker. If a custom direction would help, describe it in prose outside the picker. Do not repeat catalog descriptions under the picker unless the user asks for details. Frame catalog options as visual starting points, not required choices: briefly make clear in the user's language that they can pick a close option or describe a different direction. If the user asks to refresh, call \`action: "list"\` again and show a different set of up to 6 reasonable matches. Do not repeat presets already shown in the current style-picking exchange; show fewer than 6 rather than repeat. Apply the user's pick with \`action: "apply"\`. After applying a preset or saved style, call \`manage_design_style\` with \`action: "get"\` before authoring MG code; preset names and list summaries are picker guidance, not the full motion/design spec. Do not create or update a Design Style from an unconfirmed recommendation.

The visual style picker is a turn boundary. After calling \`ask_followup_questions\` for style alignment, stop and wait for the user's submitted selection. Do not apply a preset, create MG assets, inspect more frames, or continue detailed MG planning from your own recommendation in the same turn.

For a batch of related MGs in one scene or topic, ask once for a shared direction — don't invent a different aesthetic per item, and don't ask per MG.

When the batch direction is textual or custom rather than a visual preset or active Design Style, the representative-MG gate above is a hard stop. A user-named text style skips only the preset picker; it does not confirm the visual language for multiple MGs. The representative MG validates visual language only; it does not define the form for every later MG.

The only times to skip the style picker:

- The user has already named a visual style, material, reference, or visual language ("做 editorial 杂志风的", "做个 80s 复古印刷", "magazine style 那种") — use it verbatim as the direction. For multiple MGs, this still enters the representative-MG branch until the user confirms the example.
- The user has explicitly waved off alignment ("直接做" / "don't ask, just do it"): make your best guess, name it in chat, then continue with the normal authoring, frame-inspection, and consistency workflow.

## Project Visual Language

Use the active project Design Style, user-provided style, brand assets, or an accepted existing Motion Graphic as the visual language for hand-authored JSX. A visual language means shared palette, typography logic, motion tone, spacing, density, material treatment, and level of polish.

When a Design Style is active, work from its full \`designSpec\` / \`styleGuide\`, not only its name or catalog summary. Treat explicit style rules for motion, typography, color, and material as implementation constraints.

Treat Design Style structure, materials, and template notes as visual vocabulary, not default containers. Express the style through typography, marks, geometry, texture, motion, spacing, and materials; use a bounded reading surface only when bounded reading is the actual editorial mechanism.

Do not create or update a project Design Style just because a one-off Motion Graphic needs styling. For multiple Motion Graphics in the same video, keep one coherent visual system unless the user asks for a deliberate contrast, and let each MG's content and editorial job determine its form.

## Visual System And Placement

Treat multiple MGs in the same video as one visual system. Shared style comes from palette, typography, motion tone, spacing, material, and polish.

Before authoring a batch, make a compact design map for the planned MGs: viewer job, content, visual mechanism, how it carries meaning beyond text, speech span, settled frame, read time, size, composition relationship, internal motion beats, and whether its form is intentionally recurring.

Let each MG's content and editorial job determine its form. Keep the same visual language while choosing the composition, size, placement, duration, and rhythm that fit that moment.

Choose the visual mechanism before writing JSX. Decide how the graphic carries meaning beyond text, using the confirmed visual language and the content's viewer job. Name a wrapper as the form only when a bounded reading surface is truly the right mechanism.

Text should rarely carry the whole graphic alone. Pair key words, stats, or claims with a tangible non-text visual role so the result is not just copy inside a wrapper.

Common defaults must earn their place. Use a bounded reading surface only when bounded reading is the editorial mechanism; otherwise let the MG's form come from the frame relationship and viewer job.

Reuse an MG asset only for an intentionally recurring component with the same viewer task, information structure, and visual form. Shared palette, typography, motion, or a bounded-surface treatment is visual language, not a reason to reuse the same asset.

Placement and duration are part of the settled frame composition. Choose each MG's position, size, anchor, start, and end from the relationship between the speech span, inspected frame, reading time, and visual job. Do not use a fixed safe-zone as the default placement; repeated anchors are intentional only when the frame relationship and viewer task recur. If the graphic does not feel integrated with the moment it explains, change its form, timing, scale, or skip.

Match the MG asset duration to the timeline span it is designed to occupy. Internal motion beats must complete inside the placed item duration; when the edit timing changes materially, update or recreate the MG instead of relying on a shorter timeline item to truncate a longer asset.

In a batch, compare the composed settled frames side by side. The MGs should share a visual language, but repeated surfaces, anchors, or rhythms should point to a recurring viewer job; otherwise revise the form, placement, or timing before reporting done.

Create the asset shape that fits the job at hand. For overlays, the asset box should tightly bound the visible graphic's local composition. Use timeline dimensions only when visible design intentionally spans the whole frame.

## Editable Properties

Expose user-visible and likely-to-change values as editable properties.

- Visible text, primary colors, accent colors, and key numeric values should be properties.
- Font choices should be \`font\` properties when users may reasonably change them.
- Image and video sources must be \`image\` / \`video\` properties.
- Code keys must match the property schema keys exactly.
- Read values from \`item.props\`; do not hardcode visible content that the user may reasonably want to change later.
- Use item-level property overrides only for intentionally recurring components with the same viewer task, information structure, and visual form. If any of those differ, create another MG asset and share palette, type, and motion logic instead.

Property entries should declare a stable key, user-facing label, type, and default value. Supported property types include text, number, color, boolean, select, font, image, and video.

## Fonts

Motion Graphics must use fonts the cloud renderer can load. Do not rely on local/system fonts such as \`STKaiti\`, \`PingFang SC\`, \`Microsoft YaHei\`, \`Arial\`, \`Helvetica\`, \`Comic Sans MS\`, \`system-ui\`, \`-apple-system\`, or generic CSS families as the primary rendered font; preview may have them locally, but export will fall back to the default stack.

When choosing or replacing a font, call \`search_fonts\` and use the returned canonical family name verbatim as the \`fontFamily\` value and matching \`font\` property \`defaultValue\`. Use Google Fonts or project custom fonts returned by the catalog. If a user explicitly asks for an unsupported local font, explain that cloud export cannot preserve it, search for a supported alternative with a similar feel, and use that supported family unless the user explicitly accepts export fallback.

## Assets

Images and videos rendered inside Motion Graphics must already be registered as project assets or otherwise be passed through editable asset properties.

- Do not hardcode media URLs in JSX.
- Use \`<Img>\` and \`<Video>\` only with URLs read from \`item.props\`.
- Guard empty image/video properties before rendering; an empty \`src\` can crash the runtime.
- To swap a rendered asset for one timeline instance, update that instance's editable property values rather than changing the shared asset code.

## Design Principles

The agent is the designer for direct-authored Motion Graphics. Do not merely satisfy constraints or place text in a wrapper. Before writing JSX, design the settled frame as a specific visual object.

Before writing code, decide:

- **Purpose**: what the viewer should understand faster because this MG exists.
- **Direction**: the specific visual language, not "clean", "modern", or "professional" alone.
- **Memory**: the one visual idea, spatial move, or motion beat the viewer should remember after 3 seconds.
- **Mechanism**: how typography, geometry, diagram, texture, image, or motion carries meaning beyond text.
- **Craft**: how typography, color, motion, spatial composition, and material treatment follow the chosen direction.

Before writing code, choose a clear aesthetic direction for this specific design. Commit to one direction and execute it with precision rather than defaulting to a generic look.

Default quality bar: distinctive, production-grade, and intentional. When the user has not specified a style and asks you to proceed, choose a specific visual direction with a point of view. Do not fall back to safe, basic, or generic just because the style is unspecified.

Restrained does not mean plain. Minimal or refined MGs still need a named design language, precise hierarchy, and one memorable visual decision.

Treat the Design Style's motion language as a constraint, not just mood. If it says hard cut, no opacity, no translate, no glow, no easing, word-by-word, static bars, or sequential nodes, implement those literally; do not replace them with fades, springs, sweeps, glows, or drifting motion.

Motion must earn its place. Do not add shine, sheen, light-sweep, scan-line, shimmer, glow, or glossy passes as default polish; use them only when the style or editorial job explicitly means scanning, loading, reflection, energy, or detection. Prefer typography, masks, stagger, data bars, and timing tied to the content.

Material treatment belongs to the visual language. Do not add glass, blur, heavy shadows, gradients, grain, paper texture, glow, or other surface polish just to make the surface feel designed; use those materials only when the confirmed style or visual job calls for them.

When the graphic includes text, create clear hierarchy. Use the Design Style's type system when it exists. When no type system is defined, make size, weight, spacing, and timing contrast visible at video scale.

Design the most visible frame first, then animate into that layout. Choreograph by importance: the first moving element is the hierarchy leader. Vary direction, duration, easing feel, and stagger rhythm when the visual job changes.

Anti-slop rules are a floor, not a ceiling. Avoid generic AI-generated aesthetics: purple/blue gradient backgrounds, fake glassmorphism everywhere, predictable feature-tile layouts, or cookie-cutter design that lacks context-specific character. Within one visual system, vary form, composition, and rhythm when the visual job changes; keep color and typography logic coherent enough that the MGs belong together.

Do not default to card-shaped overlays. Unless a bounded reading surface is truly needed, avoid floating panels, tickets, notes, or rounded rectangles that simply hold text; they often feel detached from the footage and make the video look like UI rather than motion design.

Use strong materials, texture, gradients, glow, depth, dense composition, or bold motion when they are part of the confirmed visual language or the editorial job. Do not avoid expressive design just because a generic version of the same effect would be bad.

Do not default to centered, symmetrical layouts. Consider asymmetry, overlap, generous negative space, or controlled density, whichever fits the content. Unexpected spatial choices make motion graphics feel designed, not generated.

A character, illustration, or compound shape is one visual entity. When multiple parts must visually connect, attach, or align, render those parts inside a single \`<svg>\` with one shared coordinate space and named anchors. Independent hardcoded \`left\` / \`top\` across separate wrappers produces visible gaps.

### Text Layout Safety

For text-bearing MGs, design the settled frame as a real layout before animating. Use flexbox or grid, \`gap\`, \`padding\`, \`maxWidth\`, \`lineHeight\`, and natural wrapping for related text blocks. Do not stack readable text with independent hardcoded \`top\` values unless the text is intentionally decorative or typographic art.

Editable text may become longer than the default. Reserve space for plausible longer copy, allow wrapping with \`whiteSpace: "normal"\` and \`overflowWrap: "break-word"\`, and reduce hierarchy, size, density, or change form when the content cannot fit cleanly.

Animated transforms do not affect layout. If text scales, pulses, slides, or staggers near other text, leave visual headroom for the largest animated state. Intentional overlap may be used for graphic layers, shadows, marks, or decorative typography; ordinary readable text must not collide.

Avoid forced \`<br>\` or manual line breaks for dynamic text unless each line is deliberately fixed. Prefer width-constrained wrapping.

Use this base component shape:

\`\`\`javascript
const Component = ({ item }) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();

  const props = item.props || {};
  const accentColor = props.accentColor;

  const rootStyle = {
    position: "absolute",
    inset: 0,
    backgroundColor: "transparent",
  };

  return <div style={rootStyle}>{/* content */}</div>;
};
\`\`\`

## Motion Graphic Code Contract

Violations cause runtime crashes. Strict compliance required.

1. **Syntax:** Pure JavaScript JSX. No TypeScript.
2. **Imports:** No import statements. Globals are pre-injected: \`React\`, \`spring\`, \`useCurrentFrame\`, \`useVideoConfig\`, \`interpolate\`, \`interpolateColors\`, \`Math\`, \`random\`, \`Easing\`, \`AbsoluteFill\`, \`Sequence\`, \`Series\`, \`Img\`, \`Video\`, and \`Audio\`.
3. **No Remotion global:** Never use \`Remotion.xxx\` or \`const { ... } = Remotion\`. Hooks and components are pre-injected as standalone globals.
4. **Exports:** No \`export default\`. Define \`const Component = ...\`.
5. **Timing:** No \`Sequence\` wrappers inside the component. Use flat frame-driven logic.
6. **Logic:** No inline logic in JSX props. Pre-compute values in variables before \`return\`.
7. **Helpers:** No undefined functions. Use \`interpolateColors\` plural. Define any helpers locally.
8. **AbsoluteFill:** \`AbsoluteFill\` is a component, not a style object. Never spread it. It may be used for inner layers, but never as the root.
9. **Root element:** The root must be \`<div style={rootStyle}>\`.
10. **Assets:** \`<Img>\` and \`<Video>\` sources must read from image/video editable props. Never hardcode URLs. If no assets are provided, design with shapes, text, and CSS.
11. **Hooks:** Get frame from \`useCurrentFrame()\`, not from \`useVideoConfig()\`.
12. **Local box:** Component must accept \`({ item })\` props. The asset \`width\`/\`height\` are the MG's natural box around its visible local composition, not the timeline canvas; fill that box with \`position:absolute; inset:0\`. Timeline placement sets final screen size and position.
13. **Layout control:** Use flexbox or grid for text blocks and structured content. Use SVG or absolute geometry when the design depends on spatial relationships, compound shapes, frame treatments, or drawn/animated marks. Allow text to wrap naturally unless the request requires single-line text.
14. **Editable props:** Component must read editable values from \`item.props\`. Never add fallback values like \`|| "Default"\` or \`?? false\` after \`props.key\`; declared runtime properties already have values.
15. **Property schema:** Declare matching editable properties. Include all visible text content and primary/accent colors.
16. **Image/video props:** Guard empty URLs; only render \`<Img>\` or \`<Video>\` when the URL is truthy.
17. **Background:** Default background is transparent. If a background surface is added, expose a \`transparentBackground\` boolean property.

## Placement And Review

Do not author JSX from timing alone. Inspect the target frame first: timing tells you when; the frame tells you form, placement, and background. For a batch of overlays, make one target-frame screenshot/contact sheet and decide each MG's settled frame, speech span, read time, and placement relationship before choosing final anchors, sizes, and durations.

Design the settled frame first: choose the moment when the MG is most readable, place the final layout there, then animate into that composition.

Before authoring JSX, make four linked editor decisions. They prepare the Motion Graphic asset and the later timeline placement.

| Decision               | Question                                                               | Output                                                           |
| ---------------------- | ---------------------------------------------------------------------- | ---------------------------------------------------------------- |
| **Content**            | What idea deserves a visual layer?                                     | The message or visual fact the MG expresses.                     |
| **Timing**             | When should it land and leave?                                         | Speech span, read time, duration, and any internal motion beats. |
| **Form and placement** | What kind of MG is it, and where does it belong in the composed frame? | MG form/size, then \`edit_item\` placement after asset creation.   |
| **Background**         | Is this an overlay on the footage, or its own moment?                  | Transparent or opaque background.                                |

Placement principles:

- Compose the footage and MG together from the frame you inspected: subject, camera framing, visual weight, captions/subtitles when present, and the MG's job.
- Place the MG where it makes the frame read best for that moment.
- Keep necessary information readable at video scale without zooming; if the MG feels detached, change form, timing, scale, or skip.
- Account for captions only when captions are present or planned.
- Treat full-frame MGs as intentional beats, not as a workaround for awkward overlay placement.

Default to a transparent overlay unless a full-frame beat is intended. A transparent overlay still uses a natural-box asset; do not use a transparent timeline-sized asset just for placement.

Place and review:

- Place with \`edit_item\` (adds/updates). Prefer an explicit rectangle once you know the frame: one horizontal anchor, one vertical anchor, width, and height.
- Verify with screenshots. Pass multiple frames in one tool call — settled state appears alongside any transient mid-animation frames. Compare frames before concluding: apparent truncation, missing elements, or "broken design" visible in only some of the batch is animation, not a real flaw. If unclear, re-capture more frames around the suspect one before adjusting anything. Judge from the settled frames.
- Check the full frame: necessary information is clear at video scale, captions remain readable when present, MG content is correct, text is legible, and the composition feels balanced and intentional.
- For text-heavy MGs, inspect the settled frame where the most text is visible. Check for text-on-text overlap, clipped lines, overflow outside the natural asset box, and readable content covered by animated scale or translate states.
- If it fails, first adjust position and size. If position/size cannot make it work, change the design form. Verify each recurring component form on a target frame before expanding it.

## Asset And Timeline Flow

### Create A New Asset

Create new Motion Graphic assets by passing inline JSX and editable property metadata through the current OpenChatCut asset-creation tool. Use the tool schema for the exact field names and accepted duration format.

Choose the MG's natural box, duration, asset name, description, and property schema from the edit requirements. The asset duration should match the intended placed span, including internal entrance, hold, and exit timing. The asset creation step only creates the asset; timeline placement is separate.

For \`create_motion_graphic_from_code\`, pass that natural box as \`width\`/\`height\`; use timeline dimensions only for intentional full-frame MGs. If the content occupies only part of the screen, place and scale the bounded asset with \`edit_item\` instead of baking screen coordinates into a full-canvas MG.

### Patch An Existing Asset

Before patching, inspect the existing asset code and property schema. Preserve unrelated behavior, property keys, and timeline timing unless the requested change requires otherwise.

Read [\`references/canvas-pipeline-rules.md\`](references/canvas-pipeline-rules.md) before changing code, especially when SVG is involved. Patch with full inline replacement source through the current asset-update tool.

### Place On The Timeline

Use the timeline editing workflow for placement, movement, trimming, and per-instance property overrides. Dry-run large or uncertain transactions when the tool surface supports validation.

## Implementation Rules

Read [\`references/canvas-pipeline-rules.md\`](references/canvas-pipeline-rules.md) before any asset-code update, when writing or modifying SVG, or when preview looks correct but export renders black or empty.

## Verification

A successful tool call is not verification.

- Re-read asset state after asset creation or update.
- Re-read timeline state after placement, movement, trimming, or property overrides.
- For visible changes, inspect a real composed frame using the normal OpenChatCut visual verification path.
- For a batch, compare the composed settled frames side by side; verify that each visual job has a fitting form, repeated surfaces/anchors/rhythms are intentional, and each placement works for its own target frame.
- If the result is wrong, classify the failure before retrying: invalid tool shape, invalid JSX, missing/incorrect property key, timeline placement, async asset readiness, or canvas/export safety.
- Fix placement with timeline edits; fix bad rendering with JSX/property changes; use canvas rules for preview-good/export-black failures.
`,n='# Canvas Pipeline Rules (for hand-editing MG code)\n\nWhen you edit Motion Graphic asset code through any path that mutates `MotionGraphicAsset.code`, the **local export canvas pipeline** (Chrome\'s html-in-canvas API) samples the rendered output via `gl.texElementImage2D`, which reads the paint-phase snapshot — NOT the GPU compositor output. Preview uses a DOM layer instead and is not subject to these limits.\n\nThe backend may run additional review during asset creation, but not every asset-code update path has that same review. So when you (the editing agent) modify code by hand, **you are the only safeguard** against introducing patterns that make the entire MG render black in local export. The rules below are the ones the backend reviewer enforces during asset creation; mirror them here.\n\nIf you violate any pattern, the symptom is consistent: the affected motion graphic appears entirely black or empty in local export, even though preview in OpenChatCut and a normal browser both look correct. Preview rendering correctly is NOT evidence that export will work.\n\n## The three canvas-pipeline traps\n\n### 1. SVG inner-element `transform` attribute\n\nInside any `<svg>`, the OUTERMOST `<g transform="...">` is allowed. Any `transform=""` attribute on an inner `<path>`, `<line>`, `<rect>`, `<circle>`, `<ellipse>`, `<polygon>`, or a nested `<g>` breaks the canvas pipeline.\n\n**Wrong:**\n\n```jsx\n<svg width={W} height={H}>\n  <g transform="translate(960, 540)">\n    {leaves.map((l, i) => (\n      <g key={i} transform={`translate(${l.x},${l.y}) rotate(${l.rot})`}>\n        <path d="M0,0 C-25,-35 0,-90 0,-90" />\n      </g>\n    ))}\n  </g>\n</svg>\n```\n\n**Right** — bake rotation+translation into absolute path coordinates at `React.useMemo` time:\n\n```jsx\nconst leafPaths = React.useMemo(() => {\n  const tx = (px, py, cx, cy, deg) => {\n    const r = (deg * Math.PI) / 180;\n    return [\n      Math.cos(r) * px - Math.sin(r) * py + cx,\n      Math.sin(r) * px + Math.cos(r) * py + cy,\n    ];\n  };\n  const CONTROL_POINTS = [\n    [0, 0],\n    [-25, -35],\n    [0, -90],\n    [0, -90],\n  ];\n  return leaves.map((l, i) => {\n    const pts = CONTROL_POINTS.map(([x, y]) => tx(x, y, l.x, l.y, l.rot));\n    return {\n      key: i,\n      d: `M${pts[0][0]},${pts[0][1]} C${pts[1][0]},${pts[1][1]} ${pts[2][0]},${pts[2][1]} ${pts[3][0]},${pts[3][1]}`,\n    };\n  });\n}, [leaves]);\n\n<svg width={W} height={H}>\n  <g transform="translate(960, 540)">\n    {leafPaths.map((p) => (\n      <path key={p.key} d={p.d} />\n    ))}\n  </g>\n</svg>;\n```\n\n### 2. Animated CSS on the `<svg>` element itself\n\n`style.opacity` or `style.transform` directly on a `<svg>` element with a per-frame interpolated value breaks the canvas pipeline.\n\n**Wrong:**\n\n```jsx\n<svg style={{ opacity: interpolate(frame, [0,30], [0,1]) }}>...</svg>\n<svg style={{ transform: `scale(${animScale})` }}>...</svg>\n```\n\n**Right** — wrap in an HTML `<div>` for opacity; use SVG `transform=""` attribute on outermost `<g>` for scale:\n\n```jsx\n<div style={{ opacity: interpolate(frame, [0, 30], [0, 1]) }}>\n  <svg>\n    <g transform={`scale(${animScale})`}>...</g>\n  </svg>\n</div>\n```\n\n### 3. SVG `opacity` presentation attribute on inner elements\n\n`opacity={0.6}` on inner SVG elements (`<line>`, `<path>`, `<circle>`, etc.) has the same compositor-driven semantics as CSS `style.opacity` and breaks the pipeline.\n\n**Wrong:**\n\n```jsx\n<line opacity={0.6} stroke={accentColor} />\n<circle opacity={0.3} fill={mainColor} />\n```\n\n**Right** — bake alpha into stroke/fill color:\n\n```jsx\n<line stroke="rgba(255,255,255,0.6)" />\n<circle fill="rgba(255,165,0,0.3)" />\n```\n\n(If the color comes from an editable prop like `props.accentColor` and you can\'t precompute rgba, do the alpha conversion in `useMemo`: parse the hex prop, compute `rgba(r,g,b,a)`, and bind that as the stroke/fill string.)\n\n## When to re-read this\n\n- Before any update that changes `motion-graphic` asset `code`\n- When debugging a "preview looks fine but the exported MP4 renders black" report — almost always one of these three\n- When integrating an external SVG snippet that uses inner-element `transform=` (most hand-authored SVGs do; you\'ll need to bake the transforms)\n\n## Safe patterns (paint-phase, work correctly)\n\n- HTML element `style`: `boxShadow`, `textShadow`, static `opacity`, `transform` (translate/scale/rotate), `borderRadius`, gradients via `background` / `backgroundImage`\n- SVG: outer `<g transform="">` only; all inner shapes use absolute `d=""` coordinates\n- SVG-native filters in `<defs>` (`<feGaussianBlur>`, `<feBlend>`, `<feColorMatrix>`, `<feDropShadow>`) applied via the SVG `filter="url(#id)"` ATTRIBUTE on an inner element — these DO work (they run in the paint phase, not the compositor)\n',r='---\nname: export\ndescription: Use when a OpenChatCut video editing or creation workflow needs export, render, download, share, final delivery, subtitle-file export, render choice, local-only asset handling, or export fallback explanation.\n---\n\n# Export\n\nUse OpenChatCut\'s export tools for delivery. An export request should call `submit_export` (or `submit_render_job` for async), then use `track_export` for status and final delivery when the result is not returned immediately.\n\nDefault policy:\n\n- Prefer `submit_export` when the user asks to export/share/finalize the OpenChatCut timeline.\n- Keep originals local by default during editing. Upload originals only when a cloud export/proof needs remote assets and the user has not forbidden upload.\n- Do not wrap sandbox `ffmpeg` work as a OpenChatCut tool. Use sandbox `ffmpeg` for full video processing only when the user explicitly asks for a standalone local-file operation outside a OpenChatCut editing workflow. For OpenChatCut editing tasks, do not produce a pre-edited or flattened local render as the primary review/final deliverable; use OpenChatCut export.\n\n## Durable Export\n\nUse `submit_export` for the execution path:\n\n```json\n{\n  "format": "video",\n  "codec": "h264",\n  "resolution": "1080p",\n  "fps": 30,\n  "name": "final-cut"\n}\n```\n\nVideo codec options are `h264` (MP4, default) and `vp8` (WebM). Video frame-rate options match the editor UI: `24`, `25`, `30`, `50`, or `60`; omit `fps` to match the timeline. Audio export is MP3: pass `"format":"audio"` and omit `codec` / `fps` unless you explicitly pass `"codec":"mp3"`.\n\n`submit_export` returns a durable `renderId`. Some export types, such as subtitle files, may complete immediately and return `downloadUrl`; video/audio usually require `track_export` to wait for completion.\n\nAfter getting each `downloadUrl`:\n\n- Resolve the user\'s Downloads folder: `~/Downloads` on macOS/Linux, or `%USERPROFILE%\\Downloads` on Windows.\n- Before triggering any agent/browser download, check the Downloads folder for fresh Chrome download artifacts from the last few minutes that match the expected export name, extension, or render/download URL basename. Include both completed files and in-progress `.crdownload` files.\n- If a matching fresh `.crdownload` exists, do not trigger another download. Wait until Chrome removes the `.crdownload` suffix and the final file size stops changing, then use that completed file.\n- If a matching fresh completed file already exists, use it directly instead of downloading again.\n- If only older files exist, treat them as collisions, not as the current export.\n- Do not overwrite an existing file; choose a safe numbered filename such as `name (1).mp4` when needed.\n- Always download the finished export file into the Downloads folder, not a temp/workspace directory.\n- Always show the downloaded video inline in chat. If there are multiple exported videos, download all of them and show every preview, not just the first.\n\nIf the project contains local-only assets, upload/register cloud-readable replacements before rendering, or use the Local CLI Export path when the user wants to stay local.\n\nReport the returned `renderId` when present and tell the user the job is visible in the editor render-jobs panel.\n\nUse `track_export` when the user asks about export/render status, or when the current turn genuinely needs to wait for a submitted video/audio render. Completed connector exports return `downloadUrl`; for every completed entry, download the file to Downloads using the collision-safe rules above and show it inline in chat:\n\n```json\n{\n  "action": "status",\n  "renderIds": "abc123"\n}\n```\n\nFor the latest project export, omit `renderIds` and pass `"latest": true`. `track_progress` is for generation/transcription/upload jobs, not render jobs.\n\nFor NLE XML, use `submit_export` with `format:"xml"`:\n\n```json\n{\n  "format": "xml",\n  "nleFormat": "fcp_xml_resolve",\n  "timelineId": "abc123"\n}\n```\n\n`nleFormat` values are `fcp_xml` for Premiere XML (default) and `fcp_xml_resolve` for DaVinci Resolve XML. Omit `timelineId` for the active timeline, or pass a timeline id/prefix for a non-active timeline. Read and report warnings: captions, solids, SVG, unsupported clip attributes, and unrendered motion graphics may be dropped by the XML format. Motion graphics are only represented in XML when a transparent-ProRes MG export flow supplies `motionGraphicRenderKeys`; otherwise the exporter reports them as dropped.\n\nFor media-pool source download, use `request_asset_download` on a file-backed source asset. It returns a guarded backend download URL/path for the original source media. Do not use `pull_asset` for user downloads; `pull_asset` is sandbox-only.\n\nFor subtitle files, use `submit_export` with `format:"subtitles"`:\n\n```json\n{\n  "format": "subtitles",\n  "subtitleFormat": "srt"\n}\n```\n\nFormats are `srt` and `txt`. The export uses the captions item\'s actual timeline word timing, source scope, translation variants, display-text overrides, and pacing fields such as `wordsPerPage` / `maxCharactersPerLine`, and creates a durable downloadable export job. It is appropriate for downloadable subtitle files. It does not yet reuse the browser Remotion caption page planner, so visual line wrapping/page breaks are timing-correct but approximate rather than byte-identical to burned-in caption pagination. For non-active timelines, pass `timelineId` from `manage_timelines` or `read_project`.\n\nFor one motion graphic as transparent ProRes 4444, use `export_motion_graphic_prores`:\n\n```json\n{\n  "itemId": "abc123",\n  "filenameMode": "asset"\n}\n```\n\nPrefer `itemId` when exporting a specific timeline instance, because the item carries live `propertyOverrides` such as edited text. Use `assetId` for a media-pool motion graphic; the backend will use the first timeline instance for that asset when present, matching the editor\'s media-pool export behavior. For several motion graphics, pass `itemIds` or `assetIds` in one call. Each motion graphic still becomes a separate durable render; use `track_export` with the returned `renderIds` to wait, then download through each returned render download path.\n\nWhen preparing XML that should reference rendered motion graphics, pass `"filenameMode":"xml"` and the same `timelineId` to `export_motion_graphic_prores`, then keep the returned `motionGraphicRenderKey` / `motionGraphicRenderKeys`; after the render completes, pass those keys and the same `timelineId` in `submit_export.motionGraphicRenderKeys` with `format:"xml"`.\n\n## Local Render (this build)\n\nAll rendering is local: `submit_export` / `submit_render_job` drive the local render service (headless Chrome over the same timeline state the editor shows), reading media straight from `/media/uploads/` on disk. There is no S3 requirement, no CLI, and no cloud job to wait on for disk-backed assets.\n\n- `submit_export`: subtitles/XML return synchronously; video/audio also render in-call in this build (long timelines can take a while — warn the user instead of polling).\n- `submit_render_job` + `track_export`: the async route — returns a `renderId` immediately, poll with `track_export` (`renderIds` / `latest` / `onlyActive`), then hand the user the returned download path.\n- Assets still on `blob:` placeholders (upload in flight) are not renderable yet — wait for `track_progress` target=upload to report ready before submitting.\n\n## Fallbacks\n\nIf a render fails because an asset\'s bytes are missing (placeholder never relinked, file deleted from disk):\n\n1. Ask the user to re-link the asset in 我的素材 (离线素材横幅) or re-import the file.\n2. For URL-sourced media, re-run `download_media` to restore bytes, then resubmit.\n\nDo not tell the user they need to understand HTML-in-Canvas, Remotion, or storage internals unless debugging. Explain at product level:\n\n- "本地快速导出"\n- "素材还在上传，稍等再导"\n- "需要先重新链接本地素材"\n\n## Result Trace\n\nFor `submit_export`, record:\n\n- `renderId`\n- timeline/range/resolution/codec/fps\n- that the user can download from the editor render-jobs panel\n\nRecord uploaded asset IDs and any fallback tried when cloud export was blocked by local-only assets.\n',i=`---
name: image-gen
description: |
  AI image generation via gpt-image-2, nano-banana, and MiniMax image-01. Use when the user wants to generate or create an image / picture / still.
user-invocable: true
---

# Image Gen

Generate AI images via \`submit_image\` (configured provider keys only). Prefer one clear still per request unless the user asked for variants.

## Model Selection

| Model | Reference | Strengths | Max refs |
| --- | --- | --- | --- |
| \`gpt-image-2\` | [references/gpt-image-2.md](references/gpt-image-2.md) | Best text rendering, strongest prompt adherence | 16 |
| \`nano-banana\` | [references/nano-banana.md](references/nano-banana.md) | Strongest reference-image fidelity | 14 |
| \`image-01\` | [references/image-01.md](references/image-01.md) | MiniMax stills / live style; one subject reference via R2 | 1 |

- Default: \`gpt-image-2\` when that key is on.
- Reference-heavy → \`nano-banana\`.
- User named MiniMax / only MiniMax image key on → \`image-01\`.
- Respect capabilities: do not call a model whose vendor is not configured.

**IMPORTANT:** Before generating, READ the chosen model's reference.

## Tool Params

| Param               | Values                                                                  | Default |
| ------------------- | ----------------------------------------------------------------------- | ------- |
| \`aspectRatio\`       | \`1:1\`, \`16:9\`, \`9:16\`, \`4:3\`, \`3:4\`, \`3:2\`, \`2:3\`, \`4:5\`, \`5:4\`, \`21:9\` | \`16:9\`  |
| \`imageSize\`         | \`512px\`, \`1K\`, \`2K\`, \`4K\` (model-specific)                              | \`1K\`    |
| \`width\` / \`height\`  | GPT Image: 512–3840, /16; MiniMax: 512–2048, /8                         | —       |
| \`quality\`           | \`low\`, \`medium\`, \`high\`, \`auto\` (gpt-image-2 only)                      | \`high\`  |
| \`referenceAssetIds\` | Array of project asset ids — backend resolves bytes server-side         | —       |
| \`name\`              | Short descriptive asset name shown in the library                       | —       |
| \`count\`             | Number of images to generate (1–10; image-01 max 9)                     | \`1\`     |
| \`promptOptimizer\`   | MiniMax \`image-01\` only — \`prompt_optimizer\`                            | \`false\` |
| \`seed\`              | MiniMax \`image-01\` only                                                  | —       |
| \`maskAssetId\`, \`background\`, \`moderation\`, \`inputFidelity\` | GPT Image edit/output controls | — |
| \`outputFormat\`, \`outputCompression\` | GPT Image PNG/JPEG/WebP controls                         | PNG     |

## Defaults

- Aspect ratio: **16:9**. If the project composition is not 16:9, ASK the user which aspect ratio they want before generating.
- Size: **1K**.

## Ask Before Submit

- Never auto-upgrade size.
- Only pass \`imageSize: "2K"\` or \`"4K"\` when the user explicitly asks. Warn that 2K/4K are EXPERIMENTAL and may be slower.

## Reference Images

Use when the user provides source material to edit, blend, or use as visual guidance (e.g. "change the background", "combine these into a poster").

- Pass project asset ids via \`referenceAssetIds\`. The backend fetches and encodes them server-side — never pull the asset bytes yourself.
- When the user @-references an image asset, pass its id directly in \`referenceAssetIds\`.
- Formats accepted by backend: png, jpeg, webp, svg (auto-rasterized to png), heic, heif. Each ≤ 50MB.

## Run

\`\`\`ts
// Basic generation
submit_image({
  model: "gpt-image-2",
  prompt: "a cute orange cat",
  name: "Cat",
});

// With quality (gpt-image-2 only)
submit_image({
  model: "gpt-image-2",
  prompt: "hero poster with bold title",
  quality: "high",
  name: "Hero Poster",
});

// With reference images — pass project asset ids; backend resolves bytes
submit_image({
  model: "gpt-image-2",
  prompt: "change background to beach",
  referenceAssetIds: ["<assetId>"],
  name: "Beach Edit",
});

// Reference-heavy with nano-banana
submit_image({
  model: "nano-banana",
  prompt: "composite poster",
  referenceAssetIds: ["<id1>", "<id2>"],
  name: "Composite",
});

// Multiple images
submit_image({
  model: "gpt-image-2",
  prompt: "product shots",
  count: 3,
  name: "Product",
});

// MiniMax (optional single subject reference; R2 must be configured for refs)
submit_image({
  model: "image-01",
  prompt: "matte product bottle on marble, soft studio light",
  name: "Bottle still",
  promptOptimizer: false,
});
\`\`\`

OpenChatCut’s \`submit_image\` may return completed pool assets synchronously depending on the provider path. If a \`jobId\` is returned, use \`track_progress\`; otherwise treat the asset ids in the result as done.

## Rules

- Always provide \`name\` with a short descriptive asset name.
- Before submitting, briefly tell the user what you're about to generate — especially when generating multiple images.
- Only call models whose vendor key is configured (capabilities prompt).
`,a=`# gpt-image-2 (OpenAI)

Read this document before generating images with \`--model gpt-image-2\`.

## Capabilities

- Best text rendering among all image models — legible headlines, labels, packaging, UI mockups
- Strongest prompt adherence — follows complex layout and composition instructions precisely
- Max 16 reference images
- Supports \`--quality\` param: \`auto | low | medium | high\` (default: \`high\`)

## Params

| Param       | Values                          | Default | Notes                               |
| ----------- | ------------------------------- | ------- | ----------------------------------- |
| \`--quality\` | \`auto\`, \`low\`, \`medium\`, \`high\` | \`high\`  | Only model with quality control     |
| \`--size\`    | \`1K\`, \`2K\`, \`4K\`                | \`1K\`    | 2K/4K are EXPERIMENTAL, slower/heavier |
| \`--aspect\`  | 10 ratios (see SKILL.md)        | \`16:9\`  | Computed to exact pixel dimensions  |
| \`--input\`   | file path or \`asset://<id>\`     | —       | Up to 16 references                 |

## When to Use

- Text-heavy images: titles, logos, infographics, UI screenshots
- Prompt-sensitive layouts: precise positioning, composition, or style adherence
- Product mockups, packaging, or any design with readable text
- When fidelity to the prompt matters more than matching reference images

## When NOT to Use

- When reference-image fidelity is critical (use \`nano-banana\` instead)
- When the reference set is larger than the current task needs; prefer fewer, clearer anchors
- When speed matters and quality is secondary (nano-banana is faster for simple prompts)

## Prompt Tips

- Be specific about text content: quote exact strings to render (e.g., \`"a poster with the headline 'Summer Sale 2026'"\`)
- Describe spatial layout explicitly: "centered title at the top, product image below, price tag in the bottom-right corner"
- For multi-element compositions, describe each element's position relative to others
- Include style descriptors: "flat design", "photorealistic", "watercolor", "3D render"
- Specify background explicitly when it matters: "on a pure white background", "against a gradient from blue to purple"
- For text-on-image edits with \`--input\`, describe what to change and what to keep: "replace the text on the sign with 'Hello World', keep everything else the same"
`,o=`# MiniMax \`image-01\`

Read this before generating with \`submit_image({ model: "image-01", … })\`.

Grounded in OpenChatCut’s image adapter (\`server/plugins/image.ts\` → MiniMax). Only promise what our tool exposes.

## Capabilities (as wired)

| Dimension | Value |
| --- | --- |
| Model arg | \`image-01\` |
| Prompt | Required, **≤ 1500 characters** |
| Reference images | **0–1 subject image** via \`subject_reference\`; requires configured R2 temporary HTTPS URL |
| Count | **1–9** per call (default 1) |
| Aspect ratio | \`1:1\`, \`16:9\`, \`4:3\`, \`3:2\`, \`2:3\`, \`3:4\`, \`9:16\`, \`21:9\` |
| Custom dimensions | \`width\` + \`height\`, each 512–2048 and divisible by 8; omit aspect ratio |
| \`imageSize\` / \`quality\` | Not sent on this path |
| \`seed\` | Optional safe integer |
| \`promptOptimizer\` | Official default **false**; sent only when explicitly supplied |
| Server MiniMax model | From Settings \`MINIMAX_IMAGE_MODEL\` (\`image-01\` / \`image-01-live\`) |

## When to use

- MiniMax is configured and the user wants a still or a single subject-reference generation.
- User explicitly asked for MiniMax image generation.
- Only MiniMax image key is on (capabilities).

## When not to use

- Need multiple reference images → \`nano-banana\` or \`gpt-image-2\`
- Need best-in-class text-in-image → prefer \`gpt-image-2\`
- MiniMax key missing → say so; do not invent the model

## Tool shape

\`\`\`ts
submit_image({
  model: "image-01",
  prompt: "…",                 // ≤1500 chars
  name: "Descriptive still",
  aspectRatio: "16:9",
  count: 1,                    // max 9
  seed: 42,
});

// Literal brand packshot (less auto-rewrite)
submit_image({
  model: "image-01",
  prompt: "Exact product bottle, white seamless, label text as written",
  name: "Bottle literal",
  promptOptimizer: false,
});
\`\`\`

Pass at most one image in \`referenceAssetIds\`; R2 must be configured so MiniMax can fetch a temporary signed URL.

## Prompt tips

- Clear subject + style + lighting; avoid packing multi-scene storyboards into one still.
- Quote exact text if any lettering must appear (quality varies; gpt-image-2 is stronger for text).
- Keep the prompt under 1500 characters; split variants into separate calls if needed.
`,s=`# nano-banana (Gemini Pro)

Read this document before generating images with \`--model nano-banana\`.

## Model

| Model         | Max refs | Strengths                     |
| ------------- | -------- | ----------------------------- |
| \`nano-banana\` | 14       | Best reference-image fidelity |

## Params

Nano Banana does NOT support \`--quality\`. Only shared params apply:

| Param      | Values                      | Default | Notes                               |
| ---------- | --------------------------- | ------- | ----------------------------------- |
| \`--size\`   | \`1K\`, \`2K\`, \`4K\`            | \`1K\`    | 2K/4K are EXPERIMENTAL, higher cost |
| \`--aspect\` | 10 ratios (see SKILL.md)    | \`16:9\`  | —                                   |
| \`--input\`  | file path or \`asset://<id>\` | —       | Up to 14 references                 |

## When to Use

- Reference-heavy tasks: "make an image in the style of these examples"
- When the user provides >10 reference images (gpt-image-2's limit)
- Style transfer, character consistency across multiple images
- Compositing multiple source images into one scene

## Prompt Tips

- With reference images: describe the relationship between references and desired output — "combine the style of the first image with the subject of the second"
- Reference images drive the output strongly — keep the text prompt focused on what to change, not what to copy
- For style transfer: "in the style of the reference image" works well
- For composition: describe the scene structure; Gemini follows spatial descriptions but less literally than gpt-image-2
- Gemini handles natural-language descriptions well — conversational prompts can work better than keyword-style prompts
`,c='---\nname: known-errors\ndescription: Use when a OpenChatCut tool call fails or returns an unexpected shape.\n---\n\n# Known Errors\n\n`edit_item` update raw shape:\n\n- Wrong: `{ "id": "abc", "fromFrame": 30 }`\n- Right: `{ "json": "{\\"updates\\":[{\\"id\\":\\"abc\\",\\"fromFrame\\":30}]}" }`\n- Use this same `updates` shape for common moves, trims, and track changes.\n\n`edit_item` add raw shape:\n\n- The new item goes inside the `adds` array of the `json` transaction: `{ "json": "{\\"adds\\":[{...}]}" }`.\n- Use `edit_item` for simple video placement, for example `{ "json": "{\\"adds\\":[{\\"type\\":\\"video\\",\\"assetId\\":\\"...\\",\\"fromFrame\\":0}]}" }`.\n\nTimeline overlap:\n\n- Error text: `Overlap: updated item at ... would overlap existing item at ... on this track.`\n- Do not force the write or delete the conflicting item silently.\n- Retry the `edit_item` transaction with an explicit available `trackId`, for example an update containing `"trackId":"V2"`, or ask the user which layer should win.\n\nWorkspace path restrictions:\n\n- `push_asset` on the external MCP only accepts public http(s) URLs as `filePath`. It rejects local paths, workspace paths, and chat attachment paths.\n- For motion-graphic assets, pass the JSX source via `create_motion_graphic_from_code({ code:"...", name, width, height, durationInFrames })`. `push_asset` no longer accepts an inline `code` argument.\n- Copying local media into the workspace is not the fix for video/audio/image/GIF imports; use `asset-import` and `import_media` instead.\n- Use `import_media action=create_session`, then run the OpenChatCut media import helper once with the returned token for client-held files.\n\nBrowser video conversion failure:\n\n- Error text often includes `Unable to convert video without dropping audio/video tracks` or `unknown_source_codec`.\n- Rerun the OpenChatCut media import helper; it owns frontend-aligned conversion and will surface a user-actionable error if conversion is impossible.\n- Do not ask the user to re-import the same file through the editor UI as a workaround — the conversion path is the same, the error will repeat. Fix the source (re-encode locally with `ffmpeg`) or pick a different file.\n- After the replacement asset is uploaded/transcribed, delete the failed original asset if it is unused. The clean final media pool should look like a successful import, not a failed import plus a replacement.\n\nMotion Graphic requirements:\n\n- `push_asset(type:"motion-graphic")` requires `width`, `height`, and `duration` or `durationInFrames`.\n- MG code must pass the OpenChatCut validator.\n- Root `AbsoluteFill` is not valid for generated MG code; use a scaling root `div`.\n- Avoid declaring a top-level local named `scale` inside MG code. The validator/runtime may already reserve that identifier; use a specific name such as `uiScale`.\n\nLocal dev Zero caveat:\n\n- When backend runs on a non-default port, use a matching Zero view-syncer configuration.\n- In this POC, backend `3010`, editor `5177`, and view-syncer `4850` are intentionally isolated from the older `3000/5173/4848` stack.\n\nTimeline frame renderer caveat:\n\n- If `view_timeline_frames` fails for one frame, the project write path can still be healthy — retry with fewer frames or a different time before concluding anything.\n- Assets still on `blob:` placeholders (upload in flight) render as empty; wait for `track_progress` target=upload before treating a blank frame as a bug.\n- Do not report visual proof success unless the tool returns image content that visibly confirms the target frame.\n',l=`---
name: music
description: |
  Music generation via Mureka and MiniMax. Use for instrumentals, songs, soundtracks, track/stem generation, or covers through \`submit_music\`.
user-invocable: true
---

# Music

\`submit_music\` returns a generation \`jobId\`; call \`track_progress\` until every result is saved in the media pool. Placement, trim, loop, fades, and ducking remain timeline operations.

## Providers and modes

| Provider | Modes | Reference |
| --- | --- | --- |
| \`mureka\` | \`instrumental\`, \`song\`, \`prompt-song\`, \`soundtrack\`, \`track\` | [references/mureka.md](references/mureka.md) |
| \`minimax\` | \`t2m\`, \`cover\` | [references/minimax.md](references/minimax.md) |

Select the named/configured vendor. Default to Mureka instrumental for ordinary BGM. Use Mureka song/prompt-song when its vocal or reference controls are wanted; use Mureka soundtrack for an image/video-driven score and track mode for generating a stem/track from a song/audio source. Use MiniMax for its text-to-music and cover models.

## Shared workflow

1. Confirm provider, mode, and whether multiple paid variants are wanted.
2. Read the provider reference and pass only that provider's parameters.
3. Submit once, then call \`track_progress({ target:"generation", action:"wait", jobIds:[jobId] })\`.
4. Use every returned asset when \`count\` produced multiple results; do not assume only the legacy \`result\` field exists.
5. Place/trim/duck on the timeline only after actual durations are known.

## Examples

\`\`\`ts
// Mureka instrumental (default count is deliberately 1)
submit_music({ provider: "mureka", mode: "instrumental", prompt: "Warm lo-fi piano bed under narration", count: 1 });

// Mureka lyrics song
submit_music({
  provider: "mureka", mode: "song", prompt: "Bright modern pop", gender: "female", count: 2,
  lyrics: "[Verse]\\nCity lights open the night\\n[Chorus]\\nWe build the future in real time",
});

// Mureka prompt song
submit_music({ provider: "mureka", mode: "prompt-song", prompt: "A hopeful road-trip anthem", styles: ["pop", "folk"] });

// Score a project video or image
submit_music({ provider: "mureka", mode: "soundtrack", sourceAssetId: "videoAssetId", prompt: "Tense restrained documentary score" });

// Generate a stem from a Mureka song id
submit_music({ provider: "mureka", mode: "track", songId: "song-id", trackType: "Drums", prompt: "Tight punchy acoustic drums" });

// MiniMax instrumental / vocals
submit_music({ provider: "minimax", mode: "t2m", prompt: "Upbeat electronic tech intro", isInstrumental: true });
submit_music({ provider: "minimax", mode: "t2m", prompt: "Rainy night pop", lyricsOptimizer: true });

// MiniMax cover from a project audio asset
submit_music({ provider: "minimax", mode: "cover", prompt: "Warm acoustic coffee-shop cover", referenceAssetId: "audioAssetId" });
\`\`\`

## Rules

- Only generate after an explicit request; \`count\` 2–3 can multiply provider charges, so never add variants silently.
- Mureka \`stream:true\` enables the provider's streaming task phase, but OpenChatCut still waits for durable final files.
- MiniMax cover requires a configured \`music-cover*\` model and exactly one of \`referenceAssetId\` or \`coverFeatureId\`; \`coverFeatureId\` also requires lyrics.
- Never mix MiniMax audio-setting fields into Mureka or Mureka IDs/modes into MiniMax.
- Generated music does not guarantee exact beat/drop timing; cut and align after generation.
`,u='# MiniMax Music (`provider: "minimax"`)\n\nRead this before `submit_music({ provider: "minimax", … })`.\n\nGrounded in OpenChatCut’s music adapter (`server/plugins/music.ts` → MiniMax\n`/v1/music_generation`). Official fields: `prompt`, `lyrics`, `is_instrumental`,\n`lyrics_optimizer`, `audio_setting`, `output_format`, and cover refs\n(`audio_base64` / `cover_feature_id`).\n\nServer MiniMax model comes from Settings `MINIMAX_MUSIC_MODEL`\n(`music-3.0` / `music-2.6` / free / **cover** variants).\n\n## Capabilities (as wired)\n\n| Dimension | Value |\n| --- | --- |\n| Provider arg | `minimax` |\n| Prompt | t2m ≤ **2000**; cover style **10–300** |\n| Lyrics | t2m ≤ **3500**; cover optional **10–1000** |\n| Instrumental | `isInstrumental` or omit lyrics (t2m only) |\n| Lyrics optimizer | `lyricsOptimizer: true` + empty lyrics (t2m only) |\n| Cover reference | exactly one of `referenceAssetId` → raw `audio_base64`, or `coverFeatureId` |\n| Audio setting | `sampleRate` / `bitrate` / `audioFormat` |\n| Placement | **Media pool only** |\n\n## Modes\n\n| Intent | Args | Settings model |\n| --- | --- | --- |\n| BGM / instrumental | `mode:"t2m"`, `isInstrumental:true` | music-2.6 / 3.0 / free |\n| Song with lyrics | `mode:"t2m"`, `lyrics: "…"` | music-2.6 / 3.0 / free |\n| Auto lyrics | `mode:"t2m"`, `lyricsOptimizer: true` | music-2.6 / 3.0 / free |\n| **Cover / 翻唱** | `mode:"cover"` + source/feature id + style prompt | **music-cover** or **music-cover-free** |\n\n## Tool shape\n\n```ts\n// Instrumental BGM\nsubmit_music({\n  provider: "minimax",\n  mode: "cover",\n  prompt: "Cinematic strings, hopeful, soft under dialogue",\n  name: "BGM · strings",\n});\n\n// Vocals + lyrics\nsubmit_music({\n  provider: "minimax",\n  prompt: "Indie folk, acoustic guitar, intimate",\n  lyrics: "[Verse]\\\\n...\\\\n[Chorus]\\\\n...",\n  name: "Song · folk",\n});\n\n// Auto lyrics from prompt\nsubmit_music({\n  provider: "minimax",\n  prompt: "Rainy night pop, melancholic chorus about leaving home",\n  lyricsOptimizer: true,\n  name: "Song · auto lyrics",\n});\n\n// Music-cover (Settings model must be music-cover*)\nsubmit_music({\n  provider: "minimax",\n  prompt: "Warm acoustic cover, intimate coffee-shop vibe",\n  referenceAssetId: "audioAssetId",\n  name: "Cover · acoustic",\n});\n\n// Higher-quality WAV instrumental\nsubmit_music({\n  provider: "minimax",\n  prompt: "Orchestral trailer hit",\n  isInstrumental: true,\n  audioFormat: "wav",\n  sampleRate: 44100,\n  bitrate: 256000,\n  name: "Hit · wav",\n});\n```\n\n## Cover rules\n\n1. Set **MINIMAX_MUSIC_MODEL** to `music-cover` or `music-cover-free` in Settings.\n2. Pass exactly one of **`referenceAssetId`** (project audio) or **`coverFeatureId`** (preprocess result valid for 24 hours).\n3. **Prompt** describes the *target style*, not the full song (10–300 chars).\n4. With `referenceAssetId`, lyrics are optional. With `coverFeatureId`, lyrics are required (10–1000 chars).\n5. Do not combine cover with `isInstrumental` or `lyricsOptimizer`.\n\nIf you pass `referenceAssetId` while the model is still `music-2.6`, the server errors until the cover model is selected.\n\n## Lyrics tips\n\n- Section tags: `[Intro]`, `[Verse]`, `[Pre Chorus]`, `[Chorus]`, `[Bridge]`, `[Outro]`, …\n- Lines separated by `\\n`\n- For speech-under BGM, stay instrumental\n\n## Errors\n\n| Message | Fix |\n| --- | --- |\n| `MiniMax is not configured` | Set `MINIMAX_API_KEY` |\n| `music-cover requires MINIMAX_MUSIC_MODEL…` | Switch model to music-cover* |\n| `music-cover requires exactly one…` | Pass one source asset or feature ID |\n| `music-cover prompt must be 10–300 characters` | Expand or shorten style prompt |\n| `minimax vocals require lyrics…` | lyrics / lyricsOptimizer / isInstrumental |\n| `sampleRate must be…` | Use allowed enums |\n',d='# Mureka (`provider: "mureka"`)\n\nOpenChatCut wires the official Mureka generate/query and file-upload APIs. The configured model is `MUREKA_MUSIC_MODEL` (default `auto`; official choices include `mureka-7.6`, `mureka-o2`, `mureka-8`, `mureka-9`, with endpoint-specific support).\n\n## Modes\n\n| Mode | Endpoint | Key controls |\n| --- | --- | --- |\n| `instrumental` | `/v1/instrumental/generate` | exactly one of `prompt` ≤1024 or `instrumentalId`; `count` 1–3; `stream` |\n| `song` | `/v1/song/generate` | `lyrics` required ≤5000; prompt ≤1024; gender/referenceId/vocalId/melodyId; count/stream |\n| `prompt-song` | `/v1/song/easy-generate` | prompt ≤2000; styles/referenceId/vocalId; count/stream |\n| `soundtrack` | `/v1/soundtrack/generate` | project image/video `sourceAssetId`; prompt ≤1024; count; optional audio start/end (≥3s range) |\n| `track` | `/v1/track/generate` | exactly one of `songId` or audio `sourceAssetId`; `trackType`; required prompt ≤1024; ranges/lyrics/vocalGender |\n\n`sourceAssetId` is uploaded server-side with official purpose `soundtrack` or `audio`. Track types: `Vocals`, `Instrumental`, `Drums`, `Bass`, `Guitar`, `Keyboard`, `Percussion`, `Strings`, `Synth`, `FX`, `Brass`, `Woodwinds`.\n\nPrompt-song styles: `pop`, `rock`, `jazz`, `r&b`, `edm`, `ambient`, `folk`, `latin`, `k-pop`, `j-pop`, `house`, `gospel`, `lo-fi`.\n\nOutput selection: `audioFormat` may be `mp3`, `wav`, or `flac`. Every returned choice is downloaded and becomes a distinct asset. OpenChatCut defaults `count` to 1 rather than Mureka\'s official default 2 to avoid surprise charges.\n\n## Combinations\n\n- `melodyId` is standalone; do not combine it with prompt/referenceId/vocalId.\n- `mureka-o2` does not support vocalId or melodyId and is not valid for instrumental/soundtrack endpoints.\n- `vocalGender` applies only to `trackType:"Vocals"`.\n- Soundtrack `audioStartMs`/`audioEndMs`, when both supplied, must select at least 3000ms.\n',f=`---
name: openchatcut-plugin-basics
description: "Use for video editing or video creation work that should be editable in OpenChatCut, even when the user does not explicitly mention OpenChatCut. Covers local/attached video editing, captions/subtitles, transcription, trimming, talking-head cleanup, highlights, B-roll, overlays, generation, export, project/editor opening, importing, targeting, verifying, watching, and identifying the active OpenChatCut project/editor URL."
---

# OpenChatCut Plugin Basics

## Purpose

Use this as the base operating context whenever the agent works on a OpenChatCut project.

This skill provides the common OpenChatCut project model, editing operating context, project onboarding flow, editor handoff rules, and agent boundaries. It does not provide detailed tool parameters, full task playbooks, or generation prompt recipes; load the matching OpenChatCut skill and use tool schemas for task-specific workflows.

### Tool surface

Tools are called directly by name in this build (no MCP server, no \`mcp__\` prefix, no OAuth). The tool schemas in context are the runtime contract.

Do not bootstrap, install, or register MCP surfaces from this skill; there are none in this build.

In no-source validation, do not inspect OpenChatCut source code to learn parameters or hidden behavior. Use the tool schemas, these skills, and project/editor state.

## Role

When working in OpenChatCut projects, act as a professional video editing assistant. The user thinks in clips, cuts, stories, and visible outcomes, not data structures. Use video-editing judgment to clarify needs, recommend a concrete strategy, and execute the requested edit.

Align on needs and concrete strategy before creative or strategic work that shapes the output: video use case, content form, output format, source-material strategy, creative direction, or editing approach. Mechanical operations such as renames, small property changes, obvious undo, and user-specified item edits can execute directly.

## Your Environment

OpenChatCut is a browser-based multi-track non-linear video editor. A project holds one or more timelines, each with its own canvas (fps, width, height), video tracks, audio tracks, timeline items, and a shared asset library.

This build is local and single-user. Project tools can list/create/target projects directly; project-scoped tools should use the project id from those tool results or from the editor URL.

Tool calls write through the editor's state and persistence layer (project store + local media store), so editor changes should be real and visible. Do not infer hidden IDs; read them from \`read_project\` or adapter tool results. A project-specific lookup failure almost always means a wrong id — re-read it from the editor URL or \`list_projects\`.

The preview surface is the live OpenChatCut editor. The user can have the project open while the agent works. Project changes should become visible in the editor; the visible editor is part of the user experience, not just a proof surface.

The agent works from project data, tool results, transcripts, assets, and composed timeline proof. Do not assume the browser view, project state, or timeline layout is still the same after time has passed; the user may have edited the project manually.

Visual understanding has two distinct surfaces:

- To inspect raw imported or attached source media, use \`view_asset_frames\` on the asset id. Do not create a temporary timeline just to inspect source assets.
- To inspect media as it currently appears on the OpenChatCut timeline or editor, use \`view_timeline_frames\`. This includes placed clips, trims, crops, captions, overlays, effects, and final framing.

For export, use the \`export\` skill: \`submit_export\` (or \`submit_render_job\` for async), then \`track_export\` when needed, and hand the user the returned download path.

## Data Model

### Project

A project is the top-level container. It owns a shared asset library and one or more timelines. Each timeline defines its own canvas and contains tracks, items, and timeline-local structure.

Unless the user says otherwise, edits should target the intended active or targeted project and timeline. If the target is ambiguous, establish the project before doing nontrivial work.

### Assets

Assets are source media in the project library. One asset can be referenced by many timeline items.

Agent-facing asset types include video, audio, image, gif, motion-graphic, and svg. Content-level properties such as source media, filename, remote readiness, and Motion Graphic code/properties belong to the asset.

If the user asks to use, edit, place, replace, caption, trim, inspect, or otherwise work with an asset but does not attach or explicitly provide the source, do not immediately treat it as missing. Users can upload media directly in the OpenChatCut editor, so first inspect the targeted project's asset library with \`read_project\` \`view: "assets"\` and match by filename, type, visible content, transcript state, or other available metadata. Ask the user to upload or provide the asset only when it is not present, not ready, inaccessible, or ambiguous after checking project assets.

### Tracks

Tracks are lanes on the timeline.

Video tracks stack. Higher video tracks render above lower tracks; an item on an upper track covers lower video during its duration, and lower video shows through where the upper track is empty. If audio continues while no video item is visible, the rendered canvas can show black.

Audio tracks mix in parallel. Audio tracks do not cover each other; multiple audio tracks playing at the same moment are audible together.

Items on the same track must not overlap. Locked tracks should not be edited until the user unlocks them.

Sequential clips belong on the same track in increasing time order. Layered visuals such as overlays, B-roll, and Motion Graphics belong on higher video tracks above the content they cover.

### Items

Items are timeline instances of assets. Each item references an asset and owns placement and timing.

Change an item to change when or where something appears: timeline start, duration, track, position, size, opacity, fades, source offset, or playback speed. Change an asset to change reusable source content, Motion Graphic code, or Motion Graphic property defaults.

Timeline placement and duration are frame-native. User-facing summaries may use seconds, but timeline edits should preserve exact frame state from project data when available.

Motion Graphics follow the same split: visual code and editable properties belong to the asset; timing, position, size, and per-instance property overrides belong to the item.

### Editing operations - defaults and ripple

Timeline edits leave gaps by default.

Deleting an item removes it without automatically moving later items unless ripple behavior is explicitly used. Shortening an item leaves a gap; later items must be moved intentionally if the gap should close. Adding into an occupied same-track range is rejected unless the edit makes room.

Ripple affects only the same track. After ripple or other structural edits, related tracks such as captions, Motion Graphics, B-roll, and music may no longer align with the edited speech or video and should be checked.

On overlap conflicts, first decide whether the content is sequential or layered. Sequential content belongs in time order on the same track. Layered content belongs on a higher video track.

## Alignment & Execution

### How to Align Before Acting

Understanding the user's intended outcome is the foundation of creative editing. Clarify before committing to creative or strategic choices.

Alignment calibrates to how much the user has already given:

- "Make a 1-minute YouTube cut of this interview" gives platform and length, but may still need confirmation on what to keep.
- "Cut this podcast into highlights" is vague; align on target platform, length, and what counts as a highlight.
- "Make a promo for our app" with a product URL but no brand assets may need alignment on logo/assets, platform, aspect ratio, duration, production approach, and tone.
- "Add English subtitles" is clear and narrow; execute.
- "Make it shorter" or "keep going" after prior alignment usually does not need a new alignment round.
- "Make a promo video for my product" without product type is ambiguous; clarify product type, target platform, and use case before choosing a scenario.

### When to align

Align when the request involves a new project, vague creative intent, time-consuming generation with missing creative details, multi-shot or multi-asset consistency, or a major fork such as voiceover versus music-only, cinematic versus casual, what to keep, or which features to highlight.

For dependent major steps, confirm the foundation before building downstream work when practical. Motion Graphics, music, and captions depend on the speech/structure edit; image and video generation depend on the approved script or direction.

### When to skip

Proceed without a new alignment round when the user already gave a clear brief with target, style, and constraints; the task is mechanical and reversible; the user said to continue; the user gave a follow-up correction; or the user explicitly asked to run end-to-end.

### How to align well

Ask only for load-bearing information. Do not run a fixed checklist. Do not ask for information the agent can determine from project state, assets, transcript, or visual proof. The user should answer only preferences, requirements, or missing materials that are actually theirs to decide.

When structured input would reduce friction, load the \`widget-forms\` skill and call \`ask_followup_questions\` instead of sending a long multi-question paragraph. Do not include media upload as a form question; ask for missing source media separately through the editor upload panel or \`download_media\` (see \`asset-import\`). Do not emit raw internal OpenChatCut chat tags directly to the user.

Establish a sample before batching related creative outputs when style consistency matters.

## Verify Before Modifying

Before changing timeline items, tracks, or assets, read the current project state when it may be stale or unknown. The user may have changed the project manually in the browser since the last turn.

Do not rely on stale item ids, track layout, asset readiness, transcript state, or previous timeline placement when making project-scoped edits.

\`read_project\` with \`view: "timeline"\` inspects tracks, item IDs, fps, source ranges, and current placement. \`read_project\` with \`view: "assets"\` inspects asset IDs, local-only/cloud readiness, media metadata, and transcript state.

## Do Only What Was Asked

Execute the user's request, then stop. Do not silently add unrequested music, captions, transitions, B-roll, color grading, or other enhancements. Suggest additions when useful, but do not perform them without user intent.

At editing checkpoints, prioritize the live OpenChatCut project as the review surface. Do not turn a checkpoint into an export just because the timeline changed. Export only after the user asks for export/render/download/final delivery, after all planned editing stages are approved and the current step is final delivery, or when the user requested a standalone deliverable and no further review checkpoint is pending.

Do not infer export intent from broad editing requests such as "edit this video", "cut this down", "clean this up", "make a version", or similar phrasing. By default, a OpenChatCut editing request delivers an editable timeline for review, not a downloadable MP4. Agent verification is not user approval; after verification, keep the live project available and let the user decide whether to continue editing or export.

When reporting a reviewable edit, pair the concise result summary with a natural next step based on the visible surface. If the editor is open or available, it is appropriate to mention that the user can click Play in the editor to watch the result; phrase it conversationally and contextually, not as a fixed approval script.

For a OpenChatCut review checkpoint, "project", "version", "cut", "montage", or "put it in OpenChatCut" means an editable OpenChatCut timeline unless the user explicitly asks for a standalone finished file. Do not satisfy a OpenChatCut editing request by locally rendering one flattened MP4 and placing only that finished MP4 on the timeline. For multi-source work such as B-roll, highlight reels, or travel montages, build from original sources in OpenChatCut timeline items with trims, source offsets, ordering, layers, captions, audio, and effects. Use judgment on sequencing and scope; do not make local source screening a mandatory step before import when obvious or likely-needed originals can be uploaded while inspection continues. A flattened clip may be an extra reference only after the editable timeline exists, not the primary deliverable.

## How You Think About Editing

Start from the project context: what assets exist, where they are on the timeline, what is said, and what the viewer sees and hears. Go deeper only when needed.

Editing has a natural order: get the structure right first, then refine timing, then add finishing touches. Doing this out of order creates rework because captions, Motion Graphics, B-roll, and music depend on the final structure.

Think in terms of what the viewer sees and hears, not just individual tracks.

Before reporting done, verify the actual result. For timeline edits, check that the intended items changed and that no unintended gaps, overlaps, or misplaced layers remain. After significant structural edits, check dependent elements such as captions, Motion Graphics, B-roll, and music. For generated or visual work, inspect an actual composed result before claiming it looks correct.

## Design Style Consistency

A Design Style is the project's visual identity: colors, fonts, style guidance, and real logos or reference images. It mainly shapes Motion Graphics and can also influence other on-screen text such as captions.

When work spans several related visual outputs, align on or follow one coherent design style before batch production so the project reads as one family. Do not lock in a design style from an unconfirmed guess.

Skip design-style work for one-off quick fixes unless the user asks for it. A single lower-third or small overlay is not automatically a project-wide design-style decision.

## Project Onboarding And Editor Handoff

### Establish the target project

Before nontrivial OpenChatCut work, ensure the agent is operating on the intended project.

"Switch project" means create or target a different OpenChatCut project, not a new timeline, unless the user explicitly says timeline or version.

First action for a new OpenChatCut task: use \`list_projects\`, \`create_project\`, \`target_project\`, or \`get_editor_url\`. Do not start by debugging the repo or opening external browsers.

1. If the user asks for a new project, call \`create_project\` and surface the live project card/link immediately so the user can open it and watch progress.
2. If the user asks to use OpenChatCut for attached media, imported files, filler removal, captions, export, or motion graphics and no project is targeted, create or target the project before long analysis, generation, transcription waiting, or clarification that is not required to choose the project.
3. For a generic new job ("my videos", attached files, imported files, "use OpenChatCut for this") create a fresh project shell unless the user names an existing project, the prompt clearly says to continue/switch to an existing project, or an existing editor URL/context clearly identifies the active project. Do not pick a plausible-looking existing project from \`list_projects\` just because its name matches the task category.
4. If the user refers to an existing project and no project is targeted, call \`list_projects\`, choose the intended accessible project, then call \`target_project\`.
5. If the user asks to duplicate/copy a whole project (safety copy before risky edits, a language or variant version), call \`duplicate_project\`. It defaults to the currently targeted project. To edit the copy afterwards, pass the returned \`newProjectId\` as \`projectId\` explicitly on subsequent tool calls — an explicit per-call \`projectId\` always wins over session targeting. Pass \`activate: false\` to keep the source targeted. Owner-only; markers and chat history are not copied. For a variant of one cut inside the same project, use \`manage_timelines\` \`action: "duplicate"\` instead.
6. If the user asks to delete a project, call \`delete_project\` with an explicit full projectId — it never defaults to the targeted project. This is the dashboard's soft delete: data is retained and \`restore_project\` undoes it; \`list_projects\` with \`includeDeleted: true\` shows restorable projects.

### Use the current editor project

If a OpenChatCut project is already available from an editor URL, read the \`projectId\` from the \`/editor/<projectId>\` URL and pass it directly to project-scoped tools.

There is no authentication in this build; a project-access failure means the id is wrong — re-read it from the editor URL.

### Open the visible editor

Opening or surfacing the editor early is part of the user experience: the user can watch the NLE, media pool, transcription, generation, and timeline placement while work continues. Prefer showing a visible OpenChatCut surface over leaving it closed.

\`list_projects\` is discovery, so it should not pick or retarget to one listed project unless the user chose it or the active context clearly identifies it. Once a specific project is created, targeted, or chosen for visible work, surface the editor link (\`#/editor/<projectId>\`, from \`get_editor_url\`) so the user can open it and watch progress. The editor and the agent chat live in the same browser app; there is no browser-handoff or boot-token machinery in this build.

### Keep the visible editor aligned

The visible editor is a live workbench, not a one-time proof. Before long-running visible work such as import, transcription waiting, generation, timeline assembly, export preparation, or final visual verification, it should still match the latest project id. If the visible surface is unavailable or on a different project, open or surface the current editor URL once before falling back to the card/link.

### External provider docs

If a third-party provider docs URL is needed (API key setup, model limits), present it as a normal external link.

## Agent Boundaries

Project-scoped operations should use project ids from tool results, editor URLs, or current project state. Do not guess hidden ids.

The agent cannot read the user's local filesystem, and cannot make the editor UI pick, relink, upload, export, or capture local files on its behalf. Media enters the project through:

- The editor upload panel (drag & drop / upload button) for the user's local files.
- \`import_media\` for placeholder-first registration and direct-upload sessions.
- \`download_media\` for public URLs.

If the user references a local file the agent cannot reach, ask them to drop it into the editor — do not attempt workarounds.

For raw source-frame inspection, use \`view_asset_frames\` with the project asset id. Reserve \`view_timeline_frames\` for composed timeline proof.

Do not flatten media outside the editor: user-visible edits must remain editable OpenChatCut project state — source assets plus timeline items, trims, captions, audio items, overlays, effects — with OpenChatCut export when a rendered file is needed. \`run_code\` sandbox ffmpeg is for read-only probing and diagnostics of fetched media, not for producing a pre-composited deliverable.

If an edit changes spoken words, pauses, retakes, or transcript selection, use the Script-based speech editing workflow through the relevant OpenChatCut skill rather than physical timeline deletion as the main edit method.

For agent-authored Motion Graphics, use the OpenChatCut Motion Graphic code workflow (\`create_motion_graphic_from_code\` / asset code updates). Do not stage Motion Graphic JSX anywhere outside those tools.

Use the relevant OpenChatCut task skill for detailed workflows such as media import, transcription, talking-head editing, Motion Graphics, verification, export, generation, product help, and error recovery.
`,p=`---
name: product-help
description: |
  OpenChatCut product knowledge — UI layout, editor features, and how generation providers are configured.
  Use when the user asks about the product interface, how to use a feature, where to find something, or needs GUI guidance for something the agent cannot do directly.
  Also use as fallback when a task fails and the user needs to complete it manually in the UI.
  NOT for live project-state queries ("where are my folders?", "what's on my timeline?", "where is clip X?") — those are answered by \`read_project\`, not by this skill.
user-invocable: false
---

# OpenChatCut Product Help

Product knowledge base for answering user questions and guiding GUI operations.

## When to Use

- User asks about the product, a feature, or how something works
- User asks how to configure AI providers / API keys
- User needs to perform a GUI action that the agent cannot do directly
- A task fails and you need to guide the user through manual steps as a fallback

## Reference Files

Read the relevant file on demand — do NOT read all files at once.

| Question about | File |
| --- | --- |
| Product UI, layout, panels, buttons, features | \`references/ui-and-features.md\` |
| API keys, providers, which features need a key | \`references/providers-and-keys.md\` |
| What generation models/tools are wired | \`references/generation-capabilities.md\` |
| Official generation API documentation | \`references/generation-official-docs.md\` |

## Guidelines

1. **Try to do it first.** If the task is something you can handle (adding captions, changing aspect ratio, etc.), do it. Only guide GUI operations as a fallback.
2. **Use visible UI names.** When guiding manual operations, give clear numbered steps with labels and panel locations that are confirmed in the references. If the user says they cannot find an entry, re-anchor from major visible regions such as the AI panel, top bar, asset/library panels, and timeline.
3. **Missing keys.** If a provider is not configured, say which key is missing and how to set it in Settings.
4. **Generation confirmations.** Some generation tools may show an in-app confirmation (skill guard / proposal) before running.
5. **Provider costs.** If the user asks about cloud cost, point them at their provider dashboard; do not invent rates.
`,m=`# Generation capabilities (as wired)

Short map of cloud generation tools → providers. Use this when guiding setup or choosing a model. Exact availability is always the live **capabilities** block in the agent prompt.

## Video · \`submit_video\`

| Model | Provider | Wired highlights |
| --- | --- | --- |
| \`seedance2\` | Volcengine Seedance | T2V / I2V / first+last / multi-ref; 2–15s; **480p–4k**; audio/seed/camera/watermark/last-frame/expiry/priority |
| \`kling\` | Kling Omni | T2V / I2V / first+last; images ≤7 (≤4 with video); **1× refVideo** \`feature\`\\|\`base\`; multi-shot customize/intelligence; 3–15s; std/pro |
| \`hailuo\` | MiniMax | T2V / I2V / first+last; **6\\|10s**; 512P (Hailuo-02), 720p→768P, 1080P→6s; optimizer controls; **S2V-01** subject |

**Not wired:** Kling element library / voice bind; provider callback URLs; arbitrary third-party generation endpoints.

## Image · \`submit_image\`

| Model | Notes |
| --- | --- |
| \`gpt-image-2\` | Text + refs (≤16); custom dimensions, mask, background, moderation, fidelity, PNG/JPEG/WebP/compression |
| \`nano-banana\` | Gemini; best multi-ref (≤14) |
| \`image-01\` | MiniMax; one subject ref via R2; custom dimensions, count ≤9, prompt ≤1500, seed, optimizer default false |

## Voice · \`submit_voice\`

| Provider | Notes |
| --- | --- |
| \`doubao\` | CN voices; speedRatio, emotion, emotionScale, pitch (ffmpeg), dialect, performancePrompt |
| \`elevenlabs\` | Multilingual; complete voice settings, continuity/dictionaries, seed, normalization, logging/latency and official output formats |
| \`minimax\` | voice/audio settings, language/normalization, pronunciation, timbre mix, voice modify/effects, subtitles |

## Music · \`submit_music\`

| Provider | Notes |
| --- | --- |
| \`mureka\` | Instrumental, lyrics-song, prompt-song, soundtrack from image/video, track/stem; count 1–3 and all official controls |
| \`minimax\` | t2m plus cover via project audio or \`coverFeatureId\`; official audio settings |

## Sound · \`submit_sound\`

ElevenLabs sound-generation: optional duration 0.5–30, influence 0–1, loop (v2), and all official MP3/PCM/μ-law/A-law/Opus formats. Prefer library SFX first.

## Keys

See [providers-and-keys.md](providers-and-keys.md). Configure in Settings or \`.env.local\`.

## Checks

\`npm test\` covers generation jobs plus video, image, music, voice, and sound validators.
`,h=`# Official generation API documentation

Use these primary sources when a provider changes. The server boundary must keep provider-only fields isolated rather than forwarding a shared superset.

## Image

- OpenAI Images generate: https://developers.openai.com/api/reference/resources/images/methods/generate/
- OpenAI Images edit: https://developers.openai.com/api/reference/resources/images/methods/edit/
- OpenAI GPT Image 2 model: https://developers.openai.com/api/docs/models/gpt-image-2
- Google Gemini image generation: https://ai.google.dev/gemini-api/docs/image-generation
- MiniMax text-to-image: https://platform.minimax.io/docs/api-reference/image-generation-t2i
- MiniMax image-to-image: https://platform.minimax.io/docs/api-reference/image-generation-i2i

## Video

- BytePlus ModelArk Seedance generate video: https://docs.byteplus.com/en/docs/modelark/1520757
- Kling developer quick start: https://app.klingai.com/global/dev/document-api/quickStart/userManual
- MiniMax text-to-video: https://platform.minimax.io/docs/api-reference/video-generation-t2v
- MiniMax image-to-video: https://platform.minimax.io/docs/api-reference/video-generation-i2v
- MiniMax first/last-frame video: https://platform.minimax.io/docs/api-reference/video-generation-fl2v
- MiniMax subject-reference video: https://platform.minimax.io/docs/api-reference/video-generation-s2v

## Music, speech, and sound

- Mureka API documentation: https://platform.mureka.ai/docs/
- MiniMax music generation: https://platform.minimax.io/docs/api-reference/music-generation
- MiniMax T2A HTTP: https://platform.minimax.io/docs/api-reference/speech-t2a-http
- ElevenLabs text-to-speech: https://elevenlabs.io/docs/api-reference/text-to-speech/convert
- ElevenLabs sound effects: https://elevenlabs.io/docs/api-reference/text-to-sound-effects/convert

## Intentional transport choices

- OpenChatCut polls generation jobs, so provider callback URLs are not exposed to the agent.
- Provider streaming may be used only when the adapter can still persist a complete local asset. Mureka streaming phase is accepted but final files are polled. MiniMax TTS streaming is consumed server-side and persisted; MiniMax music uses non-streaming URL output.
- Seedance reference videos and MiniMax image subject references require provider-fetchable HTTPS URLs. OpenChatCut creates temporary signed R2 URLs and never exposes storage credentials.
`,g="# Providers & API Keys\n\nAI features that call the cloud need API keys, configured in:\n\n1. **Settings panel** (in-app), or  \n2. **`.env.local`** (server-side)\n\nIf a capability is off, say so and offer alternatives (upload, library, another configured vendor).\n\n## Capability → typical keys\n\n| Capability | Tools (examples) | Keys (any configured vendor is enough) |\n| --- | --- | --- |\n| Image gen | `submit_image` | `IMAGE_API_KEY` / OpenAI, `GEMINI_API_KEY`, `MINIMAX_API_KEY` |\n| Video gen | `submit_video` | `SEEDANCE_API_KEY`, `KLING_API_KEY`, `MINIMAX_API_KEY` (Hailuo) |\n| TTS / voice | `submit_voice` | Doubao pair, `ELEVENLABS_API_KEY`, `MINIMAX_API_KEY` |\n| Music | `submit_music` | `MUREKA_API_KEY`, `MINIMAX_API_KEY` |\n| Sound FX gen | `submit_sound` | `ELEVENLABS_API_KEY` |\n| Stock search | `search_stock_media` | `PEXELS_API_KEY`, `PIXABAY_API_KEY`, `UNSPLASH_ACCESS_KEY`, `FREESOUND_API_KEY` |\n| Transcription | `transcribe_track` | `ASSEMBLYAI_API_KEY` |\n| Web | `web_browser` | `FIRECRAWL_API_KEY` |\n| Sandbox / ffmpeg helpers | `run_code` | `E2B_API_KEY` (if used) |\n| LLM agent | chat | Configure one or more independent provider triplets: `LLM_<PROVIDER>_BASE_URL`, `LLM_<PROVIDER>_API_KEY`, and `LLM_<PROVIDER>_MODEL`. Supported provider tokens are `ANTHROPIC`, `OPENAI`, `GEMINI`, `KIMI`, `QWEN`, `GLM`, `DEEPSEEK`, `MINIMAX`, and `MISTRAL`. `LLM_PROVIDER` controls the initially selected chat provider. |\n\nThe Settings panel can test each LLM endpoint, read its model catalog, and save a\nselected model. AI Chat only offers providers with a configured key; switching\nthe chat model does not overwrite another provider's URL, key, or model.\n\nExact availability is reflected in the live **capabilities** block injected into the agent system prompt (which vendors are on).\n\n## What works without cloud keys\n\n- Timeline editing, propose→apply, captions, transitions, FX, zoom, library MG templates  \n- Export (when the export path is available)  \n- Project / media pool / version history  \n\n## If the user asks about cloud cost\n\n- Point them at their provider console (MiniMax, Volcengine, OpenAI, etc.).  \n- Do not invent rates.\n",_=`# OpenChatCut UI & Features

## Project Entry & Dashboard

The app opens on a project dashboard. If there are no projects, a sample project may be created on first run.

- **New project** — Create an empty project and open the editor.
- **Scenario chips/cards** — In a new or empty AI conversation, users can pick workflow starters (inserts a starter prompt into the composer):
  - **Seedance / AI video** — Generate AI video clips from a text description (needs a configured video provider key).
  - **App Promo** — Create a polished promotional video for an app or website.
  - **URL to Ad Video** — Paste a product link to generate a short ad-style video (needs web + video providers as configured).
  - **Motion Graphics** — Generate animated visual elements from text or image references.
  - **Talking Head Editing** — Upload talking head footage; the agent picks the best takes, cuts filler words, tightens pacing, and adds motion graphics.
  - **Explainer Video** — Provide a topic (and optionally your own media); the agent creates a complete explainer video with AI narration, visuals, and background music.

## Editor Layout

The editor has five main areas:

### AI Panel

The conversation with the AI assistant. Users can reference timeline items and assets using @ mentions in the input box to tell the AI exactly what to modify. Files can be attached as context for the AI.

At the bottom of the panel:

- **Mode switcher** — Two modes:
  - **Agent** — Full AI editing assistant. The AI reads your message, understands context, and performs editing tasks.
  - **Ask** — Q&A only; does not edit the timeline.
- **Agent Settings** — Open from the controls next to the mode selector. Settings include:
  - **Thinking Mode** — Turn the agent's extra reasoning on or off.
  - **Motion Graphics Quality** — Choose Speed, Balance, or Quality for motion graphics generation.
  - **Auto-apply proposals** — When on, ordinary timeline proposals may apply automatically; generation / export tools still go through confirmation (skill guard).
- **Proposal / confirmation card** — Structural edits and generation tools may show a review card (apply / reject) before changes land.
- **+ button** — Upload reference files (images, videos, etc.) to include in your message.
- **Skills / 技能 (book icon)** — Open the Skills picker below the chat input. Users can choose a preset Skill or one of their saved Skills to guide the AI with a reusable workflow for the current message. Saved Skills are user-owned and can be reused across projects. The picker also includes **Save this editing process as a Skill**, which inserts a prompt asking the AI to help capture the current workflow.
- **Selection button** — Toggle selection mode. When active, the user can reference content by:
  - Clicking items on the timeline or in My Assets to reference specific clips/assets.
  - Dragging a box on the preview canvas to reference a screen region.
  - Clicking a point on the timeline ruler to reference a specific time.
  - Selecting text in the Transcript panel to reference a portion of speech.
    Selected references are added as @ mentions in the input box so the AI knows exactly what the user is referring to.
- **Send / Stop button** — Send a message or stop an in-progress task.

### Center — Preview

The video preview canvas. Shows a live preview of the timeline at the current playhead position. Supports playback controls below.

### My Assets, Library & Transcript Panels

Tabs that share one panel group (separate from the AI panel):

- **My Assets** (ZH: "素材库") — The user's media pool. Shows uploaded, recorded, imported, and generated media. Users can drag assets from here onto the timeline. The **Upload** button opens local file / folder import.
  - **Generation progress:** When AI generation tasks (video, image, music, etc.) are in progress, they appear in My Assets with a progress indicator. This is where users can check if a generation is still running or has completed.
  - **Generation failures:** If a generation fails, My Assets shows a failure status on the asset card. The user can ask the AI to regenerate.
  - **Bins:** Users can create bins/folders to organize assets.
- **Library** — Built-in presets/effects/assets that can be browsed separately from the user's own assets.
- **Templates** — Template browser when enabled.
- **Transcript** (ZH: "文字稿" / ES: "Transcripción") — A text-based editing panel for talking head / interview footage. Users edit the video by editing text:
  - Select and delete unwanted words/sentences to remove them from the timeline.
  - Drag text segments to reorder the video sequence.
  - While the agent edits, the result previews here live — deletions show struck through — and the user can fine-tune in this panel.
  - Transcript follows the active captions/source track. If no specific source track is set, it uses the first track with video or audio.

### Top Bar

From left to right:

- **Home icon** — Opens the project library/dashboard.
- **Project name** — Double-click (or edit control) to rename.
- **Undo / Redo** — Undo or redo editing actions.
- **Design style** — Brand colors/fonts for MG and captions.
- **Skin** — UI theme picker.
- **Versions** — Save and restore project snapshots.
- **Export history** — Recent exports.
- **Layout** — Toggle panel layout.
- **Export button** — Export timeline (video/audio/subtitles/XML depending on build). Motion graphics can also be baked / exported from clip menus when available.

### Playback Controls (above the timeline)

- **Split tool** (shortcut: C) — Split the clip at the playhead position.
- **Snapping toggle** (shortcut: Shift+M) — Enable/disable snap-to-grid when dragging items on the timeline.
- **Play / Pause** (shortcut: Space)
- **Time display** — Current position / total duration.
- **Zoom controls** — Zoom in/out on the timeline, plus "Zoom to Fit" to show the full timeline.
- **Aspect ratio** — Change the canvas dimensions. Presets: 16:9, 9:16, 1:1, 4:3, 3:4.
- **Captions** — Enable auto-captions and choose a caption style (e.g., Netflix, Minimal, TikTok, YouTube).
- **Fullscreen** (shortcut: \`) — Enter fullscreen preview mode.

### Timeline (bottom)

A project can hold multiple timelines (sequences) — for example a long cut and a short promo. The active timeline is selected from a dropdown above the timeline ruler; switching the dropdown swaps the visible tracks and clips while the asset library stays shared.

The timeline shows all tracks and clips for the active timeline. Caption tracks (C1, C2, ...) are above video tracks (V1, V2, ...), and audio tracks (A1, A2, ...) are below. Caption cues are shown as timed blocks on their owning caption track, and each caption track has independent content, visibility, style, and language settings. Users can:

- Use the **+** menu to create a video, audio/music, or caption track. New sequences remain available from the sequence tabs.
- Drag clips to reposition them.
- Drag edges to trim clips.
- Use the playhead (yellow marker) to scrub through the video.
- **Mark In/Out zone** — Press **I** to mark the in point, **O** to mark the out point, **X** to clear the zone. The selected zone can be used when exporting to only export that portion of the video (choose "Zone" as the export range in the Export panel).

Each track has controls: visibility toggle (eye icon), audio toggle (speaker icon), and delete (trash icon).
`,v='---\nname: shader-gen\ndescription: |\n  AI shader generator for WebGL video effects, transitions, masks, and color grading (LUT / 调色 / 电影感 / film look). Use when the user wants a video effect (滤镜 / 特效), a transition (转场 / crossfade / wipe / cube / 3d), a mask (蒙版 / 遮罩 / reveal), a zoom / push-in (推近 / 推镜头), or a color grade — try the built-in effects (zoom, builtin LUTs) before generating a new shader.\nuser-invocable: true\n---\n\n# Shader Generator\n\nSubmit-only: creates a backend generation job, returns `jobId`. Use the `track_progress` tool for job lifecycle after submission.\n\n**Always use `generate.ts` for new shaders.** Manual authoring is only for editing existing asset code — never as a fallback when generation fails.\n\n## Catalog-first rule — try existing assets before generation\n\nBefore generating a shader, call `browse_library` unless the user names an exact asset id that is already visible in `read_project`.\n\n`browse_library` is the source of truth for built-in effects, built-in transitions, and project effect/transition assets. Built-ins are stable global asset ids, not per-project DB assets, so they may not appear in `read_project` asset lists.\n\nApply catalog entries with `edit_item`, do **not** call `submit_shader`.\n\nGood catalog searches:\n\n```text\nbrowse_library(query: "zoom")\nbrowse_library(category: "transitions", query: "dissolve")\nbrowse_library(category: "audio-fx")\n```\n\nGenerate only when no catalog entry matches the user\'s intent closely enough.\n\n### `builtin:zoom` is track-bound only — DO NOT use item-bound\n\nThe default effect mode is `"item-bound"` (attach to a single item via `targetItemId`). **`builtin:zoom` does NOT render in item-bound mode** — the renderer reads zoom data exclusively from track-bound effect items. An item-bound zoom inserts into the DB silently but shows nothing in preview.\n\nUse `mode: "track-bound"` with `trackId` + `trackBoundFrom` + `trackBoundDurationInFrames`. These three fields are required.\n\n```text\n# Zoom on the entire video clip\nedit_item(json: \'{"adds":[{"type":"effect","assetId":"builtin:zoom","mode":"track-bound","trackId":"<clip-trackId>","trackBoundFrom":<clip-fromFrame>,"trackBoundDurationInFrames":<clip-durationInFrames>,"propertyOverrides":{"magnification":1.5,"shape":"hold"}}]}\')\n\n# Zoom on a sub-range of the clip (e.g. frames 90–150 only, a punch zoom on a beat)\nedit_item(json: \'{"adds":[{"type":"effect","assetId":"builtin:zoom","mode":"track-bound","trackId":"<trackId>","trackBoundFrom":90,"trackBoundDurationInFrames":60,"propertyOverrides":{"magnification":2,"shape":"punch"}}]}\')\n```\n\nGet `trackId` / `fromFrame` / `durationInFrames` from `read_project` (each video/image item lists its trackId and timeline-frame range).\n\n| Key             | Type   | Range / values                             | Default | Notes                                          |\n| --------------- | ------ | ------------------------------------------ | ------- | ---------------------------------------------- |\n| `magnification` | number | 1–4                                        | `1.5`   | Zoom factor; 1 = no zoom, 2 = 2× in            |\n| `focalPointX`   | number | 0–1                                        | `0.5`   | Horizontal focal point (0 = left, 1 = right)   |\n| `focalPointY`   | number | 0–1                                        | `0.5`   | Vertical focal point (0 = top, 1 = bottom)     |\n| `shape`         | select | `punch` / `hold` / `slow-push` / `instant` | `hold`  | Animation curve                                |\n| `focalMode`     | select | `auto` / `manual`                          | `auto`  | `auto` picks subject; `manual` uses focalPoint |\n| `easeInFrames`  | number | 0–60                                       | `8`     | Frames to ramp in                              |\n| `easeOutFrames` | number | 0–60                                       | `8`     | Frames to ramp out                             |\n\nOmit `propertyOverrides` entirely for default zoom. Send only the keys you want to change — patch semantics.\n\n### Track-bound vs item-bound — the broader rule\n\nEffect items in the schema have two modes:\n\n- **`item-bound`** (default): `targetItemId` only. Effect covers the whole target item\'s playback. Works for shader effects, LUTs, color grades, blurs.\n- **`track-bound`**: `trackId` + `trackBoundFrom` + `trackBoundDurationInFrames`. Effect covers a timeline range on a track, independent of any item. Required for `builtin:zoom`; also valid for any shader effect when you want it to cover a specific timeline range (e.g. a transition-like color shift across the boundary of two clips).\n\nDefault to item-bound for shader effects. Use track-bound when (a) the asset requires it (zoom), or (b) the effect should cover a timeline range that doesn\'t match a single item.\n\n### Built-in LUT properties\n\n```text\nedit_item(json: \'{"adds":[{"type":"effect","targetItemId":"<clip-id>","assetId":"builtin:slog3-s709","propertyOverrides":{"intensity":1}}]}\')\n```\n\n| Key         | Type   | Range | Default | Notes                          |\n| ----------- | ------ | ----- | ------- | ------------------------------ |\n| `intensity` | number | 0–1   | `1`     | LUT strength; 1 = full applied |\n\nTo swap: delete the effect and re-add with a different `assetId`. To remove: delete the effect item.\n\nThese are separate from user-uploaded `.cube` LUT assets (see "Applying an Existing LUT Asset" below) — those use a different code path with `assetId:"lut"`.\n\n## Beta Status Gate\n\nNew shader generation is beta. Before generating, warn the user and wait for explicit confirmation.\n\nUse the user\'s language. Chinese: "新的特效/转场生成目前还是 beta 阶段，可能会有不稳定的问题。如果你坚持要做，我可以帮你实现。" Skip if user already acknowledged in the same request.\n\n## Supported Targets\n\nEffects and transitions apply to `video`, `image`, and `gif` items.\n\n## Type Routing\n\nBefore generating anything, check two non-generation paths first:\n\n1. **Catalog entry** — use `browse_library` for built-in and project effects/transitions.\n2. **User-uploaded `.cube` LUT asset** that already exists in the project library — separate code path, see "Applying an Existing LUT Asset" below. The asset shows up in `read_project` with `type: lut`.\n\n| User wants                                                           | `--type`     |\n| -------------------------------------------------------------------- | ------------ |\n| Video appearance (color, blur, glow, grain, distortion)              | `effect`     |\n| Color grade / look (teal-orange, cinematic, vintage, LUT-style)      | `effect`     |\n| Visibility control (mask, reveal, wipe, shape cutout, gradient fade) | `effect`     |\n| Blend between clips (crossfade, dissolve, slide, 3D cube/page flip)  | `transition` |\n\n"LUT-style" in the table means **generating a fresh GLSL color grade that resembles a LUT** — only when the user wants something new. If they want to apply a `.cube` file already in the library, don\'t generate; bind the existing asset instead.\n\nNo separate LUT or mask generator for the generation path — those are all `effect`.\n\n## Applying an Existing LUT Asset\n\n`.cube` files uploaded by the user become `lut` assets. Applying one to a clip is **not** generation — it\'s a single `edit_item` call that attaches an effect item whose `assetId` is the literal string `"lut"` and whose `propertyOverrides.lut` binds the real LUT asset id. (Legacy contract; the unified LUT API binds the LUT effect asset id directly — see `edit_item` description.)\n\n```text\nedit_item(json: \'{"adds":[{"type":"effect","targetItemId":"<clip-id>","assetId":"lut","propertyOverrides":{"intensity":1,"lut":{"assetId":"<lut-asset-id>","assetType":"lut","type":"asset"}}}]}\')\n```\n\nKey points:\n\n- `assetId` is the literal string `"lut"`, not the LUT asset\'s id. The real LUT asset id goes inside `propertyOverrides.lut.assetId`.\n- `intensity` is 0–1; default 1 (full strength).\n- `targetItemType` defaults to `video`; also supports `image`, `gif`.\n- To swap a LUT on an existing effect: update `propertyOverrides.lut.assetId` to the new LUT asset id.\n- To remove: delete the effect item.\n\nDo not call `generate.ts` for this path. Do not pass a real LUT asset id as `assetId` — the editor checks `assetId === "lut"` to route into the LUT renderer; passing a UUID silently renders nothing.\n\n## Usage\n\nBefore calling `submit_shader`, restate the user\'s intent in one concrete sentence, then proceed immediately. After `track_progress` returns, state what was produced in one line — do NOT ask "要保留还是重新生成".\n\n```ts\nsubmit_shader({\n  type: "effect",\n  prompt: "Chromatic aberration with RGB split",\n  name: "Chromatic Aberration",\n});\n\nsubmit_shader({\n  type: "transition",\n  prompt: "Smooth crossfade with soft edge",\n  name: "Crossfade",\n});\n\nsubmit_shader({\n  type: "effect",\n  prompt: "Cinematic teal-orange color grade",\n});\n\nsubmit_shader({\n  type: "effect",\n  prompt: "Stronger version",\n  referenceAssetIds: ["effect_asset_id"],\n});\n```\n\n## Strategy\n\n- Submit, then stop. Tell user the job was created.\n- Use the `track_progress` tool for status/wait after submission.\n- Generation always produces a library asset — never refuse because the timeline isn\'t ready.\n- **Apply is separate and optional.** Only apply when user explicitly asks ("加到视频", "apply", "用到第一段"). When ambiguous, default to library-only.\n\n## Editing Existing Properties\n\nAny time you\'re about to edit shader `asset.properties`, applied effect/transition `item.propertyOverrides`, or promote a hardcoded shader value, read [`references/property-changes.md`](references/property-changes.md) first.\n\nIt reinforces that shader `properties` is an array, but the allowed shader property types are only `number`, `boolean`, `color`, `select`, and `vec2`. Motion Graphic properties are also arrays, but use a different type set.\n\n## Parameters\n\n| Param               | Description                                                                                                                                                    | Default |\n| ------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------- |\n| `type`              | `"effect"` or `"transition"` (req\'d)                                                                                                                           | —       |\n| `prompt`            | Description of the shader (req\'d)                                                                                                                              | —       |\n| `name`              | Asset name shown in library                                                                                                                                    | —       |\n| `referenceAssetIds` | Asset ids. Image id → model LOOKS AT it for visual inspiration. Effect/transition id → reuse its code as style anchor (≤1 per submit, kind must match `type`). | —       |\n\n## Output\n\nReturns `{ success, job: { jobId, status }, manage: { status, wait, watch } }`.\n\n## Applying to Timeline\n\nOnly when user explicitly requests. Call `read_project` first for fresh timeline state.\n\n### Effect\n\n```text\nedit_item(json: \'{"adds":[{"type":"effect","targetItemId":"<id>","assetId":"<id>","enabled":true,"propertyOverrides":{}}]}\')\n```\n\n### Transition\n\nRequires two adjacent same-track endpoints. `edit_item` validates live seam feasibility and refuses durations that would require freeze frames or overlapping neighboring transitions. If the add fails, retry with the suggested `durationInFrames`, trim the clips to expose handles, delete/shorten neighboring transitions, or keep a hard cut.\n\n```text\nedit_item(json: \'{"adds":[{"type":"transition","assetId":"<id>","outgoingItemId":"<id1>","incomingItemId":"<id2>","durationInFrames":30}]}\')\n```\n\n## Validation & Verification\n\n### Backend Validation\n\nWhen generating via `generate.ts`, the backend handles validation automatically (transpile, AST security, class structure, retry on failure).\n\n### Manual Code Verification\n\n**NEVER write shader code from scratch.** Always use `generate.ts` for new shaders. This section is ONLY for modifying existing shader code that was already generated.\n\nWhen writing shader code manually, read `${CLAUDE_SKILL_DIR}/references/design-principles.md` first. If the change touches editable properties, also read `${CLAUDE_SKILL_DIR}/references/property-changes.md`.\n\nTypical workflow:\n\n1. `read_project` with the shader `assetId` and `code: true` — read the current source.\n2. Edit the source in your own context.\n3. `edit_asset` with `action=update`, the same `assetId`, and the full replacement source inline in `json.code`. Validation runs automatically on update — if code is invalid, the update is rejected with error details.\n',y=`---
tags: 3d, cube, rotate, box, spin
description: 3D cube rotation — outgoing on front face, incoming on right face, rotates 90° around Y axis.
complexity: high
---

# Cube Rotate Transition

Uses BoxGeometry with per-face materials. Only two faces carry textures (front=outgoing, right=incoming), the rest are black.

Key decisions:

- \`BoxGeometry(1.5 * aspect, 1.5, 1.5 * aspect)\` — depth matches width so the cube face is square in the X/Z plane, preserving correct rotation geometry regardless of video aspect ratio.
- \`camera.position.z = 2.5\` — positions the camera so the cube face fills most of the viewport at FOV 45.
- Rotation is around Y axis with cubic easing — starts slow, accelerates mid-turn, decelerates at the end.

\`\`\`typescript
class CubeTransition extends TransitionProcessor {
  private scene!: Scene;
  private camera!: PerspectiveCamera;
  private cube!: Mesh;
  private outMat!: MeshBasicMaterial;
  private inMat!: MeshBasicMaterial;

  async initialize(ctx: TransitionInitContext): Promise<void> {
    const aspect = ctx.width / ctx.height;
    this.scene = new Scene();
    this.camera = new PerspectiveCamera(45, aspect, 0.1, 1000);
    this.camera.position.z = 2.5;

    const geometry = new BoxGeometry(1.5 * aspect, 1.5, 1.5 * aspect);
    this.outMat = new MeshBasicMaterial();
    this.inMat = new MeshBasicMaterial();

    // Front face (index 4) and Right face (index 0)
    const materials = [
      this.inMat,
      new MeshBasicMaterial({ color: 0x000000 }),
      new MeshBasicMaterial({ color: 0x000000 }),
      new MeshBasicMaterial({ color: 0x000000 }),
      this.outMat,
      new MeshBasicMaterial({ color: 0x000000 }),
    ];
    this.cube = new Mesh(geometry, materials);
    this.scene.add(this.cube);
  }

  protected render(ctx: TransitionRenderContext): WebGLTexture {
    this.outMat.map = ctx.three.wrapTexture(ctx.outgoingTexture);
    this.inMat.map = ctx.three.wrapTexture(ctx.incomingTexture);

    // Cubic easing
    const p = ctx.progress;
    const eased = p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2;
    this.cube.rotation.y = -eased * (Math.PI / 2);

    return ctx.threePass(this.scene, this.camera);
  }
}
\`\`\`
`,b=`---
tags: 3d, door, open, split, swing, hinge
description: Door open transition — outgoing splits into two halves that swing open like doors, revealing incoming behind.
complexity: high
---

# Door Open Transition

Three layers: incoming backdrop behind, left door and right door in front. Each door shows the correct half of the outgoing texture and swings outward on its outer edge hinge.

Key decisions:

- **Camera distance from FOV**: \`dist = 1 / Math.tan(fovRad / 2)\` ensures height=2 plane fills viewport. No hardcoded camera z.
- **UV remapping for split texture**: Left door UVs remapped to u:[0, 0.5], right door to u:[0.5, 1]. Each half-panel shows only its corresponding half of the outgoing frame — not the full frame squeezed.
- **Object3D pivot pattern**: Each door's geometry is offset so the hinge edge sits at local origin. The Object3D parent is positioned at the screen edge. Rotating the Object3D swings the door around the correct hinge. Left hinge at x=-W/2, right hinge at x=+W/2.
- **Doors swing into screen**: Left door rotates -Y (swings away-left), right door rotates +Y (swings away-right). Both swing toward negative z, creating a natural "opening toward the viewer" perspective effect.

\`\`\`typescript
class DoorOpenTransition extends TransitionProcessor {
  private scene!: Scene;
  private camera!: PerspectiveCamera;
  private leftPivot!: Object3D;
  private rightPivot!: Object3D;
  private leftMat!: MeshBasicMaterial;
  private rightMat!: MeshBasicMaterial;
  private backMat!: MeshBasicMaterial;

  async initialize(ctx: TransitionInitContext): Promise<void> {
    const aspect = ctx.width / ctx.height;
    const fov = 50;
    const dist = 1 / Math.tan((fov * Math.PI) / 180 / 2);

    this.scene = new Scene();
    this.camera = new PerspectiveCamera(fov, aspect, 0.01, 100);
    this.camera.position.z = dist;

    const W = 2 * aspect;
    const H = 2;

    // Backdrop: incoming clip, full width
    this.backMat = new MeshBasicMaterial({ side: 2 });
    const back = new Mesh(new PlaneGeometry(W, H), this.backMat);
    back.position.z = -0.05;
    this.scene.add(back);

    // Left door: shows LEFT half of outgoing (UV u: 0→0.5)
    // Hinge at LEFT edge (x = -W/2)
    const leftGeo = new PlaneGeometry(W / 2, H, 1, 1);
    const leftUV = leftGeo.attributes.uv;
    for (let i = 0; i < leftUV.count; i++) {
      leftUV.setX(i, leftUV.getX(i) * 0.5);
    }
    leftUV.needsUpdate = true;
    this.leftMat = new MeshBasicMaterial({ side: 2 });
    const leftDoor = new Mesh(leftGeo, this.leftMat);
    // Shift geometry so LEFT edge is at local origin (pivot)
    leftDoor.geometry.translate(W / 4, 0, 0);
    this.leftPivot = new Object3D();
    this.leftPivot.position.x = -W / 2;
    this.leftPivot.add(leftDoor);
    this.scene.add(this.leftPivot);

    // Right door: shows RIGHT half of outgoing (UV u: 0.5→1)
    // Hinge at RIGHT edge (x = +W/2)
    const rightGeo = new PlaneGeometry(W / 2, H, 1, 1);
    const rightUV = rightGeo.attributes.uv;
    for (let i = 0; i < rightUV.count; i++) {
      rightUV.setX(i, 0.5 + rightUV.getX(i) * 0.5);
    }
    rightUV.needsUpdate = true;
    this.rightMat = new MeshBasicMaterial({ side: 2 });
    const rightDoor = new Mesh(rightGeo, this.rightMat);
    // Shift geometry so RIGHT edge is at local origin (pivot)
    rightDoor.geometry.translate(-W / 4, 0, 0);
    this.rightPivot = new Object3D();
    this.rightPivot.position.x = W / 2;
    this.rightPivot.add(rightDoor);
    this.scene.add(this.rightPivot);
  }

  protected render(ctx: TransitionRenderContext): WebGLTexture {
    const p = ctx.progress;
    const eased = p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2;

    this.backMat.map = ctx.three.wrapTexture(ctx.incomingTexture);
    this.leftMat.map = ctx.three.wrapTexture(ctx.outgoingTexture);
    this.rightMat.map = ctx.three.wrapTexture(ctx.outgoingTexture);

    // Left door: hinge on left, swings into screen (negative Y rotation)
    this.leftPivot.rotation.y = -eased * (Math.PI / 2);
    // Right door: hinge on right, swings into screen (positive Y rotation)
    this.rightPivot.rotation.y = eased * (Math.PI / 2);

    return ctx.threePass(this.scene, this.camera);
  }
}
\`\`\`
`,x=`---
tags: 3d, page, curl, flip, turn, book, peel
description: Page curl transition — outgoing page curls away from left to right, revealing incoming underneath.
complexity: high
---

# Page Curl Transition

Two-layer approach: incoming page sits flat behind (z=-0.001), outgoing page is a high-res subdivided plane (80x80) whose vertices are deformed each frame to simulate a cylindrical curl.

Key decisions:

- **Camera distance from FOV**: \`dist = 1 / Math.tan(fovRad / 2)\` ensures the plane (height=2) exactly fills the viewport vertically. No hardcoded camera z.
- **Radius proportional to page width**: \`radius = W * 0.08\` scales with aspect ratio, preventing the curl from being too tight on wide videos or too loose on tall ones.
- **Fold sweeps left→right**: \`foldX = -W/2 + eased * (W + radius * PI)\`. At progress=0 fold is at left edge (nothing curled), at progress=1 it's past the right edge (fully curled away).
- **UV-based position reconstruction**: Original positions are derived from UVs each frame (\`ox = uv.getX(i) * W - W/2\`), since the position buffer gets overwritten. UVs are immutable.
- **Three curl zones**: (1) \`ox <= foldX\` → flat, not yet reached. (2) \`ox > foldX, angle <= PI\` → wrapping around cylinder. (3) \`angle > PI\` → past 180°, extends flat at z=2\\*radius back toward -x (folded-back page visible on top).
- **\`side: 2\` (DoubleSide)**: Back of the curling page is visible during the curl.
- **Texture swap**: \`incomingMat\` gets \`outgoingTexture\`, \`curlMat\` gets \`incomingTexture\` — the curling-away page shows incoming, the flat base shows outgoing. This creates the effect of a new page being revealed as the old one peels off.

\`\`\`typescript
export class PageCurlTransition extends TransitionProcessor {
  private scene!: Scene;
  private camera!: PerspectiveCamera;
  private curlMesh!: Mesh;
  private incomingMesh!: Mesh;
  private curlMat!: MeshBasicMaterial;
  private incomingMat!: MeshBasicMaterial;
  private aspect!: number;
  private W!: number;

  async initialize(ctx: TransitionInitContext): Promise<void> {
    this.aspect = ctx.width / ctx.height;
    this.scene = new Scene();

    const fov = 45;
    const fovRad = (fov * Math.PI) / 180;
    const dist = 1 / Math.tan(fovRad / 2);

    this.camera = new PerspectiveCamera(fov, this.aspect, 0.01, 100);
    this.camera.position.z = dist;

    this.W = 2 * this.aspect;
    const H = 2;

    this.incomingMat = new MeshBasicMaterial({ side: 2 });
    this.incomingMesh = new Mesh(
      new PlaneGeometry(this.W, H),
      this.incomingMat,
    );
    this.incomingMesh.position.z = -0.001;
    this.scene.add(this.incomingMesh);

    this.curlMat = new MeshBasicMaterial({ side: 2 });
    this.curlMesh = new Mesh(
      new PlaneGeometry(this.W, H, 80, 80),
      this.curlMat,
    );
    this.scene.add(this.curlMesh);
  }

  protected render(ctx: TransitionRenderContext): WebGLTexture {
    const p = ctx.progress;
    const eased = p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2;

    this.incomingMat.map = ctx.three.wrapTexture(ctx.outgoingTexture);
    this.curlMat.map = ctx.three.wrapTexture(ctx.incomingTexture);

    const W = this.W;
    const radius = W * 0.08;
    const foldX = -W / 2 + eased * (W + radius * Math.PI);

    const pos = this.curlMesh.geometry.attributes.position;
    const uv = this.curlMesh.geometry.attributes.uv;
    const count = pos.count;

    for (let i = 0; i < count; i++) {
      const ox = uv.getX(i) * W - W / 2;
      const oy = uv.getY(i) * 2 - 1;

      let nx: number, nz: number;

      if (ox <= foldX) {
        nx = ox;
        nz = 0;
      } else {
        const delta = ox - foldX;
        const angle = delta / radius;
        if (angle <= Math.PI) {
          nx = foldX + radius * Math.sin(angle);
          nz = radius * (1 - Math.cos(angle));
        } else {
          const extra = delta - radius * Math.PI;
          nx = foldX - extra;
          nz = radius * 2;
        }
      }

      pos.setXYZ(i, nx, oy, nz);
    }

    pos.needsUpdate = true;
    this.curlMesh.geometry.computeVertexNormals();

    return ctx.threePass(this.scene, this.camera);
  }
}
\`\`\`
`,S=`# Shader Effect & Transition Design Principles

This document contains the system prompt and design guidelines used by Gemini when generating shader code. Follow these same rules when writing shader code manually.

<role>
You are an expert WebGL shader programmer writing GPU-accelerated video effects and transitions for a professional video editor.
You write TypeScript classes that extend EffectProcessor (effects) or TransitionProcessor (transitions).
</role>

## Constraints

**Violations cause runtime crashes. Strict compliance required.**

1. **TypeScript only.** Class MUST extend \`EffectProcessor\` (effect) or \`TransitionProcessor\` (transition).
2. **No import statements.** \`EffectProcessor\` / \`TransitionProcessor\` are pre-injected in scope.
3. **Use \`export\` before class declaration** (it will be stripped automatically).
4. **Fragment shaders MUST use \`#version 300 es\`, \`precision highp float\`.**
5. **Available in scope:** EffectProcessor, TransitionProcessor, Array, Object, Math, Float32Array, Int32Array, Uint8Array, console.
6. **BLOCKED (will fail validation):** window, document, fetch, eval, Function, import, require, setTimeout, setInterval, process, globalThis, crypto, WebSocket, XMLHttpRequest, navigator, localStorage, sessionStorage, Worker, ServiceWorker, and all other browser/Node globals.
7. **Max code length:** 50,000 characters.
8. **Multi-pass effects:** Always call \`ctx.releaseTexture()\` on intermediate textures to avoid GPU memory leaks.
9. **Do NOT implement \`getMetadata()\`.** Properties are declared in the JSON response, not in code.
10. **Shader compilation:** All shaders MUST be compiled in \`initialize(ctx)\` via \`ctx.compileShader({ id, fragmentShader, vertexShader? })\`. The \`id\` must match the \`id\` used in \`renderPass()\`.
11. **Custom vertex shader:** Pass a custom vertex shader in \`compileShader({ id, fragmentShader, vertexShader })\`. If omitted, the default vertex shader is used.

## Effect API

The default vertex shader provides \`v_texCoord\` (vec2, 0-1 UV coordinates). Use \`uniform sampler2D u_input\` for the input video texture.

\`\`\`typescript
interface EffectRenderContext {
  readonly gl: WebGL2RenderingContext;
  readonly width: number;
  readonly height: number;
  readonly frame: number;
  readonly time: number;
  readonly fps: number;
  readonly progress: number; // 0-1 progress within clip
  readonly inputTexture: WebGLTexture;
  readonly properties: Record<string, unknown> | undefined;
  renderPass(options: RenderPassOptions): WebGLTexture;
  acquireTexture(): WebGLTexture;
  releaseTexture(texture: WebGLTexture): void;
}

interface EffectInitContext {
  compileShader(options: {
    id: string;
    fragmentShader: string;
    vertexShader?: string;
  }): void;
  readonly width: number;
  readonly height: number;
}
\`\`\`

### Effect Example

\`\`\`typescript
export class GrayscaleEffect extends EffectProcessor {
  async initialize(ctx: EffectInitContext): Promise<void> {
    ctx.compileShader({
      id: "grayscale",
      fragmentShader: \`#version 300 es
      precision highp float;
      uniform sampler2D u_input;
      uniform float u_intensity;
      in vec2 v_texCoord;
      out vec4 fragColor;
      void main() {
        vec4 color = texture(u_input, v_texCoord);
        float gray = dot(color.rgb, vec3(0.299, 0.587, 0.114));
        fragColor = vec4(mix(color.rgb, vec3(gray), u_intensity), color.a);
      }\`,
    });
  }

  protected render(ctx: EffectRenderContext): WebGLTexture {
    const props = ctx.properties as { intensity?: number } | undefined;
    return ctx.renderPass({
      id: "grayscale",
      textures: { u_input: ctx.inputTexture },
      uniforms: { u_intensity: props?.intensity ?? 1.0 },
    });
  }
}
\`\`\`

## Transition API

A transition blends TWO video frames: the outgoing clip (fading out) and the incoming clip (fading in).
The shader receives both textures and a \`progress\` value (0→1). At progress=0, show only the outgoing clip. At progress=1, show only the incoming clip.

Use \`uniform sampler2D u_outgoing\` and \`uniform sampler2D u_incoming\` for the two video textures. Use \`uniform float u_progress\` for the blend progress.

\`\`\`typescript
interface TransitionRenderContext {
  readonly gl: WebGL2RenderingContext;
  readonly width: number;
  readonly height: number;
  readonly frame: number;
  readonly time: number;
  readonly fps: number;
  readonly progress: number; // 0→1 (0=outgoing, 1=incoming)
  readonly outgoingTexture: WebGLTexture;
  readonly incomingTexture: WebGLTexture;
  readonly properties: Record<string, unknown> | undefined;
  renderPass(options: RenderPassOptions): WebGLTexture;
  acquireTexture(): WebGLTexture;
  releaseTexture(texture: WebGLTexture): void;
}

interface TransitionInitContext {
  compileShader(options: {
    id: string;
    fragmentShader: string;
    vertexShader?: string;
  }): void;
  readonly width: number;
  readonly height: number;
}
\`\`\`

### Transition Examples

**Crossfade:**

\`\`\`typescript
export class CrossfadeTransition extends TransitionProcessor {
  async initialize(ctx: TransitionInitContext): Promise<void> {
    ctx.compileShader({
      id: "crossfade",
      fragmentShader: \`#version 300 es
      precision highp float;
      uniform sampler2D u_outgoing;
      uniform sampler2D u_incoming;
      uniform float u_progress;
      in vec2 v_texCoord;
      out vec4 fragColor;
      void main() {
        vec4 outColor = texture(u_outgoing, v_texCoord);
        vec4 inColor = texture(u_incoming, v_texCoord);
        fragColor = mix(outColor, inColor, u_progress);
      }\`,
    });
  }

  protected render(ctx: TransitionRenderContext): WebGLTexture {
    return ctx.renderPass({
      id: "crossfade",
      textures: {
        u_outgoing: ctx.outgoingTexture,
        u_incoming: ctx.incomingTexture,
      },
      uniforms: { u_progress: ctx.progress },
    });
  }
}
\`\`\`

**Directional Wipe:**

\`\`\`typescript
export class DirectionalWipe extends TransitionProcessor {
  async initialize(ctx: TransitionInitContext): Promise<void> {
    ctx.compileShader({
      id: "wipe",
      fragmentShader: \`#version 300 es
      precision highp float;
      uniform sampler2D u_outgoing;
      uniform sampler2D u_incoming;
      uniform float u_progress;
      uniform float u_softness;
      uniform int u_direction;
      in vec2 v_texCoord;
      out vec4 fragColor;
      void main() {
        float coord = u_direction == 0 ? v_texCoord.x :
                      u_direction == 1 ? 1.0 - v_texCoord.x :
                      u_direction == 2 ? v_texCoord.y : 1.0 - v_texCoord.y;
        float edge = smoothstep(u_progress - u_softness, u_progress + u_softness, coord);
        vec4 outColor = texture(u_outgoing, v_texCoord);
        vec4 inColor = texture(u_incoming, v_texCoord);
        fragColor = mix(inColor, outColor, edge);
      }\`,
    });
  }

  protected render(ctx: TransitionRenderContext): WebGLTexture {
    const props = ctx.properties as
      | { softness?: number; direction?: string }
      | undefined;
    const dirMap: Record<string, number> = {
      left: 0,
      right: 1,
      top: 2,
      bottom: 3,
    };
    return ctx.renderPass({
      id: "wipe",
      textures: {
        u_outgoing: ctx.outgoingTexture,
        u_incoming: ctx.incomingTexture,
      },
      uniforms: {
        u_progress: ctx.progress,
        u_softness: props?.softness ?? 0.1,
        u_direction: dirMap[props?.direction ?? "left"] ?? 0,
      },
    });
  }
}
\`\`\`

## Properties

Properties define UI controls exposed to the user. Declare them in the JSON output, NOT in \`getMetadata()\`.

Shader \`properties\` is always an array. Each entry: \`{ key, label, type, defaultValue, [min, max, step] }\`.

Shader property types are: \`number\`, \`boolean\`, \`color\`, \`select\`, \`vec2\`. Motion Graphic properties are also arrays, but use a different type set — do not use Motion Graphic-only types such as \`text\`, \`font\`, \`image\`, or \`video\` for shaders.

| Type      | Use case                    | defaultValue example |
| --------- | --------------------------- | -------------------- |
| \`number\`  | Intensity, radius, softness | \`"0.5"\`              |
| \`boolean\` | Toggle on/off               | \`"true"\`             |
| \`color\`   | Tint color                  | \`"#ffffff"\`          |
| \`select\`  | Direction, mode choice      | \`"left"\`             |
| \`vec2\`    | Center point, offset        | \`"0.5,0.5"\`          |

Number properties render as sliders when \`min\` and \`max\` are present; \`step\` is optional.

## Design Principles

**1. Subtle Over Heavy**
Effects should enhance, not overpower. Default property values should produce a tasteful result out of the box — users should be impressed on first apply, not scrambling to dial it down.

**1a. Broadcast-Quality Aesthetics (Effects)**
Design for a professional video editor, not a toy filter app.

- Think film color grading (Davinci Resolve), not Instagram sticker filters. Subtle warmth shift > heavy neon overlay.
- When manipulating color, preserve skin tones and natural contrast. Crushing blacks or blowing highlights screams amateur.
- Animated effects should use smooth easing (sine, exponential decay), not linear ramps. Match frequency to the real-world phenomenon (grain flickers fast, lens flares drift slow).
- Overlay elements (particles, bokeh, light leaks) must use \`additive\` or \`screen\` blending — never paste opaque shapes.
- Multi-pass blur/glow needs enough taps for smooth gradients (5+ or two-pass separable Gaussian).
- Avoid: solid color overlays as "tint", single-pixel blur as "cinematic", uniform noise as "film grain", constant-offset chromatic aberration (real CA is radial).

**2. Performance Matters**

- Minimize texture samples and passes. One pass is ideal; two is acceptable; three+ needs justification.
- Avoid branching in fragment shaders when possible (use \`mix\`, \`step\`, \`smoothstep\`).
- Use \`mediump\` for values that don't need full precision (e.g. UV coordinates in simple effects).

**3. Smooth Transitions**
Transitions must be visually seamless: at \`progress=0\` the output must be pixel-identical to the outgoing clip, at \`progress=1\` pixel-identical to the incoming clip. No sudden jumps, no artifacts at the boundary frames.

**3a. Cinematic Motion (Transitions)**
Design for a professional video editor, not PowerPoint.

- NEVER use linear progress. Always apply easing — cubic (\`p*p*p\`), exponential (\`pow(p, 2.5)\`), ease-in-out (\`smoothstep\`), or spring-like curves.
- Add secondary motion: if geometry moves, add rotation or scale. If a wipe reveals, add a soft glow or blur at the edge.
- Stagger timing across elements — simultaneous motion looks robotic.
- Add depth cues: shadows, parallax, perspective distortion, blur on receding elements.
- Both clips should participate in the transition. A static incoming frame behind a moving outgoing frame is lazy.
- For 3D: ramp lighting intensity with progress so the first frame matches the source video exactly. Only apply strong specular/phong shading after motion begins.
- Avoid flat 2D slides with hard edges, uniform-speed grid dissolves, and unlit 3D rotations.

**4. Expose the Right Controls**

- Every effect should expose an \`intensity\` or \`amount\` property (0-1) so the user can dial it back.
- Transitions should expose \`softness\` / \`feather\` where applicable.
- Keep property count low (2-5). Too many controls overwhelm the user.

**5. GPU Memory Hygiene**
Multi-pass effects must release intermediate textures via \`ctx.releaseTexture()\`. Leaking textures causes GPU memory exhaustion during long playback.

**6. Aspect Ratio in 3D Transitions**
3D transitions using \`threePass()\` must account for the video aspect ratio. In \`initialize(ctx)\`, use \`const aspect = ctx.width / ctx.height\` to create correctly-sized geometry: \`PlaneGeometry(2 * aspect, 2)\` — never \`PlaneGeometry(2, 2)\`. Derive face positions and camera distance from \`aspect\` and the camera's FOV so the outgoing frame fills the viewport exactly at \`progress=0\`. Hard-coded geometry positions (e.g. \`z = 1\`) produce distorted or letterboxed output on non-square videos.

## Output Format

Respond with valid JSON:

\`\`\`json
{
  "typescript_code": "export class ... extends EffectProcessor { ... }",
  "name": "Short effect name",
  "description": "Brief description of what the effect does",
  "properties": [
    {
      "key": "intensity",
      "label": "Intensity",
      "type": "number",
      "defaultValue": "1.0",
      "min": 0,
      "max": 1,
      "step": 0.01
    }
  ]
}
\`\`\`
`,C='# Shader Property Changes\n\nRead this whenever a task touches editable shader properties: adding, renaming, or removing a property key; changing a default; promoting a hardcoded shader constant; or updating one applied effect/transition override.\n\n## Data Model\n\nThree layers, in strict order:\n\n1. `asset.properties` - editable property **schema** on the effect or transition asset. Declares every key (type, label, default, and `min`/`max`/`step` or `options`). Source of truth.\n2. `item.propertyOverrides` - per-applied-item overrides. Sparse: only values that differ for that specific effect/transition item need to be stored.\n3. `ctx.properties` - runtime object passed into the shader processor. Built by merging schema defaults with the applied item\'s overrides.\n\nShader property types are: `number`, `boolean`, `color`, `select`, `vec2`. Motion Graphic properties are also arrays, but use a different type set - do not use Motion Graphic-only types such as `text`, `font`, `image`, or `video` for shaders.\n\n**Prerequisite rule:** a key must exist in `asset.properties` before shader code should read `ctx.properties.key`, and before an applied item override can show a control for that key.\n\nFor shader assets, `asset.properties` is always an array. Each object inside the array is one editable property entry.\n\n## Decision Table\n\nUse `edit_asset` when:\n\n- shader code starts reading a new `ctx.properties.key`\n- a property key is added, renamed, or removed\n- a property type, label, options, or default changes\n\nUse an applied item update with `propertyOverrides` when:\n\n- the key already exists on the effect/transition asset\n- one applied effect/transition item should use a different value than the asset default\n\nDo not use `propertyOverrides` to add schema. Do not use `edit_asset` for one-off instance values.\n\n## Promoting Hardcoded Values to Properties\n\nWhen the user asks to adjust a hardcoded shader value (intensity, radius, color, softness, direction, center point, or anything tweakable), in the same turn both make the shader change AND promote the value to a property. That way they can self-serve next time from the editor\'s property controls.\n\nSkip promotion when:\n\n- user explicitly frames it as one-off ("just this once", "only for this item")\n- the value is structural: texture binding names, pass IDs, GLSL constants required for loop unrolling, or math tied to shader correctness\n- the asset is a locked template the user doesn\'t own\n\nWorkflow (one turn):\n\n1. Fetch the current shader asset code and properties\n2. Locate the hardcoded literal\n3. Replace it with `ctx.properties.<key>` plus a fallback to the current value so existing items render identically\n4. Add a matching entry inside the `properties` array with sensible `min`/`max`/`step` or `options`\n5. `edit_asset` with both the updated `code` and `properties` in one call\n6. If the user also asked for a specific new value, apply it either as the new `defaultValue` (baseline) or as a `propertyOverride` on the specific applied item\n\nExample - promoting an intensity constant:\n\n```ts\nconst props = ctx.properties as { intensity?: number } | undefined;\nconst intensity = props?.intensity ?? 0.6;\n```\n\n```json\n"properties": [\n  {\n    "key": "intensity",\n    "label": "Intensity",\n    "type": "number",\n    "defaultValue": 0.6,\n    "min": 0,\n    "max": 1,\n    "step": 0.01\n  }\n]\n```\n\nExample - promoting a center point:\n\n```json\n"properties": [\n  {\n    "key": "center",\n    "label": "Center",\n    "type": "vec2",\n    "defaultValue": [0.5, 0.5]\n  }\n]\n```\n\n## Asset-Level Changes\n\nWhen the schema changes, update the shader asset\'s `code` and `properties` in the same `edit_asset` call. Validation runs on update and rejects unsupported property shapes or shader-only/Motion-Graphic-only type mixups.\n\n1. Fetch the current asset with code and properties\n2. Update code to read the target key from `ctx.properties`\n3. `edit_asset` with both the new `properties` array and the new `code`\n4. If a key was renamed, migrate affected applied item overrides to the new key\n\nKeep keys stable when possible - renames create migration work.\n\n## Item-Level Changes\n\nPrerequisite: the key must already exist on `asset.properties`. If it doesn\'t, do not update `propertyOverrides` - go to "Promoting Hardcoded Values" or "Asset-Level Changes" first.\n\nUpdate only the applied effect/transition item whose value should differ from the asset default.\n\n```json\n{ "propertyOverrides": { "intensity": 0.8 } }\n```\n\n```json\n{ "propertyOverrides": { "center": [0.45, 0.55] } }\n```\n',w=`---
name: talking-head-guide
description: |
  Guide for editing videos where the primary content is people talking — talking-head / 口播, interview / 访谈, lecture, tutorial, podcast, course content, and similar talking-driven formats. Use when the user wants speech editing on a talking video (剪口播 / 口播剪辑 / 去口癖 / clean up fillers / smooth speech), motion graphics layered onto talking video (口播加 MG / 加动画), or B-roll on a talking video (加 B-roll / add B-roll). For motion graphics specifically, use this together with the active Motion Graphics skill/workflow available in the current OpenChatCut environment — this skill adds talking-specific guidance (speech-rhythm timing, frame-aware placement, subject/caption protection, placement verification).
user-invocable: true
---

# Talking Head Video Editing

## What this skill covers

**Required input**: an existing talking-head / 口播 video uploaded to the project. If the user wants to start without one (e.g., generate a fresh talking-head from scratch), this skill doesn't apply.

**When the user enters this workflow without a source video uploaded yet, ask via a widget surface — bundle the file upload with the treatment selection in one flow**, not two separate turns or a markdown "drag your file in" instruction. Load \`widget-forms\` for the host-specific route. Never tell the user to "拖进编辑器" / "点击素材库的上传按钮"; that's friction with no upside.

When the task creates or targets a OpenChatCut project for the user, surface the editor link early so they can watch progress, and re-confirm the visible editor matches the project before final delivery.

Independent treatments that can be applied to talking-head videos. Pick the ones that match what the user wants — not all are needed every time.

- **A-roll editing** (中文称 **语音剪辑** / 含 **去口癖、停顿、重复**) — transcript-based speech editing. Common operations include cleanup, highlight extraction, restructure, opening hook, and others as needed for the aligned outcome.
- **Motion graphics overlay** (英文展示给用户时写全称 **Motion Graphics**，不要缩成 "MG"；中文产品术语固定为 **MG 动画**——不要叫"动效""字幕条""动态字幕"等其它说法) — reinforce key information, structured content, and topic transitions with on-screen motion graphics
- **B-roll** (industry term — keep as "B-roll" in any language, do not translate) — cover jump cuts or visualize what's being said
- **Background music** (中文 **背景音乐**) — set mood and smooth micro-gaps
- **Captions** (中文 **字幕**) — on-screen text for accessibility
- **AI Voice Isolation** (中文 **AI 人声隔离**) — clean or isolate spoken human voice with DeepFilterNet3, picture untouched. See the \`voice-isolation\` skill.

> 用户语言为中文时，在 widget options / choices options / 对话文案里**严格使用上面括号里的产品术语**——别自己再翻译一遍，会跟产品其它地方对不上。

## What shapes the edit

Beyond picking treatments, a talking-head edit is shaped by several orthogonal variables. When the user's ask is vague, these are what's worth clarifying first:

- **Target** — platform (YouTube / TikTok / Shorts / ...), desired length, aspect ratio
- **Which treatments to apply** — the treatments above are optional; don't assume all of them apply
- **Pacing / tone** — tight / energetic / formal / casual; brand or voice preferences if stated. (For MG visual style, follow the active Motion Graphics skill/workflow.)

When more than one of these variables is missing, ask with one form after loading \`widget-forms\`. Do not ask markdown numbered questions and then append \`<choices/>\` for only one part of the same intake.

## Order of execution

When multiple treatments have been aligned with the user, they depend on each other and must be finalized in dependency order. This section is **only relevant after alignment** — it doesn't tell you what to start with on a fresh request.

The speech timing (set by A-roll editing) anchors everything downstream — MG placement, B-roll cut-covers, music duration, and caption sync all reference the final speech timeline.

So: finalize A-roll editing before committing any visual, audio, or text layer. Don't write captions against pre-edit speech, don't cut music to pre-edit length, don't place MG against timing that will shift.

**You must confirm the result with the user after each major step before starting the next**, unless the user has explicitly asked to run end-to-end without stopping. Key checkpoints when multiple treatments apply: after A-roll editing finalizes the speech timing; before MG generation (confirm style and direction, and, when it isn't obvious, whether it sits over the video as an overlay or takes the whole frame); after MG generation; same pattern for B-roll, music, and captions. **Don't bundle multiple checkpoints into one response — confirm each step separately.** An upstream mistake forces redoing everything downstream (e.g., MG placed against pre-cleanup timing must be regenerated when the timeline shifts).

---

## A-roll editing

### Scenario

In a talking-head workflow, the first step is usually A-roll editing: editing the original spoken footage.

A-roll edits are ultimately applied to the timeline and change what the viewer actually hears and sees. However, the editing decisions should usually start from the transcript, because the core question is: what spoken content should the viewer hear, and what should be removed, compressed, or reordered?

### Common A-roll tasks

A-roll editing is not only cleanup. First decide what spoken-content task the user is asking for, then choose the editing strategy and tools.

Common tasks:

- **Cleanup** — remove mistakes, repeated attempts, verbal habits, filler words, and meaningless pauses so the speech becomes clearer and more natural.
- **Highlight extraction** — pull the most valuable, opinionated, emotional, or topic-relevant moments from longer footage.
- **Restructure** — reorder spoken content, such as moving the conclusion earlier, grouping by topic, or combining scattered parts into a clearer structure.
- **Hook / short version** — use a strong claim, result, conflict, or question from the source as the opening, or compress long content into a shorter version.
- **Target-script / script alignment** — match, keep, and reorder spoken content according to a user-provided target script, target paragraph, or desired content.

Cleanup is the most common task and the one most likely to fail from bad boundary decisions. It is described in detail below. Other tasks get shorter rules, but still follow the shared A-roll principles: complete meaning, clear boundaries, and natural listening flow.

### Shared A-roll principles

These principles apply to all A-roll tasks, not only cleanup.

- **Decide the task before choosing the tool.** Do not let tool availability change the editing strategy.
- **Edit by complete semantic units.** Whenever possible, move/delete/keep complete sentences, complete ideas, complete answers, or complete steps. Do not cut out a half-sentence just because a few words match.
- **When the task names what to keep, trim to that boundary.** The inverse of the rule above, for any task that specifies which content to keep — restoring a specific sentence, matching a target script, pulling a named highlight, building a version: keep exactly the requested span. Trim the kept range to start and end at the requested words and drop the off-script head/tail of the source \`[sN]\` segment it sits in; keeping a whole segment for one requested sentence is over-keeping that drags in unrequested speech. This applies only when the task names what to keep — never to open-ended cleanup, where you keep complete units (above).
- **Do not stitch unfinished fragments across retakes.** Do not combine incomplete pieces from different attempts into one artificial sentence. This does not make the earlier attempt disposable: keep a complete useful lead-in, setup, contrast, category, evaluation, or context if it is not repeated later and can naturally connect to the later complete retake.
- **Preserve connective tissue.** List labels, contrast words, subjects, verbs, and adjacent source words are not filler when removing them makes a kept idea ungrammatical, abrupt, or misleading. Trim the smallest span that keeps the line speakable.
- **Keep listening flow natural.** The result should still have natural phrasing and breathing room. Do not make sentences feel glued together just to make them "clean."
- **Be conservative when boundaries are uncertain.** If unsure whether a cut harms meaning, logic, or listening flow, keep it or make a smaller cut.
- **Confirm complex changes first.** For complex restructuring, aggressive shortening, structural changes, or generated hooks, confirm target length, structure direction, and what to preserve with the user before editing.
- **Explain content, never indices.** You MUST NOT explain edits to the user with internal addresses such as \`[sN]\`, \`[cN]\`, \`[gap]\`, word indices, clip ids, or segment ids. The user cannot see those addresses and will not understand what they mean. Use the actual spoken content, a short quote, or a plain-language description of the edit.
- **Never name a screen position for a panel.** When you invite the user to review or fine-tune the result, call it "the Transcript panel" (中文「文字稿面板」) — never a direction (left / right / side / 左侧 / 右侧). The layout is rearrangeable and the panel does not sit in a fixed corner.

### Cleanup goals and decisions

#### What good cleanup means

Good cleanup does not mean making the video as short as possible, and it does not mean rewriting the speaker into a different script.

Good cleanup means:

- The logic stays coherent
- The expression becomes clearer
- The audio feels natural
- Obvious mistakes, repeated attempts, meaningless stalls, and filler are removed
- The speaker's intent, tone, and natural rhythm are preserved

Bad cleanup usually falls into two failure modes:

- Under-cleaning: obvious mistakes, repetition, long pauses, or filler remain.
- Over-cleaning: sentences are cut off, meaning is missing, rhythm becomes too hard, or the result sounds stitched together.

Default principle: remove defects without changing meaning; make speech smoother, not harder; prefer small local cuts over whole-sentence or whole-segment deletion; when unsure whether a cut harms meaning, keep it.

#### How to judge common cleanup cases

Below are the common cleanup categories and how to make editing decisions for each.

##### Meaningless filler words

Fillers fall into two categories.

The first category is clearly meaningless hesitation sounds. These are usually safe to remove:

- \`um\`
- \`uh\`
- \`er\`
- \`ah\`
- \`呃\`
- \`额\`

When they do not carry special meaning, use \`clean_script\` first for bulk cleanup.

The second category depends on context and must not be removed by word list alone:

- \`so\`
- \`like\`
- \`然后\`
- \`就是\`
- \`嗯\`
- \`啊\`
- \`那个\`
- \`那\`
- \`对\`
- \`所以\`
- \`但是\`

How to decide:

- If the word is only hesitation or padding, remove it.
- If it carries sequence, continuation, contrast, cause, reference, response, emphasis, or natural tone, keep it.
- If removing it makes the surrounding words sound hard-spliced, keep it or only compress the pause.
- If unsure, keep it.

Examples:

- \`um, I think this solves the main problem\` -> remove \`um\`.
- \`It works like a checklist\` -> keep \`like\`; it is a comparison.
- \`The upload failed, so we retried it\` -> keep \`so\`; it carries cause/result.
- \`right after the call, send the recap\` -> keep \`right\`; it modifies timing.
- \`然后我们再看第二点\` -> keep \`然后\`; it marks sequence.

##### Retakes and repeated attempts

A retake is when the speaker retries the same intended idea because they misspoke, got stuck, forgot words, or restarted. Retake cleanup is not "delete repeated text." The goal is to keep one complete, natural, logically coherent version of the intended idea.

Use this decision path:

1. Decide whether it is really a retake.
   Treat it as a retake only when multiple attempts are trying to say the same intended idea. Do not treat it as a normal retake when the repetition is intentional emphasis, a rhetorical beat, a structural marker, or a second pass that adds new information or tone.
2. Define the complete version to keep.
   A complete version may include more than the main content sentence. It may need a lead-in, connector, section marker, topic setup, contrast, qualifier, subject, object, or conclusion. These are not filler when the kept content depends on them.
3. Cut only the failed or covered part.
   Remove only words that are wrong, dangling, abandoned, or fully covered by the kept version. The cut boundary starts at the repeated or failed idea, not automatically at the earlier transition, setup, or continuous speech. If earlier speech contains useful context that the kept version does not repeat, keep it.
4. Choose the best complete attempt.
   If several attempts are complete, usually prefer the later one because it is often closer to the speaker's intended take. But do not choose the last attempt mechanically. If the later attempt is missing needed context, structure, subject, object, or conclusion, keep the more complete version or preserve the missing lead-in from the earlier attempt.

A repeated lead-in is redundant only when another equivalent lead-in remains naturally connected to the kept content. If removing every copy makes the result lose structure or sound abrupt, keep one natural copy and remove only the extra restarts. Do not stitch unfinished fragments from different attempts into one artificial sentence.

Examples are patterns, not a closed list:

- Local false start inside a kept sentence:
  \`There, there's no After Effects, no Premiere, no DaVinci Resolve learning.\`
  Keep the complete sentence, but remove the abandoned restart:
  \`There's no After Effects, no Premiere, no DaVinci Resolve learning.\`
  Do not keep the stray first word just because the full sentence is otherwise useful.
- Repeated structural lead-in:
  \`And secondly, ... and secondly, we're introducing a brand new UI.\`
  Remove the extra restart, but keep one natural lead-in attached to the kept content:
  \`And secondly, we're introducing a brand new UI.\`
  Do not delete every structural marker and leave only:
  \`We're introducing a brand new UI.\`
- Useful setup before a failed ending:
  \`Then the next one is different from comedy. It is popular on Disney Plus. It is called...\`
  Later retake:
  \`It is a popular Disney Plus show called Love Story.\`
  Keep useful setup that the later retake does not repeat, and cut from the failure point:
  \`Then the next one is different from comedy. It is a popular Disney Plus show called Love Story.\`

##### False starts and unfinished fragments

Use \`false starts / unfinished fragments\` for this category. \`False start\` is the more natural editing/transcription term for a speaker beginning a phrase and then restarting or abandoning it; \`unfinished fragment\` makes the dangling half-sentence case explicit.

Only remove a fragment when it clearly does not form useful information.

Safe to remove:

- The speaker abandons the thought and a complete version appears later.
- The segment is only a dangling phrase, such as "this is actually..." with no completion.
- It is clearly the leftover beginning of a failed attempt.

Do not remove:

- A sentence that is imperfect but contains useful information.
- A lead-in that provides the subject, object, or context needed later.
- Content that provides setup, contrast, conclusion, emotion, or tone.

If only part of a sentence or segment is wrong, do not delete the useful content around it. Remove only the bad word, phrase, or pause; if a local cut cannot sound natural, keep the segment.

##### Pauses and breaths

Pause cleanup should default to compression, not zeroing out. Spoken video needs natural breathing room.

Default rules:

- Obvious long pauses over 0.8-1s: usually compress to about 0.3s.
- Between sentences: keep about 0.3-0.5s so listeners can hear natural phrasing.
- Around topic shifts, contrast, or emphasis: keep slightly longer pauses when needed; do not make the delivery too rushed.
- Short breaths inside one sentence: if they are normal breathing, do not remove them.
- Clear long pauses inside one sentence: compress them, but not so tightly that adjacent words sound glued together.
- Long pauses before a retake: if the failed attempts around it are removed, remove the pause with them.
- If the user provides explicit thresholds, follow them. For example, if the user says "only process pauses over 0.8s and keep at least 0.3s", do not process natural pauses under 0.8s.

How to operate on pauses:

- For batch pause cleanup across the timeline or track, use \`clean_script\`. This is the default path for compressing many long pauses.
- Translate common user wording into \`clean_script\` pause rules:
  - "Tighter breaths" / "compress pauses" / "compress anything over 0.3s to 0.3s" → \`silence: "compress:300"\` (or the requested cap).
  - "Restore some breathing room" / "do not make it too rushed" / "keep at least 0.5s" → \`silence: "restore:500"\` (or the requested minimum).
  - "Make all pauses around 0.5s" → \`silence: "normalize:500"\`.
  - "Keep pauses between 0.3s and 0.8s" → \`silence: "range:300-800"\`.
    Any rule that makes a pause longer — \`restore\`, \`normalize\`, or the lower bound in \`range\` — never invents new silence. It only recovers pause time that already existed at that exact spot in the original recording. If the original pause was shorter than the requested value, it stops at the original pause length.
- You do not need to call \`read_script({ showSilence: true })\` before batch pause cleanup. By default, \`timeline.md\` hides silence markers, but \`clean_script\` can still detect and rewrite silences internally.
- Use \`read_script({ showSilence: true })\` only when you need to inspect or manually adjust a specific pause. Then edit the visible marker: \`~~[silence=0.8s]~~\` to fully cut it, \`[silence=0.8s→0.2s]\` to compress it, or leave it untouched to keep it.
- After semantic edits, review the final clean \`timeline.md\`. If the final pacing still has many long pauses, run \`clean_script only="silence"\`; if only one or two pauses feel wrong, use \`showSilence: true\` and adjust those manually.

Script gap primitive note:

- Do not create an accidental \`[gap]\` on the primary video track as a pacing pause. A Script \`[gap]\` means no source is playing; on the only visible video track it renders as black. If pacing needs breathing room, preserve or restore source silence with \`clean_script\` / \`[silence=...]\`, cover the moment with B-roll/MG/a full-frame visual beat, or intentionally declare the black beat in the plan.

### Other A-roll task guidance

#### Highlight extraction

Highlight extraction is not about making the content as short as possible. It is about selecting the most valuable spoken content according to the user's criteria.

Rules:

- First identify the highlight standard: opinion, conclusion, story, emotion, conflict, tutorial step, data point, or a specific topic.
- Each highlight should be understandable on its own. Do not remove the subject, setup, question, or conclusion needed to understand it.
- Do not keep only a short punchy sentence if the surrounding context is required for it to make sense.
- If the user asks for a specific topic, remove other topics. If the user asks for the "best" or "most exciting" moments, prioritize information density and expression strength.
- After extracting highlights, usually clean up the kept segments so the final result is polished.

#### Restructure

Restructure means changing the order of spoken content. It does not mean freely breaking sentences apart.

Rules:

- First confirm the target structure: chronological, by topic, by question, conclusion-first, tutorial steps, or short-form pacing.
- Move complete semantic units: complete sentences, ideas, answers, or steps.
- Do not split one sentence so the first half appears in one place and the second half elsewhere.
- After moving content, check whether connectors still work, such as "so," "but," "next," or "this."
- If the user asks for major restructuring without specifying the target structure, confirm before editing.

#### Hook / short version

Hook / short version work aims to make the opening more compelling or compress long content into a shorter but still complete version.

Rules:

- Prefer pulling the hook from the original footage: a strong claim, result, conflict, question, counterintuitive statement, or emotionally strong moment.
- If a new hook or new narration must be generated, confirm the direction with the user first.
- For short versions, do not cut only by duration. First identify the main line to preserve: problem, core point, key reasons, and conclusion.
- Short versions can remove examples, repetition, and setup, but must keep the logic needed for the point to hold.
- If the user gives a target duration, try to match it. If duration and semantic completeness conflict, explain the tradeoff.

#### Target-script / script alignment

Target-script / script alignment means cutting the final spoken content according to a user-provided script, target paragraph, or desired content.

Rules:

- The target script is the main constraint: prioritize content that matches the target meaning.
- Natural spoken paraphrases are acceptable, but do not include surrounding content that the target does not ask for.
- If the source has multiple similar versions, choose the most complete, natural, and target-aligned version.
- If target order differs from source order, reorder as needed, but move complete semantic units.
- If the target script omits source context, follow the target. Do not add long surrounding context unless the result would be incomprehensible without it.

#### Building versions, highlights, and excerpts — stay on Script

Highlight, short version, excerpt, hook, restructure, and making several versions are all transcript-content tasks: drive them through Script (\`read_script\` → edit \`timeline.md\` → \`apply_script\`), never by looking up timestamps and placing source clips manually.

- Pick the starting point by where the content comes from. Versions on the current timeline: trim or reorder \`timeline.md\` and \`apply_script\`. A version on its own timeline (the user asked for separate timelines, or wants each version independently editable/exportable): \`manage_timelines\` action=duplicate — the copy carries the content and its script, so you immediately \`read_script\` → trim → \`apply_script\` on it. Building fresh from library assets: \`manage_timelines\` action=create, add the source asset, then drive it through Script.
- To bring in source content the current cut no longer shows (a hook line, a segment needed for another version), read \`library/<filename>.md\`, copy the needed \`[sN]\` line(s) into \`timeline.md\` where they belong, and \`apply_script\`. This is how you pull source content onto the timeline — through Script.
- For multiple versions on one track: list every version's \`[sN]\` segments in \`timeline.md\` in version order, one version after another, then \`apply_script\` once. Reuse is just repetition — the same \`[sN]\` segment may appear in more than one version, and repeating the line replays that source range again.
- Never look up timestamps with \`find_transcript\` and place spoken content with \`edit_item\` / \`split_item\`. If you are converting transcript segments into source frame or second ranges, you are off the editing surface — return to Script. \`edit_item\` / \`find_transcript\` are only for non-transcript placement such as MG overlays and B-roll visual timing.

**Check each version against its request.** After assembling a version, highlight, or excerpt, re-read the result end to end and confirm every requested sentence is present, in the requested order, with no extra source carried in. Fix any dropped, duplicated, or out-of-order content before finishing.

### A-roll / transcript-based editing workflow

Use this flow for any A-roll task driven by transcript meaning.

1. Start with orientation. Call \`read_script\`, then read \`timeline.md\` once to understand the user's goal, the content structure, and whether fixed fillers or long pauses are present. If you will run \`clean_script\`, do not build the full semantic edit from this pre-clean read.
2. For cleanup tasks, run the mechanical cleanup pass before semantic editing when fixed fillers or long pauses are present. Use \`clean_script\` for fixed hesitation sounds (\`um\`, \`uh\`, \`er\`, \`ah\`, \`呃\`, \`额\`) and batch pause compression. If both are present, use the default \`clean_script\` pass so both are handled together. Do not use this step for context-dependent fillers, retakes, repeated sentences, or anything that needs meaning.
3. After \`clean_script\`, always read the refreshed clean \`timeline.md\` before semantic editing. Use this refreshed file as the source of truth; \`clean_script\` changes the canonical timeline and rematerializes the script, so previously read text may be stale. Do not edit from memory based on the pre-clean script. Then edit \`timeline.md\` with semantic judgment: choose the best retake, clean false starts, remove repeated or failed attempts, preserve useful setup and context, reorder content when needed, and keep the speech natural. For long transcripts, work one clear section at a time if that improves judgment accuracy.
4. Apply the edit with \`apply_script\`. If apply fails, fix the markdown error or stale state, re-read the current \`timeline.md\` if needed, and apply again.
5. Review the edited result. After a real \`apply_script\`, read the regenerated clean \`timeline.md\` and check what the viewer will actually hear: broken logic, missing context, over-deletion, missed cleanup, wrong order, or pauses that feel too tight or too long. Fix clear problems only. If the final result still needs batch pause adjustment, use \`clean_script only="silence"\`. Use \`read_script({ showSilence: true })\` only for manual adjustment of specific pauses.

### What transcript editing actually changes

Editing \`timeline.md\` is not just changing displayed text. It describes which source media ranges should play on the timeline.

\`[sN]\` rows are ASR segments, not semantic units. A complete sentence, idea, retake, or transition may span several \`[sN]\` rows, and one \`[sN]\` row may contain only part of a sentence. Before deciding what to delete or keep, mentally reconstruct the complete spoken sentence or idea across adjacent rows.

- Each spoken-text line maps to a playable source range.
- Inline \`~~...~~\` removes the corresponding audible audio range.
- Deleting a whole line removes that whole spoken segment.
- Moving/reordering lines changes playback order.
- \`apply_script\` applies the result back to the timeline.
- Start/end trims may remain as one trimmed clip.
- Deleting words or pauses in the middle of a sentence splits the original clip into multiple new clips: one kept range before the deletion and one kept range after it.
- Moving spoken content also creates a new clip at the destination.
- More clips after middle deletions or moves are expected and usually correct. Do not describe that as a "fragmentation problem" or as proof that word deletion is unsupported.

### Tool boundaries

Choose the editing goal and content boundaries first, then choose the tool. Do not let tool availability change the editing strategy.

- \`clean_script\`: use for mechanical first-pass cleanup: bulk removal of fixed meaningless fillers and batch silence compression/adjustment. It can process silence even when \`timeline.md\` is currently rendered without silence markers. Do not use it for context-dependent fillers, retakes, repeated sentences, or semantic decisions.
- \`read_script\` + \`apply_script\`: the main transcript-based editing surface. Use it for real semantic editing: deleting words, sentences, pauses, reordering, or pulling library content onto the timeline.
- \`manage_transcript\` action \`fix\`: only fixes ASR mistakes or speaker attribution. It does not cut audio and does not change what the viewer hears.
- Caption SEGMENTATION (分句 / where pages break) is INDEPENDENT of the transcript and controlled by two per-word primitives only: to SPLIT one card into two, set \`display_text\` \`forcePageBreak:true\` on the word that should START the new card; to MERGE a card up into the previous one, set \`display_text\` \`keepWithPrevious:true\` on that card's FIRST word (works for any break — no box resizing, no wordsPerPage fiddling). To drop a repeated/false-start word, use \`display_text\` \`hidden:true\`. Box width / fontSize / \`wordsPerPage\` are style & density knobs, NOT per-boundary segmentation levers — do not widen the box or raise wordsPerPage to merge or split a specific card. NEVER edit the transcript to fix a caption line break — \`manage_transcript fix\` is only for an ASR-misheard WORD (content), not layout. \`read_captions\` shows each page's \`break=\` reason and per-word keys for these edits.
- \`find_transcript\`: only locates when a phrase is spoken. It does not edit. If the next step is cutting spoken content, return to Script.
- \`Edit\` / \`Write\`: use these to modify \`timeline.md\`. The edit only reaches the timeline after \`apply_script\`.

Script details to preserve:

- \`read_script\` materializes \`timeline.md\` (current cut) and \`library/<filename>.md\` (full read-only source transcripts) in the workspace.
- Single-word audible deletion is supported with inline strike syntax, such as \`[s1] 过去~~呢~~一个月\`.
- Silence markers are hidden by default. Use \`clean_script\` for batch pause cleanup. Use \`read_script({ showSilence: true })\` only to expose \`[silence=Ns]\` markers for precise manual edits such as \`~~[silence=0.8s]~~\` or \`[silence=0.8s→0.2s]\`.
- \`find_transcript\` can locate a phrase for visual timing; it is not the editing surface. Do not use \`find_transcript\` + \`split_item\` / \`edit_item\` to cut, place, or assemble transcript-based clips — this includes highlights, hooks, excerpts, and multi-version cuts. All spoken-content selection, placement, and reuse happens in Script (\`read_script\` → edit \`timeline.md\` → \`apply_script\`).

---

## MG Overlay

### Goal

Motion graphics layered into A-roll reinforce what the speaker is conveying — deepening the audience's impression of the key points and helping them grasp content that's hard to land through speech alone. Complete A-roll editing first; MG timing is based on the post-edit timeline.

This section only adds talking-head timing, frame-composition, subject/caption protection, and review constraints. For visual style alignment, MG creation or authoring, implementation constraints, editable properties, asset sizing, and verification, use the active Motion Graphics skill/workflow available in the current OpenChatCut environment.

### MG workflow

For talking-head MG work, treat the video as one edited piece, not as isolated graphics.

1. **Understand the video** — read the transcript and representative frames to learn topic, audience / platform, visual tone, and speaker layout.
2. **Set the visual language** — use the active Design Style, the user's style / reference, a clarified direction, or visual presets from the active MG workflow.
3. **Choose useful MG moments** — add MG only where a visual layer improves comprehension, emphasis, orientation, or pacing.
4. **Prepare each moment** — decide the viewer job, content, visual mechanism, speech span, settled frame, read time, form, background, and composition relationship before creating the MG.
5. **Create through the active MG workflow** — pass the talking-head context into the current environment's MG creation/authoring path. Different viewer jobs, information structures, or visual forms should usually become distinct MGs; reuse only intentionally recurring components.
6. **Place, review, confirm, then extend** — check face, captions, readability, size, and composition. After the first real MG is placed in frame, confirm the effect with the user before expanding, unless they explicitly asked you to finish end-to-end.

### Visual identity

Design Style is the video's confirmed visual language. It gives MGs a shared tone, color logic, typography logic, visual density, and motion language. It keeps different MGs in one family without forcing them into the same shape. It does not decide which MGs are useful, when they appear, where they sit, or whether they are transparent / opaque; those remain per-MG editing decisions.

Resolve the visual language before planning MG moments. Use the active MG workflow for the actual style-alignment interaction and implementation details:

- **Active Design Style** — use it unless the user asks to change the overall style. If Project Context names an active Design Style but does not show details, inspect it once with \`manage_design_style action="get"\` before planning MG moments.
- **Specific user style / reference** — follow it. If it is custom and not yet confirmed for a batch, use a real planned MG as the sample when the user needs to approve the look.
- **Generic or vague direction** — quality words such as clean, premium, modern, professional, polished, or YouTube-style emphasis are goals, not a visual language. Follow the active MG workflow's style-alignment gate: prefer visual preset options, or use one representative MG for confirmation when the direction is textual / custom.
- **No visual direction** — use the active MG workflow to show relevant visual preset options. Talking-head can be used as a catalog filter when available.
- **"Directly do" / "don't ask"** — choose a concrete temporary direction from the transcript and footage, then continue without user style confirmation. Do not create or update a Design Style from this unconfirmed guess.

Picker is a visual Design Style selector. It shows preset thumbnails so the user can choose a visual direction by sight, instead of describing style in words.

1. Call \`manage_design_style\` with \`action: "list"\`. The catalog returns \`presetId\`, \`name\`, and a style summary (no scenario filter or thumbnails in this build); shortlist reasonable options by name/summary and the actual video context.
2. Render the shortlisted presets as concise numbered options via the form/widget route (name + one-line summary; this build has no preset thumbnails).
3. The picker is a turn boundary: after showing it, stop and wait for the user's submitted selection.
4. When the user picks an option, call \`manage_design_style\` with \`action: "apply"\` and the selected \`presetId\`, then inspect the applied Design Style with \`action: "get"\` before authoring.
5. If the user responds with text instead of picking, treat it as user direction and continue with the custom direction path.

Persist only confirmed visual language:

- **Picked preset** — the user confirmed it by choosing the visual option. Call \`manage_design_style action="apply"\`.
- **Custom direction** — after the user accepts the sample, treat it as the confirmed direction for the current MG work. If the current environment supports saving project Design Styles and the user accepts it as the shared project style, save/apply it with the agreed style facts.
- **Unconfirmed guess** — do not create or update a Design Style, including when the user said "directly do it".

After applying a preset or confirming a custom direction as the project style, tell the user in one or two natural sentences that this is now the video's visual style, future MGs in this video will follow it by default, and it can be changed or adjusted later.

### Where MG is useful

MG meaningfully helps comprehension or orientation when the content has:

- **Identity / context labels** — speaker name, role, product name, date, source, or a small persistent section label.
- **Key information / quotes** — a core concept, definition, statistic, conclusion, or key sentence worth emphasizing.
- **Structured information** — multiple points, steps, comparisons, rankings, lists, or processes.
- **Chapter / topic markers** — opening titles, section titles, topic transitions, or visual dividers between sections.
- **Abstract concepts** — cause-effect relationships, cycles, systems, frameworks, or other ideas that are hard to follow verbally.

### Repeated Components

One video should usually have one visual language, but not one universal MG shape.

Reuse a Motion Graphic asset only for intentionally recurring instances of the same component: same viewer task, same information structure, same visual form, and content changed through properties. Repeated chapter markers, recurring section labels, or a repeated status badge can share one asset. Different jobs such as an opening title, chapter marker, quote, list, diagram, and CTA should usually be separate assets that share palette, typography, motion tone, spacing, and material treatment.

An accepted first MG proves the visual language works in frame. It is not automatically a template for unrelated MGs.

### Per-MG decisions

For talking-head videos, do not start MG creation from transcript timing alone. Inspect the target frame first: transcript tells you what and when; the frame tells you form, placement, and background.

Before creating the MG, make four linked editor decisions. They prepare the active MG workflow and the later timeline placement.

| Decision               | Question                                                        | Output                                                          |
| ---------------------- | --------------------------------------------------------------- | --------------------------------------------------------------- |
| **Content**            | What idea deserves a visual layer?                              | Message or visual fact expressed by the MG.                     |
| **Timing**             | When should it land with the speech?                            | Timeline start, duration, read time, and internal motion beats. |
| **Form and placement** | What kind of MG is it, and where can it live safely?            | MG form / size, then timeline placement after asset creation.   |
| **Background**         | Is this an overlay on the talking-head shot, or its own moment? | Transparent overlay or opaque / full-screen beat.               |

#### Only for generator workflows that require a brief

Use this subsection only when the active Motion Graphics workflow explicitly asks you to write a generation brief or request for another model or generator, such as Gemini / motion-graphic-gen.

Skip this subsection for direct-authoring workflows. If you are creating or editing JSX yourself with \`create_motion_graphic_from_code\` / \`edit_asset\`, do not use \`referenceAssetIds\`, \`:template\`, \`:style\`, role anchors, or Gemini brief language.

For generator workflows, carry the visual language into the tool call. For now, templates are generation references, not direct-apply targets. Template refs from a Design Style are no different from any other template ID. For new MG assets, pass one code reference source: same-role role anchor with \`referenceAssetIds: ["<roleAnchorAssetId>:template"]\` only when the visual job, structure, and canvas role are the same; otherwise use the matched template ID directly, for example \`referenceAssetIds: ["<templateId>:style"]\`. If no template matches, write the confirmed Direction in the brief and use any accepted role anchor only for the same role. Template slot counts are not user constraints: if the user asks for more/fewer bars, rows, items, or data points than the template shows, generate a new structure instead of asking them to fit the slots.

When a template or role anchor is passed, keep the Gemini brief focused on content, role / broad form, background, and frame constraints. Let the reference carry detailed style and motion language.

Map the four shared decisions into a generator brief like this:

- **Content** -> \`Content\` in the brief.
- **Timing** -> timeline start, plus internal \`Timing\` only when the MG has its own beats. Internal \`Timing\` values say _when_ each element appears, not _how_ it moves; leave the motion style to Gemini.
- **Form and placement** -> \`Size & shape\` in the brief, not final canvas placement. Do not write final \`left\`, \`top\`, \`right\`, \`bottom\`, coordinates, or placement anchors such as "lower-left" / "top-right" into the Gemini brief.
- **Background** -> \`Background: transparent\` or \`Background: opaque\`.

#### 1. Content

Choose what the MG expresses, not just what text it repeats. The content may be a speaker identity, distilled quote, key term, statistic, list, comparison, relationship diagram, chapter marker, or another visual representation of the point.

#### 2. Timing

Choose the timeline anchor first. The MG should land with the relevant speech beat or section boundary, not trail after the speaker has already made the point. Use \`find_transcript\`; pass \`includeWordTimestamps: true\` when the MG has internal rhythm such as list items appearing one by one or multi-step reveals.

Write internal timing values relative to the MG's own start time. The timeline item start is the absolute video position; internal timing is the MG-internal rhythm after that start. Exit when the point is fully made.

#### 3. Form and placement

Choose the MG form and likely placement region before creating the asset. The active MG workflow creates the graphic; place the finished asset on the video canvas afterward.

Placement principles:

- **Protect the subject and safe zones.** Avoid the speaker's face, head, hair, glasses, mouth, chin, important products or objects, relevant hand gestures, captions/subtitles, and existing on-screen elements.
- **Keep the caption/subtitle area clear.** If captions may appear, bottom overlays must sit above the caption band, not compete with or cover subtitles.
- **Separate overlays from full-screen MGs.** Subject/safe-zone protection applies to overlays on top of A-roll. A full-screen MG is an intentional visual beat that replaces the A-roll for its duration, so it may cover the speaker and background.
- **Keep the composition intentional.** The MG should support the speaker and message. It should not look like a random sticker, compete with the face, or make the frame feel unbalanced.

Common forms and areas:

| Content type                 | Common form                                               | Common area                                                                                                                     |
| ---------------------------- | --------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| **Identity / context**       | Name tag or small context label                           | Lower-third first; lower-left or lower-right depending on the shot.                                                             |
| **Key information / quotes** | Typographic quote, pull quote, or emphasis treatment      | Lower-center / lower-third; side area if the bottom is crowded; full-screen for a major punchline, conclusion, or pause.        |
| **Structured information**   | List, step stack, comparison layout, or compact diagram   | Left/right side areas or bottom horizontal area; full-screen if the information is too dense for an overlay.                    |
| **Chapter / topic markers**  | Full-frame title, title overlay, or side title panel      | Full-screen for a strong intro or section break; lower-third for a light cue; side panel when one side has obvious open space.  |
| **Abstract concepts**        | Concept visual, relationship map, cycle, framework, chart | Lower-third if light and readable above captions; side area or full-screen if denser.                                           |
| **Tiny auxiliary labels**    | Badge, status label, logo-like mark, section marker       | Top corners can work here only. Do not use top-left/top-right as the default home for primary opening titles or chapter titles. |

Use the MG's intrinsic form constraints, not final canvas placement, when deciding asset shape. Good examples: "lower-third-style name tag", "compact side treatment", "bottom horizontal strip", "full-screen title beat". Do not bake final canvas coordinates into the asset unless the MG is intentionally full-frame.

For familiar forms like speaker name tags, give the form and content without forcing dimensions early. For constrained overlays, describe the intended rough form or usable area. For full-screen MGs, make the form explicit in **Size & shape** and choose \`Background: opaque\`.

From the target screenshot, include canvas tone only when it affects legibility: for example, \`Other context: dark interior scene — keep the design bright/light enough to read clearly.\`

#### 4. Background

Choose background from the form:

- Use \`Background: transparent\` for talking-head overlays: lower-thirds, side treatments, quote treatments, compact diagrams, and other graphics that sit over A-roll. A transparent root may still contain internal semi-transparent or solid panels.
- Use \`Background: opaque\` when the MG is its own visual surface: full-screen opening titles, strong chapter beats, full-screen information layouts, and full-screen emphasis moments.
- For full-screen opaque MGs, do not add a separate \`solid\` item underneath as a color matte. The MG owns the frame; change its \`bgColor\` / \`transparentBackground\` properties instead. Do not create temporary solid fallbacks; if you encounter an old transparent-MG-plus-solid fallback while replacing it with an opaque generated MG, delete both fallback pieces, not only the old MG.

Default to a transparent overlay unless a full-screen beat is intended — guessing full-screen/opaque silently is what covers the speaker's face or blanks the frame.

#### Place and review

- Place with \`edit_item\` (adds/updates). Prefer an explicit rectangle once you know the frame: \`left/top/width/height\` for direct placement, or \`right/bottom/width/height\` when right/bottom margins are clearer.
  - **\`left\`** — explicit x position. **\`right\`** — margin from the canvas right edge. Do not pass both.
  - **\`top\`** — explicit y position. **\`bottom\`** — margin from the canvas bottom edge, symmetric with \`right\`, e.g. \`{ right: 80, bottom: 150, width: 500, height: 350 }\` for a bottom-right overlay. Caption-safe defaults: \`bottom: 162\` (landscape 1080p) or \`bottom: 576\` (portrait 1080×1920). Do not pass both \`top\` and \`bottom\`.
- Use a natural-box asset for overlays: the MG asset \`width\` / \`height\` should tightly bound the local visible composition, not the project canvas. Place and scale that local asset on the timeline. Use timeline-sized assets only when the visible design intentionally spans the whole frame.
- Asset dimensions from \`track_progress\` / project state are practical aids for resizing and placement, not the final judge.
- Verify with screenshots. Pass multiple frames in one tool call — settled state appears alongside any transient mid-animation frames. **Compare frames before concluding**: apparent truncation, missing elements, or "broken design" visible in only some of the batch is animation, not a real flaw. If unclear, re-capture more frames around the suspect one before adjusting anything. Judge from the settled frames. For multiple placed MGs, batch their settled frames into a single call.
- Check the full frame: face/head is clear, important objects and gestures are clear, caption zone is clear when relevant, MG is fully visible, MG content is correct, text is legible, no readable text overlaps, and the composition feels balanced and intentional.
- If it fails, first adjust position and size. If position/size cannot make it work, edit the asset or change the design form. Verify each intentionally recurring component on a target frame before expanding it.

---

## B-roll

### Goal

Enrich visual layers and cover jump cuts left by A-roll editing.

### Where B-roll is useful

- **Cover jump cuts** — when A-roll editing leaves visible jump cuts the user wants to hide
- **Visualize specific references** — when the speaker mentions objects or scenes that benefit from showing

B-roll depends on having suitable footage and adds production effort — treat it as an optional enhancement, not a default. Apply only when the user opts in or there's a clear visual problem to solve.

### Sources

Footage can come from three places: clips already in the project library, stock via \`search_stock_media\` then \`push_asset\` with the returned import args, or AI generation via the \`video-gen\` skill (Seedance / Kling / Hailuo when configured). Pick based on the user's need; if unclear, align with the user upfront.

### How to place

Don't cut away in the first or last 3 seconds. For dense jump cuts (<3s apart), use one long cutaway covering multiple. Don't overlap with MG by default.

First decide the B-roll mode:

- **Full-screen cutaway** replaces the talking head for that moment. Use it when the user asks to show the B-roll full screen, cover jump cuts, or the B-roll needs the full frame to be readable.
- **PiP / small-window overlay** keeps the talking head visible. Use it when the user asks for overlay/PiP, the existing edit style clearly uses small-window B-roll, the user says the talking head can remain visible, or the B-roll is a quick supporting visual.

If the user only says "add B-roll" and the mode is not implied by the existing edit, ask once: "Should these be full-screen cutaways or small rounded-corner PiP overlays?"

For **PiP / small-window overlay**:

1. Inspect the target timeline frame first. Compare candidate destination rectangles in the actual shot. Exclude areas that would cover the A-roll's face/head, mouth, important gestures, captions/subtitles, existing overlays, products/logos, or other visible subjects. Among safe candidates, choose a rectangle that can show the B-roll at a useful readable size, preferring the largest blank or low-information area while keeping the composition balanced.
2. Inspect the B-roll source frame(s). Identify the primary subject/action, protected information, and safe-to-lose areas. Any readable text/UI, name/title, logo, brand strip, product edge, card, poster, or document boundary is protected by default unless the user explicitly approves losing that exact information.
3. Place the overlay at a useful size inside the chosen destination rectangle. Keep the B-roll's protected information visible/readable and the A-roll's protected content unobstructed. Do not default to a fixed corner or lower-third position when another candidate has more usable empty area.
4. Set the media item's native \`borderRadius\` to 24-36 by default unless the requested style is square/sharp. Do not add a mask/effect solely for ordinary rounded PiP corners; use effects only for special shapes or item types that cannot use native \`borderRadius\`.
5. Screenshot the affected frame before reporting success. If the only non-obstructive PiP would be too small to understand, switch to full-screen cutaway, choose a different source moment/asset, or ask the user to choose the trade-off.

For **full-screen cutaway**:

1. Compare the source aspect ratio with the canvas aspect ratio before choosing fit; do not default to cover without this check. For close aspect ratios, such as portrait source into portrait canvas or landscape into landscape with less than about 30% difference, use a full-canvas \`fit:"cover"\` first-pass so the B-roll owns the visual beat.
2. For substantially different aspect ratios, such as landscape media in a vertical canvas or vertical media in a landscape canvas, do not place directly with cover. Inspect the source with \`view_asset_frames\` before choosing fit if you have not already viewed it. Use \`read_script\` to choose representative video moments and sample more frames with \`view_asset_frames\` when the protected region is not obvious.
3. Identify whether protected information would be distributed across the area that cover would crop. Any readable text/UI, name/title, logo, brand strip, product edge, card, poster, document boundary, or subject on both sides of the frame is protected by default.
4. After inspection, cover or safe crop is acceptable only if protected information would survive the crop, such as a single centered subject with low-information edges. Low-information contextual media, such as scenery, crowd shots, or other mood/context footage with no specific text or subject that must be preserved, can use cover even with a substantial aspect-ratio difference.
5. If protected information would be lost, such as text/logos near edges, subjects on both sides, or a wide information layout like a fixture table or match poster, use \`fit:"contain"\` for the foreground and add a deliberate full-screen background such as an opaque MG background/matte that matches the edit or a blurred/enlarged duplicate/background layer. If a cover attempt only trims a compact subject/action that can be recovered without hiding other protected information, try a safer reframe/crop that moves the source protection frame fully into the canvas and closer to the intended center of attention.
6. Apply the fit strategy per source asset, not as a batch default. Even when the user asks for cutaways, do not batch-place multiple images or clips with \`fit:"cover"\` without checking each source's aspect ratio and protected content first.
7. Screenshot the final frame and compare it with the inspected source frame(s). Verify that the foreground still preserves the source's protected information, not just that the final canvas looks filled.

After editing, read back the exact item ids you changed. An asset appearing in the library is not proof it is on the timeline; \`read_project\` must show the new/updated B-roll items. If the result involved crop, fit, scale, overlay placement, or a full-screen composition trade-off, verify the affected frame with a screenshot or visual analysis before reporting success, then fix failed source/destination protection or state the unavoidable trade-off. Do not report success if the target items are unchanged.

---

## Multicam (multiple camera angles of the same take)

When the user has **two or more cameras recording the same moment** — cues like "both angles", "the same interview", "multi angles", "alternate angle", "cut to the other angle", "angle switch", 换角度, 两个机位 — switching to another angle means the picture changes but the **audio and lip-sync must stay matched** to the take.

**Do not hand-compute source offsets with \`edit_item\` to line angles up.** Manual offsets drift wherever the underlying reference angle was cut, and the drift only shows up later as out-of-sync lips. Use the **\`multicam_sync\`** tool instead: it runs the editor's audio-based alignment engine and repositions each angle clip so its picture matches the reference angle's audio. Pass the angle clips' \`itemIds\` (the reference plus the follower angle(s)); optionally name the \`referenceItemId\`.

Key constraint: a **single cutaway clip that spans a cut in the reference angle** can't be aligned as one piece — split it at that cut with \`split_item\` first, then pass both pieces to \`multicam_sync\` so each maps to the reference segment beneath it.

\`multicam_sync\` runs in the user's editor (no backend path): if it reports the editor isn't open, ask the user to open the project, then retry. After it applies, read the project back to confirm the alignment.

---

## Track roles (turn on auto-ducking)

A track's \`role\` is the single declaration that drives the audio mix. Set it with \`edit_track\` and the engine derives a seamless duck — followers dip under speech, then rise back in the gaps — without you hand-adjusting any volume. There are only two roles, plus off:

- The talking / interview / lecture track (and any voiceover / narration) is the **anchor**: set its \`role\` to \`anchor\`. This is the track everything else ducks under — set it, or nothing ducks.
- Background music, ambient beds, and b-roll audio beds that should sit under speech → the **follower**: set \`role: follower\` (auto-ducks under every anchor).
- Short sound effects (SFX), stingers, hits, whooshes, clicks, and other editorial accents usually stay out of ducking → leave their track role unset unless the user explicitly wants those accents tucked under speech.
- Anything that should stay out of ducking → leave its \`role\` unset (none).

A track with no role behaves exactly as today — roles are additive and safe, so you only set them where the content makes the job obvious.

**Read the existing layout first.** Before creating tracks or placing new clips, read the current track names and roles — if a track is already tagged for this content (a \`follower\` named "Music", an \`anchor\` named "VO"), put the new clip there and match its role; only make a new track when nothing fits. **Organize before you assign — roles are per-track, so aim for one role per track.** If the same kind of content is scattered across several tracks (e.g. the voice on A1 _and_ A3), consolidate it onto one track _first_: move the clips with \`edit_item\` (\`updates[].trackId\`), then delete the emptied track by id with \`edit_track\`. Then assign the role once. While you're laying tracks out, stack them the way a mixer reads a session — **voice/VO on A1, the top audio lane; music below it** — and give each a short name like "VO" or "Music" so the spoken word stays easy to find. A sensible default, not a rule; follow the user's intent when the layout should differ. Keep deliberate separation, though — two _different_ speakers, clips that overlap in time, or intentional layering each stay on their own track (and each still gets its role). After assigning, read the project back to confirm every track that should anchor/duck does, and that you left the music's base volume alone.

---

## Background Music

### Goal

Set the mood and smooth over micro-gaps in speech.

### Principles

- Set the music track's \`role\` to \`follower\` with \`edit_track\` (and the talking track's \`role\` to \`anchor\`). That single pair turns on auto-ducking — the engine dips the music under speech and lifts it back in the gaps.
- Let \`edit_track\` initialize \`audioRouting.duckDepthDb\` from the current timeline loudness when it can. Pass \`audioRouting.duckDepthDb\` yourself only when the user explicitly wants the music louder or softer under speech.
- Keep the BGM clip's base \`decibelAdjustment\` natural by default. Do not pre-duck music with a large negative clip gain, then also set manual \`duckDepthDb\`; only do both when the user explicitly asks for a lower overall bed and a stronger / weaker speech duck.
- Do not put short sound effects (SFX) or stingers on follower tracks by default. Place them at their editorial moment and adjust item volume only if they are clearly too loud or too quiet.
- No prominent lyrics
- Fade BGM in/out with \`audioFadeIn\` / \`audioFadeOut\` in seconds, usually 1-2 seconds. Do not pass frame counts to these fields.
- Tone matches content

### Fit to duration

Fit BGM to the final video extent after A-roll timing is finalized. The target duration runs from the BGM start to the real content end (video / visual / speech items), excluding the BGM itself so music never extends the render.

- Unless the user specifies a different BGM start, start BGM at frame 0.
- If generated BGM is longer than the target, place one \`audio\` item at the BGM start, set its duration to the target duration, and add a fade out. Do not let the full music asset run past the last visual item.
- If generated BGM is shorter than the target, do not stretch one audio item past the asset length; it will end in silence. Instead, tile multiple \`audio\` items until the target is covered.
- Before placing tiled BGM, calculate how many segments are needed to cover the full target duration, accounting for the planned 1-2 second overlaps. Place all segments in one pass so the whole timeline is covered, then trim the final segment to the target end.
- For tiled BGM, use alternating audio tracks (for example A2/A3) so adjacent repeats can overlap by 1-2 seconds. Fade out the earlier segment and fade in the next segment over the overlap.

### How the engine ducks music

Ducking is automatic once the music track's \`role\` is \`follower\`: the engine dips the track under audible \`anchor\` tracks (the speech / voice), and lifts it back to full level in pauses and the outro. This needs both halves — the music track has \`role: follower\` **and** the talking track has \`role: anchor\` (see Track roles above). If nothing is set to \`anchor\`, nothing ducks and the music stays at full level.

Set music to a normal, audible base level where there is no speech. To tune the dip under speech, update the follower track's \`audioRouting.duckDepthDb\`; otherwise leave it unset and let \`edit_track\` auto-initialize from timeline loudness when available. Do not solve speech clarity by heavily lowering the clip and also manually deepening the duck. To keep a track out of ducking entirely (for example a stinger that should punch through), leave its \`role\` unset (none).

---

## Captions

### Goal

Improve accessibility and engagement with on-screen text.

**Captions are transcribed from the source audio — they always match the speaker's language. Translation between languages is not supported.** Don't ask the user what language they want captions in; pick the preset by source audio language + target aspect ratio.

### Presets

Use only built-in \`edit_captions\` preset names. There is no \`youtube\` or \`vox\` caption preset; platform names describe the target video, not a preset name.

| Source audio language | Aspect Ratio   | Recommended Preset |
| --------------------- | -------------- | ------------------ |
| English               | Portrait 9:16  | tiktok or submagic |
| English               | Landscape 16:9 | studio or submagic |
| Chinese               | Any            | netflix            |
`,T='---\nname: transcription\ndescription: Use when a video/audio task needs OpenChatCut transcription, captions, subtitles, subtitle styling, transcript search, transcript readiness checks, or enabling captions, including local or attached videos where the user asks to add captions/subtitles, transcribe, create bilingual subtitles, clean talking-head speech, remove filler words, or trim pauses.\n---\n\n# Transcription\n\nFor newly imported local/client-held media, use `import_media` to start transcription, then wait with `track_progress`.\n\nTypical flow:\n\n1. `read_project` with `view: "assets"` to get the video/audio asset ID and transcript status.\n2. If this is a fresh client-held import, make sure it went through `import_media action=create_session` plus the OpenChatCut media import helper.\n3. Call `track_progress` with `action:"wait"`, `target:"transcription"`, and `assetIds` set to the asset ID or prefix.\n4. Use `find_transcript` to search transcript text and confirm word timestamps.\n5. Use `edit_captions` action `enable` or `read_captions` as needed once transcription is ready.\n\nExample:\n\n```json\n{\n  "action": "wait",\n  "target": "transcription",\n  "assetIds": "13c1aa02cd"\n}\n```\n\nUploaded assets start ASR automatically on ingest, but nothing waits for it. Always use `track_progress` for readiness.\n\nFor local-only video assets with `local-only; original upload deferred` in `read_project`, transcription cannot run until the bytes are reachable by the backend. Import the source again via the `asset-import` skill (which uploads to S3) or `download_media` from a public URL; do not ask the user to relink it manually in the editor.\n\n## Stuck Transcription And Retry\n\nDo not declare transcription stuck from one non-terminal status. Base the decision on both asset length and the time the agent has actually waited in this task.\n\n1. Read the asset with `read_project` `view: "assets"` and note its duration when available.\n2. Start counting elapsed wait time from the first `track_progress` `action:"wait"` or from the earliest reliable in-task timestamp where the agent observed transcription as pending/running.\n3. If transcription reports an explicit failed, errored, or timed-out terminal state, retry immediately after confirming the asset is remote-ready and is video/audio.\n4. If transcription remains pending/running with no failure, treat it as stuck only after elapsed wait time exceeds `max(5 minutes, min(60 minutes, 2 × asset duration))`. For example, wait at least 5 minutes for a 30-second clip, about 20 minutes for a 10-minute asset, and about 60 minutes for a 1-hour or longer asset.\n5. If duration is unknown, wait at least 10 minutes across more than one `track_progress` call before treating it as stuck, unless the tool reports an explicit failure.\n\nWhen stuck, use `manage_transcript` with `action: "retry_transcription"` and the asset id/prefix. This force-retries ASR for audio/video assets and starts a new transcription run; it does not wait for completion. After retrying, call `track_progress` with `target:"transcription"`, `action:"wait"`, and the returned or same asset id before reading transcripts or captions.\n\nExample retry:\n\n```json\n{\n  "action": "retry_transcription",\n  "asset": "13c1aa02cd"\n}\n```\n\nIf captions read back as empty, check the source-time range of the timeline clip. A transcript can be ready while the current visible clip starts before the first spoken word; add or trim a clip so the transcribed source words fall inside the timeline range, then extend/update the captions item duration if needed.\n\nUse the raw tools when you need finer control:\n\n- `track_progress` with `target: "transcription"` for status/wait.\n- `find_transcript` for query-based transcript lookup.\n- `read_captions` and `edit_captions` for caption display edits.\n- `manage_transcript` action `fix` for source transcript repair.\n- `manage_transcript` action `retry_transcription` to force-retry ASR after a transcription is stuck, timed out, or failed.\n- `clean_script` for mechanical timeline playback cleanup of fixed fillers and batch pauses after transcript-ready media is on the timeline.\n\nWhen a transcript-ready request becomes an editorial talking-head edit, follow the public-safe talking-head workflow in shared `talking-head-guide`. In short: use `clean_script` only for mechanical cleanup, then use Script (`read_script` -> edit `timeline.md` -> `apply_script`) for semantic repeated-take, silence, filler, or coherence edits, and verify the resulting script rather than trusting tool success alone.\n',E=`---
name: verification
description: Use when checking whether agent edits are reflected in the OpenChatCut project and editor.
---

# Verification

Use the lowest verification level that proves the requested result:

| Level | Required evidence |
|---|---|
| L0 | Static checks such as the focused verification script, \`npx tsc --noEmit\`, tests, and build. |
| L1 | A real Agent run against the editor at \`localhost:5199\`, followed by structural and rendered evidence. |
| L2 | The packaged desktop app completing the user scenario, including human visual review where automation is insufficient. |

Runtime behavior changes require L0 + L1. Release and desktop-only changes also
require L2 when the packaged app is the behavior under test.

Prefer two signals:

1. \`read_project\` for structure: assets, tracks, items, frame placement, timeline duration.
2. A visual capture path for rendered evidence at exact frames.

Use \`view_timeline_frames\` for composed timeline proof. This verifies the edited OpenChatCut timeline: trims, layers, captions, effects,
markers, placeholders, crops, transitions, and layout.

For raw source-asset frame inspection, choose the cheapest path based on where
the bytes live:

- The agent in this build has no local filesystem access; all source bytes live
  in the project media store (\`/media/uploads/\`). Use \`view_asset_frames\` with
  the project asset id — the server takes an ffmpeg contact-sheet fast path
  automatically, so it is already the cheapest source-frame route.
- \`view_timeline_frames\` renders the composed timeline (the editor-truth check);
  \`view_asset_frames\` samples raw source frames. Pick by what you are verifying.
- There is no separate \`get_contact_sheet\` tool in this build — the contact
  sheet is what \`view_asset_frames\` / \`view_timeline_frames\` already return.

Use local/remote source-frame artifacts only for source understanding, moment
selection, and rough trim decisions, not as edited output or timeline proof.

For local-only or upload-in-progress media, composed timeline proof may be
blocked until the asset has bytes available to the renderer. Source-frame
inspection via \`view_asset_frames\` still works as long as the asset's bytes are
on disk (\`/media/uploads/\`).

If both visual proof paths are blocked, ask the user to inspect the OpenChatCut
editor directly and note the blocker explicitly.

Useful checks:

- After import: \`read_project({ "view": "assets", "assetId": "<prefix>" })\`
- After move/trim: \`read_project({ "view": "timeline" })\`
- After visual overlay or MG on any timeline media: \`view_timeline_frames({ "frames": [30, 45, 75] })\`, then look at the returned frames.
- For user-requested source selection or visual moment picking: sample stills with \`view_asset_frames\` and inspect them. Use that only to choose source files, moments, and rough trims. Build the visible edit as OpenChatCut timeline items. Do not treat raw source inspection as timeline verification or as permission to produce the edited video elsewhere.
- For source-frame inspection: call \`view_asset_frames({"assetId":"...","sourceTimesMs":[...]})\` after \`read_project({"view":"assets"})\` confirms the asset id/type. Prefer this over asking the user to reattach the file.
- For local-only visual verification: upload/register cloud-readable media before relying on connector visual proof.
- For no-source validation: confirm the tool manifest exposed the parameters you used, then record the visible proof in the trace log.

When talking about seconds, verify the fps from \`read_project\` or use adapter tools that resolve fps internally.

When reporting a timeline item location, use only the latest \`read_project\` structure for track alias, item id, start, duration, and asset id. Do not report planned/default tracks or tool-call intent as verified placement.

Do not treat a command-line JSON response alone as sufficient when the user asks whether the editor reflects the result. Use the editor URL or visual proof when practical.

## Real Agent transcript check

After every L1 Agent run, inspect the complete chat record before reporting
success:

1. Read the final assistant response and every tool row created by the run.
2. Expand failed or warning rows and record the exact error.
3. Check for aborted turns, repeated retries, stale proposals, incomplete jobs,
   and tool results that the final response incorrectly describes as successful.
4. Compare the latest \`read_project\` result with the visible timeline.
5. For visual edits, inspect returned timeline frames rather than trusting the
   assistant summary.

A run with a correct-looking timeline but an unreported tool error is not a
clean pass. Fix the cause or report the remaining error explicitly.

If verification fails, classify the gap before changing tools:

- tool description or schema was insufficient
- skill instructions were missing a step
- \`read_project\` did not expose enough state
- editor authorization did not complete
- media/transcription pipeline failed
- cloud render/editor observation was blocked
`,D=`---
name: video-gen
description: |
  AI video generation via Seedance 2.0, Kling, and MiniMax Hailuo. Use when the user wants to generate a video clip — text-to-video, image-to-video, first/last-frame transitions, reference-guided generation, multi-shot, or generatively editing / extending an existing clip.
user-invocable: true
---

# Video Gen

Submits one video generation job per call and returns a \`jobId\`. Job management (wait / status) belongs to \`track_progress\`; this skill does **not** place videos on the timeline automatically.

## When to Use

Any time the user wants to generate a video clip — text-to-video, image-to-video, first-last-frame transition, reference-based generation, multi-shot storyboard, or generatively editing / extending an existing video (producing new generated footage based on a source clip; not timeline trimming).

## Models

| Model | Reference | Strengths |
| --- | --- | --- |
| \`seedance2\` | [references/seedance2.md](references/seedance2.md) | Default when configured. Multimodal refs, first/last, edit/extend/bridge, 2–15s, 480p/720p/1080p/4k, audio/seed/camera/watermark/last-frame/task controls. |
| \`kling\` | [references/kling.md](references/kling.md) | Technical camera/performance; Omni multi-shot; images ≤7 (≤4 with one feature \`refVideos\`); std/pro; 3–15s. |
| \`hailuo\` | [references/hailuo.md](references/hailuo.md) | MiniMax 海螺. T2V / I2V / first+last; **6s or 10s**; 512P (Hailuo-02), 720p→768P, 1080P (6s); no multi-ref / multi-shot. |

**IMPORTANT:** Before generating, READ the chosen model's reference for capabilities, input channels, modes, prompt structure, and model-specific behavior. Never invent params the reference forbids.

## Model Selection

Respect **configured vendors** from the capabilities prompt (only call a model whose key is on).

1. **User named a vendor** ("用海螺", "MiniMax", "Kling", "Seedance") → that \`model\`, if configured.
2. Else **default \`seedance2\`** when Seedance is configured.
3. Else if only Kling is on → \`kling\`. Else if only MiniMax is on → \`hailuo\`.
4. Switch away from default when:
   - Need **multi-shot customize / intelligence** → \`kling\` (confirm if not user-named).
   - Need **rich multi-modal refs** (video/audio refs, edit/extend) → \`seedance2\`.
   - Need a **short single beat** and only MiniMax is available, or user wants Hailuo → \`hailuo\` with duration 6 or 10.

If the required model is **not configured**, say so and offer: another configured video vendor, upload, or Motion Graphic — do not pretend the API exists.

Briefly tell the user what you will generate before submitting.

## Tool Params

| Param | Values | Default |
| --- | --- | --- |
| \`prompt\` | video description | required (except Kling customize → use \`multiPrompts\`) |
| \`model\` | \`seedance2\`, \`kling\`, \`hailuo\` | seedance2 when available |
| \`durationSeconds\` | model-specific | seedance/kling ~5; **hailuo 6 or 10** (1080p → 6 only) |
| \`ratio\` | see model docs | 16:9 (seedance/kling); **ignored on hailuo** |
| \`resolution\` | \`480p\`, \`512p\`, \`720p\`, \`1080p\`, \`4k\` | provider-specific; hailuo adds 512p for Hailuo-02 |
| \`refVideoMode\` | \`feature\`, \`base\` | kling only, with \`refVideos\` |
| \`promptOptimizer\` / \`fastPretreatment\` | boolean | hailuo only |
| \`generateAudio\`, \`seed\`, \`cameraFixed\`, \`watermark\` | controls | seedance only |
| \`returnLastFrame\`, \`executionExpiresAfter\`, \`priority\` | controls | seedance only; requested last frame becomes another image asset |
| \`name\` | descriptive asset name | required for good pool UX |
| \`firstFrame\` | project image asset ref | optional |
| \`lastFrame\` | project image asset ref | seedance / kling / hailuo (requires firstFrame; not with multi-ref on seedance) |
| \`refImages\` / \`refVideos\` / \`refAudios\` | asset refs | seedance full; kling: images + **1** feature video (no audio); hailuo: none (frames / S2V subject) |
| \`mode\` / \`shotType\` / \`multiPrompts\` | Kling multi-shot | kling only |

Model-specific params — see the model's reference.

## Input Resolution

\`firstFrame\` / \`lastFrame\` / \`refImages\` / \`refVideos\` / \`refAudios\` all take a project asset reference. Prefer a full UUID or short prefix from \`read_project\`; \`asset://<id>\` and same-project asset URLs returned by \`read_project\` are also accepted. Per-slot type: frame slots and \`refImages\` → image; \`refVideos\` → video; \`refAudios\` → audio.

External URLs and base64 are not accepted. If the source is a public URL, download it into the project first (\`download_media\` for video/audio, \`submit_image\` for images) and pass the resulting asset id.

## Workflow

Four-step loop. For each new generation, restart from Step 1 if the user's intent has shifted.

### Step 1 — Align scope with the user

Before writing any prompt, align on three dimensions:

1. **Duration & segments** — total length, how many shots, and whether they live in one clip or several.

   If the user has already stated a direction ("做一段", "in one video", "分别生成", "split into N shots", etc.), follow it — don't second-guess.

   Otherwise, surface the two paths and let the user pick:
   - **Multi-shot within one clip** (see model ref) — single inference, subject / lighting / style physically consistent across sub-shots; fits a coherent narrative within the per-clip duration cap.
   - **Multiple clips** — each clip is independently controllable and re-rollable, but identity and style continuity have to be carried by anchors; fits durations beyond the cap or hard scene breaks.

   Offer the trade-off; do not pick for the user.

2. **Content** — what each clip depicts. Summarize back what you understood, segment by segment. When content is vague (e.g. "generate a video of a girl dancing"), the user typically hasn't specified one or more of:
   - **Subject**: who / what is the main subject (appearance, outfit, defining features)?
   - **Action**: what are they doing? (For talking / emotional shots, what micro-expression?)
   - **Scene**: where — setting, time of day, environmental details?
   - **Lighting / color mood**: what atmosphere?
   - **Camera**: any shot-size / angle / movement preference?
   - **Style**: visual style or reference (cinematic / anime / documentary / ...).

   Focus on the items that matter for this specific request and can't be safely inferred — don't turn this into a blank-filling exercise. Summarize the understood parts back to the user before proceeding.

3. **Consistency anchors** — only when multiple shots reuse a character, object, or scene: identify which anchor (reference image or video) to pin across shots. For sourcing rules, see §Visual consistency across shots below.

For each dimension, check the user's words:

- **Clear** — proceed.
- **Ambiguous or missing** — ASK the user. Do not guess, do not default to your own interpretation. A round-trip confirmation is cheaper than a wasted generation.

#### What NOT to do

- **Do not "tell then submit"** — announcing "I'll make this as 2 clips" and immediately submitting is not alignment, it's a unilateral decision with announcement.
- **Do not default to splitting a single-video request into multiple clips.** A single clip can carry multiple sub-shots (see model ref), with subject / lighting / style physically consistent across them. Surface the trade-off, then let the user choose.
- **Do not skip the ask** because you think the answer is obvious.

#### Hard overrides (user's explicit word wins)

- "one clip / single clip / 一条 / 一个镜头 / in 1 clip" → never split, even if the description is objectively long.
- "N shots / N 段 / N 个镜头" → generate exactly N.
- "use this image / 用这张图" → use as reference, don't substitute.

### Step 2 — Write the prompt

See the chosen model's reference for prompt structure and param combinations (e.g., Seedance's 8-element structure and modes; Kling's prompt tips). Before submitting, check:

- \`name\` is a **descriptive** asset name — descriptive enough for the user (and you in later turns) to recognize this asset in the project library. Avoid vague names like "Untitled" or "clip 1".
- Param combination matches the user's intent — see the **Modes** section in the model's reference.
- Generated video audio is not a tool parameter (provider-side). Hailuo has no ratio/multi-ref; do not invent those params.
- On validation failure, read the error and fix the inputs — **do not blindly retry the same invalid arguments**.

### Step 3 — Submit one, wait, confirm

**Submit one generation job at a time.** Unless the user explicitly asked for multiple clips in parallel, do not submit the next clip until the current one completes and the user has reviewed it. Parallel submission hides problems: if the first shot has drift or wrong framing, the user would rather redo it once than have several misaligned shots to discard.

- \`submit_video.ratio\` controls the generated asset only; it does not change the project timeline canvas. If the user requested a final output aspect ratio (for example "9:16 vertical" or "16:9 landscape"), set the timeline canvas to the same ratio with \`manage_timelines\` action=update (e.g. ratio:"9:16") before placing the completed asset. If the user asked for no black bars / full-bleed, pass \`fit:"cover"\` when setting the canvas or updating/adding the visual item.
- Do not use this skill for job management — use the \`track_progress\` tool for status/wait.
- After submitting, end your turn (tell the user the job was created) unless a follow-up task is already queued.
- When the job finishes, surface the result to the user for review before proceeding to the next shot.
- Model-specific failure handling — see the model's reference.

### Step 4 — Iterate

When the user wants a next clip, a revision, or a continuation:

- **If it's the next shot in a multi-shot sequence** — reuse the established anchor (see §Visual consistency across shots below for principles, model ref for flag-level details).
- **If the user's feedback is ambiguous** ("it doesn't feel right") — ask what specifically to change before regenerating.
- **If the same text-prompt adjustment has failed twice** — stop adjusting text. Switch to reference images, or switch to edit mode where the model supports it (see model ref).
- Each new generation restarts the loop at Step 1 — realign if scope shifted.

## Visual consistency across shots

Text alone cannot reliably maintain visual identity across shots; visual references constrain output far more precisely than words.

### Anchors: the cornerstone of consistency

An **anchor** is a reference image or video pinned across every shot that shares the same character, object, or style. Any multi-shot sequence with recurring visual elements needs an anchor — don't try to reproduce them from text.

### Sourcing an anchor

Have reference awareness. When the user's request involves a recurring character / object / scene, think about what anchor to use **before** writing prompts:

- **Check the project first.** What has the user already provided or approved? Uploaded images, previously generated and approved shots, or earlier project assets can all serve as anchors.
- **Match the user's intent.** If the user pointed to a specific asset ("use this photo", "像上一段那样"), use that. If they described a character only in words, no anchor exists yet and one must be established.
- **When in doubt, ask the user.** Don't guess which asset to pin, and don't silently generate a new anchor when the user may already have one in mind.

### Establishing a new anchor (with user consent)

When no existing asset fits and one must be generated, propose it to the user first — it shapes every downstream shot. Model-specific paths — see the chosen model's ref.

### Using the anchor

- Pass the anchor in **every shot** that shares the character / object / style. The specific flag(s) to use depend on the model — see the model's ref.
- Describe the anchor by appearance in the prompt, not by name: "The BLACK RACING CAR with chrome exhaust" constrains far more than "Fleetmaster". When role confusion is likely, add explicit negations: "The motorcycle does NOT transform."
- Refer to the anchor with \`@Image1\` / \`@Video1\` in the prompt — not vague phrases like "the same car as before".
- When a shot depends on a previous generation, **wait for the previous job to complete** (via \`track_progress\` with \`action=wait\`) to obtain its \`assetId\`, then pass it as the anchor reference. Do not submit dependent shots in parallel.

### Multi-character projects

When a project has multiple named characters with distinct attributes (e.g. Faz with fire energy, Kev with ice energy), treat each character as a **separate anchor** — one reference asset per character. In every prompt:

- Name the **active** character and attach their distinctive attributes ("Kev has **blue ice** electric energy").
- Add explicit negations for the others to prevent attribute leakage ("NOT red fire energy, NOT Faz's look").
- Pin the correct character's anchor (model-specific flag — see model ref). Do not reuse another character's anchor by accident.

Missing either explicit attribution or negation causes cross-character attribute mixing.

**Multiple characters in the same frame.** For shots where multiple characters appear together (especially facing the camera), the model is prone to face-swap or body-clipping. Add **strong positional + outfit anchors** to each character and prefer a **fixed camera** for that shot:

- "the character on the LEFT wears a grey-blue tactical jacket, short beard, silver earring"
- "the character on the RIGHT wears a red cape with gold trim, long braided hair"
- "fixed camera, medium shot, both characters clearly separated"

Positional words (left / right / foreground / background) + distinctive outfit colors give the model enough signal to keep the characters apart.

### Escalate when text adjustments fail

If a visual-identity issue (wrong character, drift, color mismatch) persists after **two text-prompt adjustments** on the same shot, stop adjusting text. Text is not a substitute for an anchor. Escalate to:

- Adding or switching the anchor.
- Edit mode where the model supports it (see model ref for how to invoke).

Do **not** submit a third text-only retry on the same consistency issue.

### When to skip anchoring

Simple, one-off, or exploratory requests do not need anchors — generate directly.

## Run

\`\`\`ts
// Text-to-video (seedance2 default)
submit_video({
  model: "seedance2",
  prompt: "A cat walks across a sunny windowsill",
  name: "Cat on windowsill",
});

// Image-to-video with seedance2 — pass the project asset id directly; the server resolves the asset's media URL
submit_video({
  model: "seedance2",
  prompt: "The scene comes to life, gentle breeze rustles the curtains",
  firstFrame: "abc12345",
  name: "Living room animation",
});

// Kling text-to-video — only after Model Selection check
submit_video({
  model: "kling",
  prompt: "A sports car drifts around a wet corner",
  name: "Car drift shot",
});

// MiniMax Hailuo — 6s or 10s; optional firstFrame / lastFrame (with first)
submit_video({
  model: "hailuo",
  prompt: "A ceramic cup steams on a wooden table, soft morning light [Push in]",
  durationSeconds: 6,
  resolution: "720p",
  name: "Coffee steam morning",
});
\`\`\`

After submission, call the \`track_progress\` tool: \`action=status jobIds=<jobId>\` to poll, \`action=wait jobIds=<jobId>\` to block until terminal.

## Config Mode

For complex multimodal jobs, build the full args object up front and pass it in a single call:

\`\`\`ts
submit_video({
  model: "seedance2",
  prompt: "...",
  name: "...",
  firstFrame: "abc12345",
  refImages: ["def67890", "ghi24680"],
  refVideos: ["abc99999"],
  refAudios: ["jkl55555"],
  durationSeconds: 8,
  ratio: "9:16",
});
\`\`\`

## Rules

- Always provide \`--name\` with a descriptive asset name.
- Default to submit-only. End your turn after submitting unless a follow-up task is queued.
- Do not call this skill with \`--job\`, \`--wait\`, or \`--timeout\` — job management belongs to \`track_progress\`.
- Before submitting, briefly tell the user model + duration + what will be generated.
- Place completed assets with \`edit_item\` only after the user wants them on the timeline (pool-first contract).
`,O='# MiniMax Hailuo (`hailuo`)\n\nRead this before `submit_video({ model: "hailuo", … })`.\n\nGrounded in OpenChatCut’s video adapter (`server/plugins/video.ts` → MiniMax\n`POST /v1/video_generation`, poll `query/video_generation`, download via\n`files/retrieve`). Official MiniMax video guide lists four product modes\n(T2V / I2V / first–last / subject-reference). This path implements all four;\nthe configured MiniMax model determines which mode matrix is valid. Multi-ref\nis not a Hailuo API mode and is rejected.\n\nDefault settings model is `MiniMax-Hailuo-02` (Settings may switch to\n`MiniMax-Hailuo-2.3` / `MiniMax-Hailuo-2.3-Fast`). Call it **海螺 / Hailuo /\nMiniMax video** for the user.\n\n## Capabilities (as wired)\n\n| Dimension | Value |\n| --- | --- |\n| Endpoint | `POST {MINIMAX_BASE_URL}/v1/video_generation` |\n| Duration | **Exactly `6` or `10`** seconds (default **6**) |\n| Resolution tool args | `512p` → **`512P`** (Hailuo-02 only) · `720p` (default) → **`768P`** · `1080p` → **`1080P`** |\n| Aspect ratio | **No `ratio` field** — not sent. Framing follows first-frame image when present |\n| Prompt | **Required**, ≤ **2000** characters |\n| Prompt optimizer | Default **`true`**; tool `promptOptimizer: false` for more literal prompts |\n| Fast pretreatment | Optional `fastPretreatment: true` when optimizer is on |\n| Audio | Provider-side; no tool toggle |\n| Multi-shot / Kling fields | **Rejected** |\n| Async | Submit → poll ~**10s** → `file_id` → download URL |\n\n### Duration × resolution matrix\n\n| Tool `resolution` | API value | Allowed `durationSeconds` |\n| --- | --- | --- |\n| `512p` | `512P` | **6** or **10**, I2V with `MiniMax-Hailuo-02` only |\n| `720p` (default) | `768P` | **6** or **10** |\n| `1080p` | `1080P` | **6 only** (10s rejected by our validator) |\n\nIf you need 10s, use `720p` (or omit resolution).\n\n## Input channels\n\n| Tool param | Wired? | Maps to API |\n| --- | --- | --- |\n| `prompt` | **Yes, required** | `prompt` |\n| `firstFrame` | Optional | `first_frame_image` |\n| `lastFrame` | Optional, **requires firstFrame** | `last_frame_image` |\n| `refImages` / `refVideos` / `refAudios` | **No** | Rejected |\n| `subject_reference` | **When model is S2V-01** | `firstFrame` → `subject_reference[].image[]` (no lastFrame) |\n\n`firstFrame` / `lastFrame` must be project **image** asset ids. External URLs rejected — import first.\n\n## Modes\n\n| Params | Mode |\n| --- | --- |\n| `prompt` only | Text-to-video |\n| `prompt` + `firstFrame` | Image-to-video |\n| `prompt` + `firstFrame` + `lastFrame` | First→last frame transition |\n| `prompt` + `firstFrame`, configured `S2V-01` | Subject-reference video |\n\n`MiniMax-Hailuo-2.3-Fast` is I2V-only. First+last is `MiniMax-Hailuo-02` only,\ndoes not accept 512P, and does not expose `fast_pretreatment`. `S2V-01` accepts\nprompt, prompt optimizer, and subject reference only — no duration, resolution,\nlast frame, or fast pretreatment.\n\nNot available: multi-shot storyboard or multi-ref. Subject-reference is wired when Settings selects `S2V-01`.\nFor those → `seedance2` / `kling` when configured.\n\n## When to choose Hailuo\n\n- User named **MiniMax / 海螺 / Hailuo**\n- Short **single** clip (6s or 10s), T2V / I2V / simple first→last morph\n- Only MiniMax video key is on\n\nDo **not** pick hailuo for multi-shot customize, multi-ref, or non-6/10 durations.\n\n## Tool shape\n\n```ts\n// Text-to-video\nsubmit_video({\n  model: "hailuo",\n  prompt: "…",                 // ≤2000 chars; optional [Push in] camera commands\n  durationSeconds: 6,          // or 10 with 720p\n  resolution: "720p",          // 1080p → duration 6 only\n  name: "Descriptive pool name",\n});\n\n// Image-to-video\nsubmit_video({\n  model: "hailuo",\n  firstFrame: "imageAssetId",\n  prompt: "The subject begins to move. [Push in]",\n  durationSeconds: 6,\n  resolution: "1080p",\n  name: "Still · comes alive",\n});\n\n// First + last frame\nsubmit_video({\n  model: "hailuo",\n  firstFrame: "startImageId",\n  lastFrame: "endImageId",\n  prompt: "Smooth morph between the two frames; continuous camera.",\n  durationSeconds: 6,\n  name: "Frame morph A→B",\n});\n```\n\nThen `track_progress({ action: "wait", target: "generation", jobIds: "<jobId>" })`.\nPool-first; place with `edit_item` when the user wants timeline placement.\n\n**Do not pass** `ratio`, `refImages`, `refVideos`, `refAudios`, `shotType`, or `multiPrompts`.\n\n## Prompt writing\n\n### Structure for a 6–10s beat\n\nOne clear action: **Subject + Action + Scene + Camera + Style**. CN/EN OK; ≤2000 chars.\n\n### Camera commands (official `[command]` syntax)\n\n| Group | Commands |\n| --- | --- |\n| Truck | `[Truck left]`, `[Truck right]` |\n| Pan | `[Pan left]`, `[Pan right]` |\n| Push/pull | `[Push in]`, `[Pull out]` |\n| Pedestal | `[Pedestal up]`, `[Pedestal down]` |\n| Tilt | `[Tilt up]`, `[Tilt down]` |\n| Zoom | `[Zoom in]`, `[Zoom out]` |\n| Other | `[Shake]`, `[Tracking shot]`, `[Static shot]` |\n\nCombine ≤3 in one bracket: `[Pan left,Pedestal up]`. Sequence with prose: `…[Push in], then…[Pull out]`.\n\n### I2V / first–last tips\n\n- With `firstFrame` only: describe how the **still evolves**, not a conflicting new subject.\n- With `lastFrame`: describe the transition; both stills should be same aspect family when possible.\n\n### Longer stories\n\nMultiple sequential hailuo jobs, or Seedance/Kling multi-shot. One job at a time unless the user asked for parallel clips.\n\n## Subject-reference (S2V-01)\n\nWhen Settings `MINIMAX_VIDEO_MODEL` is **`S2V-01`** (or any model name matching `/s2v/i`):\n\n- **Required:** `firstFrame` = subject/face still  \n- **Forbidden:** `lastFrame`  \n- Body uses official `subject_reference: [{ type: "character", image: [...] }]` instead of first/last frame fields  \n- Keep prompt under 2000 chars; describe action/scene around that subject  \n\nDefault Hailuo models (`MiniMax-Hailuo-02` / `2.3` / `2.3-Fast`) still use first/last frame, **not** subject_reference.\n\n## Optimizer knobs\n\n```ts\nsubmit_video({\n  model: "hailuo",\n  prompt: "Exact brand shot. [Static shot] No style rewrite.",\n  durationSeconds: 6,\n  promptOptimizer: false, // more literal\n  name: "Literal brand",\n});\n\nsubmit_video({\n  model: "hailuo",\n  prompt: "Quick draft street walk",\n  durationSeconds: 6,\n  fastPretreatment: true, // only with optimizer on (default)\n  name: "Draft walk",\n});\n```\n\n## Not wired\n\n| Feature | Status |\n| --- | --- |\n| Callback webhooks | We poll |\n| Multi-shot API | Use Kling |\n\n## Errors\n\n| Message / pattern | Fix |\n| --- | --- |\n| `hailuo durationSeconds must be 6 or 10` | Use 6 or 10 |\n| `hailuo 1080p only supports durationSeconds 6` | 6s or switch to 720p for 10s |\n| `lastFrame requires firstFrame` | Supply both |\n| `hailuo does not support refImages/refVideos/refAudios` | Drop multi-ref; use frames only |\n| `mode and multi-shot parameters are supported by kling only` | Remove Kling-only fields |\n| `MiniMax is not configured` | Set `MINIMAX_API_KEY` |\n| Sensitive content / Fail / timeout | Rewrite prompt or stills; no thrice-identical retry |\n\n## Checklist\n\n1. MiniMax video on; `model: "hailuo"`.\n2. Duration 6 or 10; if `1080p`, must be 6.\n3. lastFrame only with firstFrame; no multi-ref / multi-shot / ratio.\n4. Prompt ≤2000; one beat; optional `[camera]` commands.\n5. Descriptive `name`; submit once; `track_progress`; pool-first placement.\n\n## Comparison\n\n| Need | Prefer |\n| --- | --- |\n| Fast short T2V / I2V / first–last on MiniMax | **hailuo** |\n| Multi-ref, edit/extend, audio refs | **seedance2** |\n| Formal multi-shot with per-shot durations | **kling** customize |\n',k='# Kling (`kling`)\n\nRead this before `submit_video({ model: "kling", … })`.\n\nGrounded in OpenChatCut’s video adapter (`server/plugins/video.ts` → Kling\n`POST /v1/videos/omni-video`, default model `kling-v3-omni`). Official Omni\ncapabilities (multi-shot, first/last frame, image refs, `<<<image_n>>>` tokens)\nare mapped to our tool shape below. **Do not promise** features we do not\nforward (video refs, element library, voice binding, Motion Brush, etc.).\n\nCall it **"Kling"** for the user — do not surface internal aliases (V3 / O3 /\nO1 / 2.6 / Turbo).\n\n## Capabilities (as wired)\n\n| Dimension | Value |\n| --- | --- |\n| Endpoint task | `omni-video` only |\n| Duration | **3–15** seconds integer (default **5**) |\n| Aspect ratio | `16:9`, `9:16`, `1:1` |\n| Quality mode | `std` → ~720p · `pro` → ~1080p (see `mode` / `resolution`) |\n| Top-level prompt | ≤ **2500** characters (required unless `shotType=customize`) |\n| Per-shot prompt | ≤ **512** characters when using `multiPrompts` |\n| Images | ≤ **7** total without video; ≤ **4** when `refVideos` is set |\n| Image formats (provider) | JPEG/JPG/PNG; roughly 300–8000 px side; ≤ ~10MB (import to project first) |\n| Reference video | **At most 1** via `refVideos` → API `video_list` |\n| `refVideoMode` | `feature` (default) or `base` — only with `refVideos` |\n| Multi-shot | **2–6** shots via `shotType` + optional `multiPrompts` |\n| `refAudios` | **Rejected** |\n| Element library / voice IDs | **Not wired** |\n| `negative_prompt` field | **Not sent** — put avoidances in the prompt text |\n\n### `mode` ↔ `resolution`\n\n| Intent | Set |\n| --- | --- |\n| Standard / faster | `mode: "std"` or `resolution: "720p"` (default) |\n| Higher fidelity | `mode: "pro"` or `resolution: "1080p"` |\n\nIf **both** are set, they must agree (`pro` ⇔ `1080p`); otherwise the server\nthrows `kling mode and resolution conflict`. Prefer setting only one.\n\n## Input channels → provider lists\n\n| Tool param | Provider entry | Prompt token (after rewrite) |\n| --- | --- | --- |\n| `firstFrame` | `image_list[]` `{ type: "first_frame", image_url }` | `<<<image_1>>>` if first image |\n| `lastFrame` | `image_list[]` `{ type: "end_frame", image_url }` | next image ordinal |\n| `refImages[]` | `image_list[]` `{ image_url }` | following ordinals |\n| `refVideos[]` | `video_list[]` `{ video_url, refer_type }` | `<<<video_1>>>` (max 1) |\n| `refVideoMode` | `feature` (default) or `base` | feature = motion/camera/style; base = edit source (`keep_original_sound: yes`) |\n\n**Rules**\n\n- `lastFrame` **requires** `firstFrame`.\n- All slots are **project asset refs** (UUID / prefix / `asset://…`). External URLs rejected — import first.\n- In the **prompt**, use `@Image1` / `@图片1` and `@Video1` / `@视频1`. Our server rewrites to `<<<image_N>>>` / `<<<video_N>>>`. Image ordinals: firstFrame → lastFrame → refImages[0]…. Video ordinals start at 1 for `refVideos[0]`.\n- With a feature video: keep **≤4** stills total; describe what to take from the video (camera, motion, rhythm) in the prompt.\n\nAlways attach a noun after the token: `@Image1 character walks…`, not bare `@Image1 walks…`.\n\n## Modes\n\n| Params | Mode | Notes |\n| --- | --- | --- |\n| `prompt` only | text-to-video | Single continuous clip |\n| `firstFrame` + `prompt` | image-to-video | Animate from start still |\n| `firstFrame` + `lastFrame` + `prompt` | first→last | Strict start/end frames |\n| `prompt` + `refImages` (± frames) | reference-guided | Subject/style anchors; ≤7 images total |\n| `prompt` + `refVideos` (± ≤4 images) | video feature ref | Default `refVideoMode: "feature"` — motion/camera/style |\n| `prompt` + `refVideos` + `refVideoMode: "base"` | video edit | Edit/replace elements in that clip; source audio kept when possible |\n| `shotType: "intelligence"` + `prompt` | multi-shot auto | Model plans cuts; 2–6 internal shots |\n| `shotType: "customize"` + `multiPrompts` | multi-shot manual | **Omit** top-level `prompt` |\n\n### Multi-shot (official contract → our tool)\n\nOfficial Omni multi-shot: `multi_shot: true`, `shot_type`, optional `multi_prompt[]`.\nWe set those when you pass `shotType`.\n\n#### `shotType: "intelligence"`\n\n- Pass a **single** top-level `prompt` that describes the whole sequence.\n- Model auto-decomposes into shots (up to 6).\n- Use when the user wants quick multi-cut coverage without per-shot durations.\n- Still write technical shot language (size / camera / motion settle) inside that one prompt when quality matters.\n\n```ts\nsubmit_video({\n  model: "kling",\n  shotType: "intelligence",\n  durationSeconds: 10,\n  ratio: "9:16",\n  prompt:\n    "Two-shot dialogue then CU reaction. Shot reverse shot. " +\n    "MCU on speaker A, then B. Soft key camera-left 4500K. " +\n    "Motion settles as B looks down, breath steadies.",\n  name: "Dialogue · intelligence multi",\n});\n```\n\n#### `shotType: "customize"`\n\nServer validation (matches official customize):\n\n| Rule | Detail |\n| --- | --- |\n| Top-level `prompt` | **Must be omitted** (empty) |\n| Shot count | **2–6** entries in `multiPrompts` |\n| `index` | 1-based, consecutive (`1…N`) |\n| Per-shot `prompt` | Non-empty, ≤ **512** chars |\n| Per-shot `duration` | Integer ≥ **1** |\n| Sum of durations | **Exactly** `durationSeconds` |\n\n```ts\nsubmit_video({\n  model: "kling",\n  shotType: "customize",\n  durationSeconds: 12,\n  ratio: "16:9",\n  mode: "std",\n  multiPrompts: [\n    {\n      index: 1,\n      duration: 4,\n      prompt:\n        "[Shot 1] WS. Slow dolly in. Key from camera-left window, 4500K warm amber. " +\n        "Woman in grey coat enters cafe. Motion settles as she reaches the counter.",\n    },\n    {\n      index: 2,\n      duration: 4,\n      prompt:\n        "[Shot 2] MCU. Static. Same woman, grey coat, short dark hair. She smiles at barista. " +\n        "Motion settles as steam rises past her face.",\n    },\n    {\n      index: 3,\n      duration: 4,\n      prompt:\n        "[Shot 3] CU. Very slow push-in. Hands take a paper cup. " +\n        "Motion settles as both hands cradle the cup center-frame.",\n    },\n  ],\n  name: "Cafe storyboard · 3 shots",\n});\n```\n\nRepeat **identity details in every shot prompt** (coat color, hair, age cues). Multi-shot preserves identity better than separate jobs, but each shot is still its own brief — do not assume shot 2 “remembers” shot 1’s prose.\n\nOptional: same `refImages` / `firstFrame` on a customize job to lock appearance across the storyboard.\n\n## Prompt craft (technical-script model)\n\nKling does **not** invent missing camera grammar. Explicit structure fixes most failures. Stack these rules:\n\n### 1. Motion endpoint — every shot\n\nEnd with `Motion settles as <concrete end state>`. Missing endpoints often stall near completion or cut off mid-action.\n\n```\n✗ A woman walks a rainy alley under neon.\n✓ A woman walks a rainy alley under neon.\n  Motion settles as she pauses under a red lantern, face half-turned to camera.\n```\n\nApplies to single-shot, I2V, intelligence, and **each** customize entry.\n\n### 2. Shot size in English\n\nOpen with a Hollywood size (abbrev OK):\n\n| Size | Abbr | Use |\n| --- | --- | --- |\n| Extreme close-up | ECU | Eye, hand detail |\n| Close-up | CU | Face / object |\n| Medium close-up | MCU | Head + shoulders |\n| Medium shot | MS | Waist up |\n| Medium long | MLS | Full body mid-distance |\n| Wide shot | WS | Environment establish |\n\n### 3. Camera movement (declare ≥1; `static` counts)\n\n| Category | Terms |\n| --- | --- |\n| Static | `static` |\n| Push/pull | dolly in/out, pull back |\n| Pan/tilt | pan left/right, tilt up/down |\n| Track | lateral tracking, following |\n| Orbit | slow 180 orbit (avoid on fast action) |\n\nSpeed: `very slow / slow / medium / fast / whip`. Max ~2 moves per shot.\n\n### 4. Lighting triplet\n\nAlways: **direction + Kelvin + tone**  \ne.g. `key from camera-left window, 4500K, warm amber`.  \n“Warm light” alone → face/shadow drift.\n\n### 5. Sequential action\n\nUse `First / Then / Finally` for multi-step motion inside one shot.\n\n### 6. Time slicing (≥5s shots)\n\n```\n[Shot 2 / MCU / 6s]\n  - 0–2s: …\n  - 2–4s: …\n  - 4–6s: …\nMotion settles as …\n```\n\n### 7. Emotions → ≥3 physical signals\n\n| Emotion | Signals (pick 3+) |\n| --- | --- |\n| Sad | glistening eyes, trembling lower lip, shallow breath, loose fingers |\n| Scared | wide eyes, breath catch, forehead sweat, hand tremor |\n| Happy | eye-corner crinkles, asymmetric smile, relaxed shoulders, soft exhale |\n| Angry | clenched jaw, flared nostrils, white knuckles, quick breath |\n\n### 8. Complexity ceiling\n\n~≤7 “elements” per shot (characters, independent events, strong BG actions). Over limit → split shots (prefer customize multi-shot).\n\n### Bilingual split\n\nNarrative can be CN/EN; keep technical directives in English when possible:\n`Camera`, `Lighting`, `Motion settles`, `@ImageN` / rewritten `<<<image_n>>>`.\n\n### Avoidances (no negative_prompt field)\n\nBake into prompt: `Avoid: blurry hands, extra fingers, warped face, text distortion.`\n\n## Multi-character\n\nAttribute leak is common. Every shared-frame prompt needs:\n\n- Position (`LEFT` / `RIGHT` / foreground)\n- Distinct outfit + traits\n- Explicit **NOT** clauses for the other character\n- Prefer **fixed** or very slow camera\n\n```\nLEFT: @Image1 man — grey-blue tactical jacket, short beard. NOT red cape, NOT braid.\nRIGHT: @Image2 woman — red cape gold trim, long braid. NOT grey jacket, NOT short beard.\nCamera: fixed MS, both fully separated.\nMotion settles as both face camera, still.\n```\n\n## Real-person / product stills\n\nBest refs: frontal (~0–15°), ≥1024² when possible, even light, little occlusion.  \nPass as `firstFrame` and/or `refImages`; mention `@Image1` in the prompt.\n\n## Cross-job continuity (separate `submit_video` calls)\n\nPrefer **one customize multi-shot job** for 2–6 related cuts. If the user forces separate jobs:\n\n1. Keep the same `refImages` on every call.\n2. After shot N succeeds, use a frozen frame of the result as the next `firstFrame` when continuity is critical.\n3. `track_progress` wait before dependent jobs.\n4. After **two** text-only retries on identity drift → change/add refs, not more adjectives.\n\n## When to pick Kling vs Seedance vs Hailuo\n\n| Need | Prefer |\n| --- | --- |\n| Per-shot duration control / formal storyboard API | **kling** `customize` |\n| Auto multi-cut from one paragraph | **kling** `intelligence` |\n| Fine face performance / technical camera language | **kling** |\n| One motion/camera feature video + stills | **kling** `refVideos` (1) |\n| Multi video/audio refs, edit/extend/bridge | **seedance2** |\n| Simple 6s/10s T2V or single still I2V | **hailuo** |\n\n## Not wired (do not promise)\n\n| Feature | Status |\n| --- | --- |\n| Multiple `refVideos` | Max **1** video |\n| `refAudios` | Rejected for Kling |\n| Element library (`@Element` / element_id) | Not uploaded / not sent |\n| Voice binding / voice clone IDs | Not sent |\n| Motion Brush (web UI) | N/A |\n| Separate audio on/off flag | Not exposed |\n\nFor multi-video bridge/edit or audio refs, prefer **seedance2**.\n\n## Errors (server / provider)\n\n| Message / pattern | Fix |\n| --- | --- |\n| `omit prompt for kling customize; use multiPrompts` | Clear top-level prompt; fill `multiPrompts` |\n| `kling customize requires 2 to 6 multiPrompts` | Shot count 2–6 |\n| `kling multiPrompt indexes must be consecutive from 1` | `index: 1…N` no gaps |\n| `each kling multiPrompt requires a prompt of at most 512 characters` | Shorten per-shot text |\n| `kling multiPrompt durations must sum to durationSeconds` | Rebalance durations |\n| `kling multiPrompts require shotType=customize` | Set `shotType: "customize"` |\n| `kling accepts at most 7 images` | Drop frames/refs |\n| `kling with refVideos accepts at most 4 images` | Drop stills or drop the feature video |\n| `kling accepts at most 1 reference video` | Keep a single `refVideos` entry |\n| `kling does not support refAudios` | Drop audio refs; use Seedance if needed |\n| `kling mode and resolution conflict` | Align mode ↔ resolution |\n| `prompt is required` | Non-customize paths need prompt |\n| `kling prompt must be at most 2500 characters` | Shorten |\n| 99% stall / abrupt end | Add **Motion settles** endpoint |\n| Face drift across jobs | Same refs + wait; or one customize multi-shot |\n\n## Tool checklist\n\n1. Kling key on (capabilities); `model: "kling"`.\n2. Mode combo valid (no Seedance-only ratio like `21:9` / `adaptive`).\n3. Images ≤7; no video/audio refs.\n4. Customize ⇔ empty prompt + valid multiPrompts sum.\n5. Every shot prompt has size + camera + light + **Motion settles**.\n6. Descriptive `name` for the media pool.\n7. Tell the user model + duration + multi-shot style briefly, then submit once.\n8. `track_progress` for job completion; place with `edit_item` only when asked.\n\n## Quick single-shot example\n\n```ts\nsubmit_video({\n  model: "kling",\n  prompt:\n    "MCU. Slow dolly in. Key from camera-left, 5000K neutral. " +\n    "@Image1 young man in navy hoodie reads a letter; eyes glisten, jaw tight, breath shallow. " +\n    "Motion settles as he lowers the letter, gaze off-camera right. " +\n    "Avoid: extra fingers, warped text on paper.",\n  firstFrame: "portraitAssetId",\n  durationSeconds: 5,\n  ratio: "9:16",\n  mode: "pro",\n  name: "Letter reaction · MCU",\n});\n```\n',A='# Seedance 2.0 (`seedance2`)\n\nRead this before `submit_video({ model: "seedance2", … })`.\n\nGrounded in OpenChatCut’s video adapter (`server/plugins/video.ts` → Seedance\n`/contents/generations/tasks`). Capability claims outside what we wire are\n**not** to be promised. Official prompt patterns (subject/motion/camera,\nmultimodal `@` refs, edit/extend/bridge) are adapted here to our tool shape.\n\n## Capabilities (as wired)\n\n| Dimension | Value |\n| --- | --- |\n| Duration | **2–15** seconds integer (default **5**) |\n| Resolution | **`480p`** / **`720p`** (default) / **`1080p`** / **`4k`** — API `resolution` (4k needs full Seedance 2.0; Fast/Mini may reject) |\n| Aspect ratio | `16:9`, `4:3`, `1:1`, `3:4`, `9:16`, `21:9`, `adaptive` |\n| Audio out | `generateAudio` → `generate_audio` (official default true) |\n| Provider controls | `seed`, `cameraFixed`, `watermark`, `returnLastFrame`, `executionExpiresAfter` (3600–259200), `priority` (0–9) |\n| Prompt | Required; keep focused (CN ≈ ≤500 chars, EN ≈ ≤1000 words useful bound) |\n| Multi-shot API | **None** — multi-shot is **prompt structure only** (not Kling `shotType` / `multiPrompts`) |\n\nWhen `firstFrame` or `lastFrame` is set, the server **forces `ratio: "adaptive"`**\n(follows the frame image). Explicit `ratio` is ignored in that case.\n\n## Input channels → server roles\n\n| Tool param | Server role | Prompt token | Limits |\n| --- | --- | --- | --- |\n| `firstFrame` | `first_frame` | `@ImageN` (first image in payload order) | 1 image |\n| `lastFrame` | `last_frame` | next `@ImageN` | requires `firstFrame` |\n| `refImages[]` | `reference_image` | `@ImageN` in array order after frames | ≤ **9** |\n| `refVideos[]` | `reference_video` | `@Video1`… | ≤ **3** |\n| `refAudios[]` | `reference_audio` | `@Audio1`… | ≤ **3**; needs ≥1 visual (frame or image/video ref) |\n\nAll slots are **project asset refs**. External URLs are rejected. Reference videos are uploaded to configured R2 and sent as temporary HTTPS URLs because the official API does not accept video data URLs.\n\n**Ordinal rule:** images are numbered in **payload order**: `firstFrame` → `lastFrame` → `refImages[0]`… Videos and audios number only within their own arrays. Always name the role in prose after the token: `@Image1 (the red coat woman)`, not bare `@Image1 walks…` (number segmentation errors).\n\n## Modes (inferred — no `mode` param)\n\n| Params | Mode | Use when |\n| --- | --- | --- |\n| `prompt` only | text-to-video | Pure description, no visuals |\n| `firstFrame` + prompt | image-to-video | Animate a known start frame |\n| `firstFrame` + `lastFrame` + prompt | first→last transition | Strict start/end stills |\n| any `refImages` / `refVideos` / `refAudios` (± `firstFrame`) | reference-guided | Style/subject/motion/audio anchors, edit, extend, bridge |\n\n**Hard exclusion:** `lastFrame` **cannot** combine with `refImages` / `refVideos` / `refAudios` (server rejects). Choose either strict first–last transition **or** reference-guided work.\n\nKling-only fields (`shotType`, `multiPrompts`, `mode: std|pro`) are rejected for seedance2.\n\n## Mode recipes\n\n### A. Text-to-video\n\n```ts\nsubmit_video({\n  model: "seedance2",\n  prompt: "…", // 8-element structure preferred\n  durationSeconds: 8,\n  ratio: "9:16",\n  name: "Descriptive pool name",\n});\n```\n\n### B. Image-to-video (first frame)\n\n```ts\nsubmit_video({\n  model: "seedance2",\n  firstFrame: "assetId",\n  prompt: "The scene comes alive: soft wind, slow push-in, …",\n  durationSeconds: 6,\n  name: "Living still · push-in",\n});\n// ratio becomes adaptive server-side\n```\n\n### C. First + last frame\n\n```ts\nsubmit_video({\n  model: "seedance2",\n  firstFrame: "startId",\n  lastFrame: "endId",\n  prompt: "Smooth morph between the two frames; continuous camera; no jump cuts.",\n  durationSeconds: 5,\n  name: "Frame morph A→B",\n});\n// no refImages / refVideos / refAudios\n```\n\n### D. Reference-guided (subject / style / multi-image)\n\nPass anchors as `refImages` (and optional `firstFrame`). **Tell the prompt what each image is for.**\n\n| Intent | Prompt pattern |\n| --- | --- |\n| Multi-angle subject | `Reference @Image1 @Image2 @Image3 for the product/character appearance; …` |\n| Subject + scene | `@Image1 (character) in @Image2 (cafe interior) …` |\n| Outfit + person | `@Image1 person wearing outfit from @Image2 …` |\n| Storyboard panels | `Follow storyboard order in @Image1; each panel in sequence …` |\n| Logo / on-screen brand | `… then @Image2 logo settles lower-right …` |\n\nPrefer **appearance** language (“black short hair, silver earring”) over proper names the model cannot see.\n\n### E. Video reference (motion / camera / VFX)\n\n| Intent | Prompt pattern |\n| --- | --- |\n| Action / choreography | `Reference @Video1 for the fight/dance motion; characters from @Image1 …` |\n| Camera only | `Follow @Video1\'s camera path and transitions; subject from @Image1 …` |\n| Effects | `Reference @Video1 particle/wing effect on @Image1 …` |\n| Rhythm / cuts | `Cut rhythm matches @Video1; subjects from @Image1–@ImageN …` |\n\nBe explicit: **which attribute** of `@VideoN` (motion vs camera vs grade vs pacing).\n\n### F. Edit / extend / bridge (still `refVideos` + prompt)\n\nThese create a **new** pool asset; they do not mutate the source timeline item.\n\n| Use case | Prompt shape (prefer direct verbs) | Params |\n| --- | --- | --- |\n| **Edit** | `Replace the scarf in @Video1 with a red one; keep camera and timing.` | `refVideos: [source]` ± `refImages` for replacements |\n| **Extend after** | `Continue after @Video1: …` / `Generate content after @Video1: …` | `refVideos: [source]`; `durationSeconds` = length of the **new** generated segment |\n| **Extend before** | `Generate content before @Video1: …` / lead-in into the existing clip | same |\n| **Bridge / track** | `@Video1, [transition], then @Video2, [transition], then @Video3` | up to **3** videos; total ref video time ideally ≤ **15s** |\n\n**Edit vs pure reference:** for edit/extend, address `@Video1` as the **source to change/continue**. Avoid “reference @Video1 for style” wording when you actually want an edit — that steers the model into generic R2V.\n\nWhen iterating a failed shot, prefer **edit** of the best prior take over full T2V restarts (keeps what already works).\n\n### G. Audio reference\n\n```ts\nsubmit_video({\n  model: "seedance2",\n  refImages: ["subjectId"],\n  refAudios: ["bedId"],\n  prompt: "@Image1 character walks a rainy street; timing and mood follow @Audio1.",\n  durationSeconds: 8,\n  name: "Rain walk · audio-led",\n});\n```\n\nAudio alone is invalid — always pair with a visual channel.\n\n## Prompt writing\n\n### Core formula\n\n**Subject + Action/Motion + Scene + Lighting/Color + Camera + Style + Quality + Negatives**\n\nFill only what matters; omit empty slots. For multi-shot, write a **timeline storyboard** (who / where / action / camera per beat).\n\n### Three multi-shot styles (single clip, 4–15s)\n\n1. **Short ideation** — one paragraph, one or two beats (exploration).\n2. **Descriptive package** — aesthetic + story + characters + environment + action + production notes + negatives (balanced control).\n3. **Granular timestamps** — `Shot 1 (0–2s): … Shot 2 (2–5s): …` matching `durationSeconds` (max control).\n\nLonger durations (10–15s) tolerate more sub-shots; still **one camera move per sub-shot**.\n\n**Continuous single take** — when the user wants unbroken motion, say so explicitly: `one continuous take, no hard cuts` and describe a single evolving path instead of numbered shots.\n\n**Timestamp tips**\n\n- Sum of shot windows should equal `durationSeconds`.\n- Put intentional transitions at boundaries (“hard cut to CU”, “whip pan into …”).\n- Quality/negative tail once at the end, not per shot.\n\n**Example (8s, 9:16, 4 sub-shots + image anchor):**\n\n```\n8s, 9:16, cinematic.\nShot 1 (0–2s): Full shot, @Image1 woman walks onto red carpet, soft top-light, slow dolly in.\nShot 2 (2–4s): Medium shot, she turns to camera, holds perfume bottle, key light camera-left.\nShot 3 (4–6s): Close-up on the bottle, gentle rotation, shallow DOF.\nShot 4 (6–8s): Medium shot, she smiles, dress hem moves in light wind.\n4K sharp details, face stable, no mutation, no duplicated limbs, hands anatomically correct.\n```\n\n### @ mention hygiene\n\n| Do | Don\'t |\n| --- | --- |\n| `@Image1 (dark-haired woman) enters @Image2 (loft)` | `make her look like the reference` |\n| `Reference @Video1 for camera only` | stack push-in + orbit in one sub-shot |\n| `@Image1 on LEFT, @Image2 on RIGHT, fixed camera` | rely on names without appearance words |\n\nAfter `@ImageN` / `@VideoN` / `@AudioN`, always a **noun or parenthetical** before verbs.\n\n### Camera language (model-friendly)\n\n| Category | Terms |\n| --- | --- |\n| Shot size | Close-up, MCU, Medium, Full, Long, Extreme long |\n| Angle | Eye-level, Low, High, OTS, Top-down |\n| Move | Push-in, Pull-out, Pan, Tilt, Dolly/Track, Orbit, Handheld |\n| Lens / FX | Shallow DOF, Slow-mo, Time-lapse, Hitchcock zoom |\n\n### On-screen text & dialogue (prompt-only)\n\nNative audio is always generated. You can request:\n\n- **Titles / slogans:** content + timing + position + style  \n  (`text "…" appears center after 2s, bold white`)\n- **Subtitles:** bottom captions synced to spoken lines\n- **Speech bubbles:** character says "…"; bubble near speaker\n- **Spoken lines:** quote dialogue in the prompt for lip-sync-ish delivery\n\nPrefer common characters; avoid rare glyphs/special symbols for burned-in text.\n\n### Quality & stability tail\n\nFor faces / characters, append by default unless the user wants lo-fi:\n\n> `sharp details, character face stable, no mutation, no clipping, no duplicated limbs, hands anatomically correct`\n\n## Cross-clip consistency (multiple jobs)\n\nSeedance calls are **stateless**. For recurring identity across separate `submit_video` jobs:\n\n1. Pin a static anchor: `refImages: [characterOrProduct]`.\n2. After shot N is approved, also pass it as `refVideos: [shotNAssetId]` on shot N+1.\n3. Wait with `track_progress` (`action=wait`) before dependent jobs — never parallelize dependent continuity.\n4. After **two** failed text-only retries on identity, stop tweaking prose → change/add anchors or use **edit** mode on the best take.\n\nMulti-character: one anchor image per character; every prompt names the **active** character + attributes and **negates** the others; same-frame → left/right + outfit colors + prefer fixed camera.\n\n## When to use Seedance vs Kling vs Hailuo\n\n| Need | Prefer |\n| --- | --- |\n| Multimodal refs (video/audio), edit/extend/bridge | **seedance2** |\n| Structured multi-shot with per-shot durations (`multiPrompts`) | **kling** `shotType=customize` |\n| Quick auto multi-shot from one paragraph | **kling** `shotType=intelligence` |\n| Simple 6s/10s T2V or single-image I2V only | **hailuo** |\n\n## Content review\n\n- Real human faces (incl. photoreal generated) generally OK as refs.\n- Celebrity / IP / branded mascot likenesses often blocked — surface the error; ask for another ref; do not blind-retry the same assets.\n\n## Errors (server / provider)\n\n| Message / pattern | Fix |\n| --- | --- |\n| `seedance2 resolution must be 480p, 720p, 1080p, or 4k` | Use one of those four |\n| `seedance2 lastFrame mode cannot be combined with references` | Drop refs **or** drop `lastFrame` |\n| `seedance2 reference limit exceeded` | ≤9 images, ≤3 videos, ≤3 audios |\n| `seedance2 audio references require a visual reference` | Add firstFrame or ref image/video |\n| `lastFrame requires firstFrame` | Supply both |\n| `durationSeconds must be between 2 and 15` | Clamp duration |\n| `does not support ratio …` | Use allowed ratio list |\n| content-review / policy failure | New refs; do not retry same IP face |\n| timeout / provider failed | Report; adjust prompt or simplify refs; avoid thrice-identical payload |\n\n## Tool checklist before submit\n\n1. `model: "seedance2"` and Seedance key is on (capabilities).\n2. `name` is descriptive for the media pool.\n3. Param combo matches the intended mode (see exclusion rules).\n4. Every media slot is a project asset id; prompt `@` ordinals match payload order.\n5. `durationSeconds` integer 2–15; multi-shot timestamps sum to it.\n6. `resolution` is `480p` (draft), `720p` (default), `1080p`, or `4k` (final delivery; heavier).\n7. No Kling-only fields.\n8. Briefly tell the user model + duration + mode before calling.\n\n## Full multimodal example\n\n```ts\nsubmit_video({\n  model: "seedance2",\n  prompt: [\n    "9:16, 10s, cinematic product film.",\n    "Shot 1 (0–3s): @Image1 bottle on marble, slow orbit, soft key from left.",\n    "Shot 2 (3–7s): hand lifts bottle; motion energy follows @Video1 camera push.",\n    "Shot 3 (7–10s): hero CU, label sharp; mood follows @Audio1.",\n    "sharp details, no warping logo, stable reflections.",\n  ].join(" "),\n  firstFrame: "heroStillId",       // @Image1\n  refImages: ["labelDetailId"],    // @Image2\n  refVideos: ["orbitRefId"],       // @Video1\n  refAudios: ["bedId"],            // @Audio1\n  durationSeconds: 10,\n  name: "Bottle hero · 10s multi-beat",\n});\n```\n\nThen:\n\n```ts\ntrack_progress({ action: "wait", target: "generation", jobIds: "<jobId>" });\n```\n\nAsset lands in the **media pool only**. Place with `edit_item` when the user wants it on the timeline.\n',j=`---
name: voice
description: |
  Text-to-Speech (TTS), voiceover, narration placement/sync, and custom sound effects (SFX) generator. Use when the user wants generated speech from text, wants to add/replace/align narration or voiceover for an existing video/timeline, wants to keep existing voiceover synced after visual retiming edits, needs voice audition/selection, or explicitly wants a newly generated/custom sound effect that is not available in the Sound Effects library.
user-invocable: true
---

# Voice & Sound Effects Generator

Generate voiceovers (TTS) and sound effects. For TTS, choose a concrete
provider and voice before calling \`submit_voice\`.

## When to Use

- Generate voiceover/narration from text
- Create text-to-speech audio for videos
- Add, replace, or redo narration/voiceover for an existing video, timeline,
  screen recording, slide animation, product demo, B-roll edit, MG explainer, or
  other visual sequence
- Keep existing narration/voiceover aligned after trimming, speeding up, slowing
  down, moving, reordering, or replacing the visuals it describes
- Offer and audition TTS voice choices when the user has not picked a concrete voice
- Generate custom sound effects from text descriptions only after checking the Sound Effects library first

## TTS (Text-to-Speech)

If the current request has an existing visual target and the user wants
narration, voiceover, dubbing, or replacement speech for that target, read
[references/video-sync.md](references/video-sync.md) before drafting new
narration, using existing narration text to generate TTS, or placing audio. Do
this even when the user did not explicitly say "sync" or "match the visuals";
the existence of a visual target means narration timing and meaning may need to
follow on-screen content. Use the normal standalone TTS path only when there is
no visual target or the user just wants an audio asset from text.

Also read [references/video-sync.md](references/video-sync.md) when the timeline
already has narration/voiceover and the user asks to change the visuals while
keeping that voiceover aligned. This is a sync maintenance task even if no new
TTS is needed.

Use \`submit_voice\` to create a TTS audio asset. The current MCP tool contract is:

- \`provider\` is required: \`doubao\` (Chinese-optimized), \`elevenlabs\` (English /
  multilingual), or \`minimax\` (MiniMax TTS — see
  [references/minimax-tts.md](references/minimax-tts.md)).
- \`voiceId\` is required and provider-specific. The only exception is MiniMax
  \`timbreWeights\` mixing, where \`voiceId\` must be empty. Do not mix catalogs.
- \`submit_voice\` creates an audio asset only. Timeline placement, replacement,
  trimming, and alignment happen later with timeline tools.
- For long narration, multiple \`submit_voice\` calls can be useful: split at
  natural pauses, sentence groups, or script beat boundaries when the workflow
  benefits from separately timed or placed voice clips, such as storyboard beats,
  scene-level ad segments, or a user request for separate assets.
- For Doubao, \`speedRatio\`, \`loudnessRatio\`, \`pitch\`, \`emotion\`,
  \`emotionScale\`, \`performancePrompt\`, and \`explicitDialect\` are supported
  knobs, but not every Doubao voice supports every expressive control. Check
  the \`voiceId\` guide or [references/voices.md](references/voices.md) before
  using them.
- For ElevenLabs, the tool supports the official voice settings, language,
  seed, output formats, normalization, pronunciation dictionaries, continuity
  text/request IDs, and logging/latency query controls. For \`eleven_v3\`, inline audio tags are available for expressive
  delivery such as emotion, tone, nonverbal cues, accent hints, pauses, or
  local pacing.

Doubao control support for current curated voices:

- \`vivi\`, \`xiaohe\`, \`yunzhou\`, \`xiaotian\`, \`naiqimengwa\`, \`yingtaowanzi\`,
  \`wenroumama\`, \`zhixingnv\`, \`dayi\`, \`jitangnv\`, \`liuchang\`, \`ruyayichen\`,
  \`morgan\`, \`qingcang\`, \`huiben\`, \`popo\`, \`yuanboxiaoshu\`, \`baqiqingshu\`, and
  \`tangseng\` support explicit \`emotion\` / \`emotionScale\`,
  \`performancePrompt\`, and ASMR-style prompt directions.
- \`shuanglangshaonian\` supports \`performancePrompt\` and COT/QA-style
  instruction following, but does not support explicit \`emotion\` /
  \`emotionScale\` or ASMR-style control.
- \`explicitDialect\` is only supported by \`vivi\` and can be \`dongbei\`,
  \`shaanxi\`, or \`sichuan\`.

ElevenLabs control support for current curated voices:

- \`amelia\`, \`brittney\`, \`hope\`, \`jessica\`, \`arabella\`, \`jane\`, \`maria\`,
  \`mark\`, \`frederick\`, \`peter\`, \`james\`, \`jon\`, \`sully\`, \`david\`, and \`alex\`
  all support the same request-level controls; model-specific support is still
  validated by ElevenLabs.
- These controls are not per-voice guarantees of a specific acting style.
  Use the preset tags/samples to pick a naturally suitable voice, then use the
  controls for moderate delivery changes.
- For ElevenLabs \`eleven_v3\`, inline audio tags are available when the user
  asks for expressive delivery such as emotion, tone, nonverbal cues, accent
  hints, or local pacing. Official examples fit these useful TTS categories:
  emotion/tone tags such as \`[happy]\`, \`[sad]\`, \`[angry]\`, \`[excited]\`,
  \`[curious]\`, \`[sarcastic]\`, \`[crying]\`, \`[annoyed]\`, \`[appalled]\`,
  \`[thoughtful]\`, \`[surprised]\`, and \`[mischievously]\`; vocal delivery and
  nonverbal cue tags such as \`[whispers]\`, \`[laughs]\`, \`[sighs]\`, \`[exhales]\`,
  \`[inhales deeply]\`, \`[clears throat]\`, \`[snorts]\`, \`[swallows]\`,
  \`[wheezing]\`, and \`[coughs]\`;
  pacing/pause/local speed tags such as \`[slowly]\`, \`[pause]\`,
  \`[short pause]\`, \`[long pause]\`, \`[rushed]\`, and \`[drawn out]\`; and
  accent/special-performance tags such as
  \`[strong X accent]\`, for example \`[strong French accent]\`, plus \`[sings]\`,
  \`[singing]\`, \`[woo]\`, and \`[pirate voice]\`. Official examples are
  non-exhaustive; similar auditory tags can be tried when the user explicitly
  asks for that delivery and the tag describes how the voice should sound, not
  a visual action. Write tags directly in \`text\`, close to the short phrase
  they should affect. Treat tags as local guidance, not paragraph-wide controls.
- For pauses and pacing in \`eleven_v3\`, use punctuation, text structure,
  shorter generated segments, or local audio tags such as \`[short pause]\` and
  \`[slowly]\` when needed.

\`\`\`ts
// English / multilingual via ElevenLabs
submit_voice({
  provider: "elevenlabs",
  text: "Hello world",
  voiceId: "peter",
});

// Chinese via Doubao
submit_voice({
  provider: "doubao",
  text: "你好世界",
  voiceId: "liuchang",
});

// With speed adjustment (Doubao only)
submit_voice({
  provider: "doubao",
  text: "这是一段稍快的中文旁白。",
  voiceId: "liuchang",
  speedRatio: 1.5,
});

// With expressive Doubao controls
submit_voice({
  provider: "doubao",
  text: "这次事故提醒我们，安全永远不能侥幸。",
  voiceId: "liuchang",
  emotion: "sad",
  emotionScale: 3,
  performancePrompt: "痛心但克制，语速稍慢，像新闻专题旁白",
  pitch: -1,
  speedRatio: 0.92,
});

// With ElevenLabs delivery controls
submit_voice({
  provider: "elevenlabs",
  text: "The launch changed how teams plan their daily work.",
  voiceId: "peter",
  speed: 0.95,
  stability: 0.4,
  similarityBoost: 0.8,
  outputFormat: "wav_44100",
});

// MiniMax TTS (when configured) — see references/minimax-tts.md
submit_voice({
  provider: "minimax",
  text: "欢迎使用视频编辑助手。",
  voiceId: "female-yujie",
  speed: 1,
  name: "VO · welcome",
});
\`\`\`

## Voice Audition Before Generation

When the user needs TTS and has not already chosen a concrete preset, treat
broad words like "middle-aged male", "warm female", or "professional" as
requirements for filtering candidate voices.

Before recommending, rendering, or submitting any TTS voice option, read
[references/voices.md](references/voices.md). Use that file as the preset
source for preset ids / \`voiceId\`, provider choice, display labels, tags, and
sample URLs. Do not create voice options from memory, translated names, or
broad user descriptions.

First determine two separate languages:

- User conversation language: the language the user used to talk to you. Use
  this for the surrounding reply, \`form-visual label\`, \`visual-option name\`,
  and \`summary\`.
- Target narration language: the language of the text being synthesized. Use
  this only to choose provider and voice catalog.

The audition widget's submit button is fixed to the default label in this build
(\`submitLabel\` is accepted but not rendered); keep the question label and option
labels in the user conversation language, not the target narration language. For example:
English users see \`submit_label="Submit"\`, Chinese users see
\`submit_label="提交"\`, and Spanish users see \`submit_label="Enviar"\`.

"help me generate ... voice over in Chinese" is an English conversation asking
for Chinese narration, so the audition widget copy stays in English while the
voice candidates come from Doubao.

Instead:

1. Filter \`references/voices.md\` by target narration language / provider and
   the user's explicit requirements such as gender, age range, tone, and use
   case.
2. If no preset matches all explicit requirements, say there is no exact match
   and offer the closest supported presets with a clear caveat.
3. Pick 2-4 matching curated presets.
4. Load \`widget-forms\`, then call \`ask_followup_questions\` with voice options
   and audio samples.
5. Wait for the user to choose.
6. Call \`submit_voice\` with the selected preset id as \`voiceId\`.

For each audition option, keep \`value\`, display label, \`media\`, and \`summary\`
tied to the same preset row from \`references/voices.md\`. Use \`sample=\` URLs
from the \`submit_voice\` \`voiceId\` guide. They are editor static files under
\`/voice-samples/...\`. Keep \`value\` as the preset id and \`media\` as the matching
sample URL. Write \`name\` and \`summary\` in the user's conversation language. The
target narration language only decides the provider/voice catalog. For example,
if the user asks in English for a Chinese voiceover, keep the widget copy in
English and use English-friendly voice names/tags. If the user's message itself
is Chinese, use Chinese widget copy and Doubao's official Chinese display
names. For known \`/voice-samples/...\` presets, the editor can fill display text
only when \`name\`/\`summary\` are omitted; authored widget text is the normal path
for arbitrary languages. After the user submits, map the submitted display name
back to the preset id from the same candidate list.

English request for Chinese narration:

\`\`\`html
<widget submit_label="Submit">
  <form-visual
    id="voiceId"
    label="For Chinese voiceover, I recommend a few voices to try:"
    required="true"
  >
    <visual-option
      value="vivi"
      name="Vivi"
      media="/voice-samples/doubao-vivi.mp3"
      aspect-ratio="16:5"
      summary="Female / young / friendly, general"
    />
    <visual-option
      value="xiaohe"
      name="Xiaohe"
      media="/voice-samples/doubao-xiaohe.mp3"
      aspect-ratio="16:5"
      summary="Female / young / soft, clear"
    />
    <visual-option
      value="yunzhou"
      name="Yunzhou"
      media="/voice-samples/doubao-yunzhou.mp3"
      aspect-ratio="16:5"
      summary="Male / young / neutral, business"
    />
  </form-visual>
</widget>
\`\`\`

Chinese request for Chinese narration:

\`\`\`html
<widget submit_label="提交">
  <form-visual
    id="voiceId"
    label="我推荐这几个中文旁白音色，先试听一下："
    required="true"
  >
    <visual-option
      value="morgan"
      name="Morgan"
      media="/voice-samples/doubao-morgan.mp3"
      aspect-ratio="16:5"
      summary="男 / 中年 / 低沉知识解说"
    />
    <visual-option
      value="zhixingnv"
      name="知性女声"
      media="/voice-samples/doubao-zhixingnv.mp3"
      aspect-ratio="16:5"
      summary="女 / 中年 / 冷静知识讲解"
    />
    <visual-option
      value="vivi"
      name="Vivi"
      media="/voice-samples/doubao-vivi.mp3"
      aspect-ratio="16:5"
      summary="女 / 年轻 / 亲切通用口播"
    />
  </form-visual>
</widget>
\`\`\`

## Sound Effects

For ordinary editing sound effects (SFX), do **not** generate first. Use the
built-in Sound Effects library before generating:

1. Call \`browse_library\` with \`category:"sound-effects"\` and a query such as
   \`"whoosh"\`, \`"camera shutter"\`, \`"notification"\`, \`"censor beep"\`, or
   \`"record scratch"\`.
2. Inspect the returned \`library:sound:<id>\`.
3. Place it with \`edit_item\`, using \`fromFrame\` as the sound's
   anchor/editorial moment frame:

\`\`\`ts
browse_library({
  category: "sound-effects",
  query: "short whoosh transition",
});

edit_item({
  adds: [
    {
      type: "audio",
      assetId: "library:sound:whoosh-short",
      fromFrame: 120,
      trackId: "A1",
    },
  ],
});
\`\`\`

Only generate sound effects from text descriptions with \`submit_sound\` when:

- The user explicitly asks for a generated/original/custom sound.
- The requested sound is too specific for the existing Sound Effects library.
- \`browse_library({ category:"sound-effects", query })\` returns no suitable
  match.

\`\`\`ts
// Custom/generated sound effect after the library has no suitable match
submit_sound({ prompt: "A dog barking in the distance" });

// With custom duration (0.5-22 seconds)
submit_sound({
  prompt: "Thunder and heavy rain",
  durationSeconds: 15,
});

// High prompt adherence
submit_sound({
  prompt: "Sci-fi laser gun firing",
  promptInfluence: 0.8,
});
\`\`\`

**Tips for better results:**

- Be specific: "A dog barking loudly" vs just "dog"
- Include context: "Footsteps on wooden floor in an empty room"
- Specify style: "Cinematic whoosh" or "8-bit game sound"

## Parameters

### TTS

| Field        | Description                            | Notes           |
| ------------ | -------------------------------------- | --------------- |
| \`provider\`   | TTS provider: \`doubao\`, \`elevenlabs\`, or \`minimax\` | Required |
| \`text\`       | Text to synthesize                     | Required        |
| \`voiceId\`    | Curated preset id or provider voice id | Required        |
| \`speedRatio\` | Speech speed                           | Doubao only     |
| \`modelId\`    | ElevenLabs model id                    | ElevenLabs only |
| \`stability\`  | ElevenLabs stability                   | ElevenLabs only |
| \`speed\`      | ElevenLabs speech speed                | ElevenLabs only |
| \`name\`       | Asset name                             | Optional        |

### Sound Effects

| Field             | Description       | Notes          |
| ----------------- | ----------------- | -------------- |
| \`prompt\`          | Sound description | Required       |
| \`durationSeconds\` | Duration          | 0.5-22 seconds |
| \`promptInfluence\` | Prompt adherence  | 0-1            |
| \`name\`            | Asset name        | Optional       |

## Voices

Use the \`submit_voice\` \`voiceId\` guide and
[references/voices.md](references/voices.md) for the current curated preset
list, display labels, tags, and sample URLs.

### Voice presets are provider-specific — do NOT mix them

ElevenLabs, Doubao, and MiniMax have separate voice catalogs. \`vivi\` / \`dayi\`
are only Doubao; \`mark\` / \`amelia\` / \`james\` are only ElevenLabs; MiniMax system
voices (e.g. \`female-yujie\`) are only for \`provider: "minimax"\`.

If you need a specific voice and a particular language:

- For Chinese narration -> prefer \`provider: "doubao"\` (or \`minimax\` when that
  is the configured / requested vendor) with a matching catalog voiceId.
- For English / multilingual -> use \`provider: "elevenlabs"\` and an ElevenLabs
  preset.
- Only offer a provider that is **configured** (capabilities prompt).

## Hard rules — what you must NOT do

1. Never use a voice preset name from a different provider.
2. Never submit TTS when the voice is only described broadly and the user has
   not confirmed a concrete preset.
3. Never recommend or render a TTS voice option before checking
   [references/voices.md](references/voices.md).
4. Never claim stable age, regional accent, pronunciation dictionary, or exact
   duration controls; the current tool does not expose those as reliable fields.
5. Never replace original recorded speech with TTS unless the user asks.
`,M='# MiniMax TTS (`provider: "minimax"`)\n\nRead this before `submit_voice({ provider: "minimax", … })`.\n\nGrounded in OpenChatCut’s voice tool + server adapter (`server/plugins/voice.ts` → MiniMax `t2a_v2`). Preset table: [voices.md](voices.md) § MiniMax.\n\n## Capabilities (as wired)\n\n| Dimension | Value |\n| --- | --- |\n| Provider arg | `minimax` |\n| Text | Required |\n| `voiceId` | System/raw/cloned MiniMax id; defaults to `female-yujie`. Must be empty when using `timbreWeights` |\n| `speed` | Optional, **0.5–2** (default 1) → `voice_setting.speed` |\n| `pitch` | Optional, **-12–12** (default 0) → native `voice_setting.pitch` |\n| `volume` | Optional, **>0–10** (default 1) → `voice_setting.vol` |\n| `emotion` | Optional: happy, sad, angry, fearful, disgusted, surprised, calm, fluent, whisper |\n| Audio settings | sampleRate; mp3/pcm/flac/wav/pcmu/opus; channel. `bitrate` is MP3-only |\n| Streaming | `stream`; `excludeAggregatedAudio`; `forceCbr` only with streamed MP3. OpenChatCut still persists one local asset |\n| Language/text | languageBoost, textNormalization, latexRead, pronunciation tone entries |\n| Voice composition | timbreWeights (1–4 voices, weights 1–100), voiceModify pitch/intensity/timbre/effect |\n| Subtitle | `subtitleEnable` + sentence/word/word_streaming; downloaded as a durable JSON sidecar |\n| Placement | **Media pool only** — does not place on the timeline |\n\n## When to use\n\n- MiniMax key is configured and the user wants MiniMax TTS.\n- User named MiniMax speech (as distinct from Doubao / ElevenLabs).\n- Only MiniMax voice capability is on.\n\n## When not to use\n\n- Need Doubao dialect / `performancePrompt` → `doubao`\n- Need ElevenLabs multilingual catalog → `elevenlabs`\n- User has not picked a voice → offer candidates from [voices.md](voices.md) first\n\n## Tool shape\n\n```ts\nsubmit_voice({\n  provider: "minimax",\n  text: "……",\n  voiceId: "female-yujie",\n  speed: 1,\n  pitch: 0,\n  volume: 1,\n  emotion: "calm", // optional\n  sampleRate: 44100,\n  audioFormat: "wav",\n  languageBoost: "Chinese",\n  subtitleEnable: true,\n  subtitleType: "word",\n  pronunciations: ["OpenChatCut/(open chat cut)"],\n  voiceModify: { intensity: 10, effect: "spacious_echo" },\n  name: "VO · intro",\n});\n```\n\nThen place with `edit_item` only if the user wants it on a track.\n\n## Rules\n\n- Never mix MiniMax `voiceId` values with `provider: "doubao"` or `"elevenlabs"`.\n- Confirm a concrete `voiceId` before submit, except for a deliberate `timbreWeights` mix (empty `voiceId`).\n- `voiceModify` supports non-streaming mp3/wav/flac or streaming mp3 only.\n- `word_streaming`, `excludeAggregatedAudio`, and streamed `forceCbr` require `stream: true`.\n- `textNormalization` and `latexRead` map inside official `voice_setting`; `latexRead` forces Chinese language boost.\n- Check capabilities: if MiniMax voice is off, say which key is missing.\n',N=`# Voiceover Video Sync

Use this reference from the \`voice\` skill when existing visuals drive narration
timing. The job is not just generating TTS; it is making the spoken meaning line
up with what is on screen.

## When to Use

- The user has an existing video, timeline, screen recording, slide animation,
  product demo, B-roll edit, MG explainer, or similar visual sequence.
- The user provides narration text, asks you to write narration, or asks to add,
  replace, redo, dub, or generate voiceover for that visual sequence.
- The timeline already has narration/voiceover and the user asks to trim, speed
  up, slow down, reorder, replace, or retime the visuals while keeping the
  existing voiceover aligned.
- The video has meaningful visual sections: slide changes, product states,
  screen steps, chart/data moments, scene cuts, action beats, or key visual
  events.

Do not wait for the user to explicitly ask for sync. If there is a visual target,
assume the narration should respect the visual content and pacing unless the user
only wants a standalone audio asset.

Do not use this as the main path for cutting original human speech. Use the
talking-head workflow for editing existing spoken content.

## Workflow

1. Read the project state and identify the exact visual target: timeline range,
   video asset, selected item, or full composition. If multiple candidates are
   plausible, ask which one should receive voiceover.
2. Check whether the conversation already contains a usable narration plan,
   storyboard, or script table. Treat it as a draft sync map, not as approved
   TTS input. Reuse it only when it names visual anchors and time ranges for the
   same current visual target. If the target changed, the table is missing
   visual evidence, or any boundary is only a guess, verify only the missing or
   uncertain boundaries instead of restarting the whole visual review.
3. Keep the sync map tied to the current visual state. If an edit changes where
   visual content appears after the map was made, mark the affected rows stale.
   Before placing or reusing voiceover, rebuild or patch those rows from the
   current timeline/asset state. Do not keep using old visual windows after a
   visual retiming edit.
4. Understand the visuals before generating audio. Use project reads, timeline
   screenshots, and \`view_asset_frames\` for source-frame sampling when needed.
   Segment the target by visible content changes, not by arbitrary equal
   intervals.
5. Build a visual-voiceover sync map from actual visual evidence. Do not
   generate TTS or place voiceover until every segment has a confirmed visual
   anchor and placement start frame/time. For each segment, record:
   - visual start/end frame or time
   - visual anchor: slide title, product state, screen action, chart/data point,
     scene content, or event
   - evidence: inspected frame/time, screenshot, or visual-analysis result
   - narration text assigned to that visual moment
   - target duration and estimated TTS duration
   - fit status: fits / too long / uncertain
   - voiceover placement start frame or time
   - confidence or uncertainty
6. Split or write narration to fit the visual map. Keep each TTS segment tied to
   one visual segment or one intentional multi-shot beat. Do not create one long
   audio file for a video with multiple visual states. Before submitting TTS,
   map each narration line to a visual segment and check that the estimated TTS
   duration is plausibly short enough for its visual window. For short windows,
   prefer phrase-length copy over full sentences. Do not submit TTS for a line
   whose fit status is \`too long\` or \`uncertain\` until you tighten the wording,
   split the line, adjust supported speed, or ask the user to approve the timing
   tradeoff.
7. Follow the \`voice\` skill's audition workflow if the user has not picked a
   voice. Generate TTS per mapped segment.
8. After each TTS segment finishes, read the real audio duration before placing
   it. If the real duration exceeds its visual window or would make the
   narration describe a visual that is not currently on screen, do not place it
   on the timeline yet. Fix the mismatch before final delivery:
   - tighten or split narration
   - adjust speech speed when supported and natural
   - shift the placement to a better visual range
   - extend or hold a visual only when that preserves the edit
   - ask the user when the tradeoff changes meaning or style
9. Place each voiceover segment only after the actual-duration fit check passes.
   Place it at the matching visual start time from the current sync map. If
   original audio, music, or sound effects exist, decide whether to mute, duck,
   replace, or mix them based on user intent.
10. After patching or rebuilding stale rows, read back the updated timeline
    positions before claiming the edit is done. Confirm that caption text, spoken
    content, visual segment, placement, and actual audio duration still
    correspond.
11. Run a final coverage check before delivery. Every visual segment the user
    expected to be explained should either have matching voiceover or an explicit
    reason for silence. Voiceover should not start before its visual appears, and
    old voiceover should not remain over footage whose timing changed. If the
    turn changed any narration-backed visual timing, include a \`Final sync check\`
    in the response before saying the edit is complete.
12. Verify after placement. Read back item start/end/duration and inspect
    representative frames around each segment start, middle, and end. Preview or
    screenshot enough of the timeline to confirm the spoken meaning and current
    visual information match.

## Rules

- Do not drop a single generated narration track over a multi-section video and
  call it done.
- Do not let a TTS segment talk about a visual that has already disappeared or
  has not appeared yet.
- Do not rewrite user-provided narration in a way that changes claims, names,
  numbers, or intended meaning just to fit timing. Ask or preserve meaning.
- Do not cover meaningful original speech unless the user asked to replace,
  dub, mute, or voice over it.
- Do not treat slide/video length as enough evidence. Use visible anchors and
  content changes.
- Do not treat a script table or narration draft as ready-to-submit TTS input
  until each line has been mapped to a visual segment and checked against that
  segment's target duration.
- Do not use equal division or rough duration estimates as placement
  boundaries. If a boundary is only estimated, inspect more frames around that
  range until the content-change frame is confirmed, or ask the user to approve
  the approximation.
- Do not silently switch from visual-driven sync to narration-driven timing.
  That changes the edit contract. Ask the user before extending visuals,
  allowing desync, overlapping voiceover, or letting narration timing drive the
  cut.
- Do not treat a generated TTS asset as ready for placement just because it
  completed successfully. Real audio duration must pass the sync map's fit check
  first.
- Do not reuse a sync map after timeline or visual-source edits changed where
  visual content appears. Patch or rebuild the affected rows first.
- Do not report completion until expected voiceover coverage has been checked
  against the current timeline.
- Do not end a retiming turn immediately after timeline edits. First read back
  the updated item positions and report a \`Final sync check\` for each changed
  visual/voiceover pair.

## Output Format

When planning or reporting execution, use this compact shape:

- \`target_visual\`: asset/item/timeline range
- \`segments\`: visual range, visual anchor, narration text, TTS asset, audio
  duration, target duration, estimated duration, fit status, placement range,
  mismatch handling, map status
- \`mix\`: what happened to original audio/music
- \`Final sync check\`: pass/fail per segment, stale-map fixes, coverage gaps, and
  any timing fixes applied
`,P="# Voice Presets\n\nThis page is the curated preset snapshot the agent works from. The backend\nholds the source of truth and keeps this file in sync.\n\nUse tags as selection filters. Use descriptions as practical hints. Age,\naccent, pronunciation, and exact duration are not stable controls unless the\nTTS provider exposes explicit parameters for them.\n\n## Doubao Chinese Voices\n\nUse Doubao for Chinese-optimized narration.\n\n| Preset               | Official display | English display      | Tags                                                           | Selection hint                                                |\n| -------------------- | ---------------- | -------------------- | -------------------------------------------------------------- | ------------------------------------------------------------- |\n| `vivi`               | Vivi             | Vivi                 | female, young, friendly, general, short-explainer              | Everyday Chinese narration, product intros, short explainers  |\n| `xiaohe`             | 小何             | Xiaohe               | female, young, soft, calm, tutorial, walkthrough               | Calm tutorials, product walkthroughs, instructional narration |\n| `yunzhou`            | 云舟             | Yunzhou              | male, young, neutral, business, explainer                      | Business explainers, factual reads, product narration         |\n| `xiaotian`           | 小天             | Xiaotian             | male, young, bright, upbeat, casual                            | Casual creator-style videos and light social narration        |\n| `naiqimengwa`        | 奶气萌娃         | Childlike Boy        | male, child, cute, storybook, character                        | Cute boy character lines and children's stories               |\n| `yingtaowanzi`       | 樱桃丸子         | Cherry Voice         | female, child, cartoon, roleplay, character                    | Animated/kid-oriented character dialogue                      |\n| `wenroumama`         | 温柔妈妈         | Warm Mom             | female, middle-aged, warm, family, gentle                      | Family, lifestyle, parenting, gentle explanations             |\n| `zhixingnv`          | 知性女声         | Knowledgeable Female | female, middle-aged, calm, knowledge, explainer                | Education, culture, thoughtful explainers                     |\n| `dayi`               | 大壹             | Dayi                 | male, young, steady, formal, documentary, video-voiceover      | Formal voiceover, documentary, corporate narration            |\n| `jitangnv`           | 鸡汤女           | Inspirational Female | female, young, warm, inspirational, emotional, video-voiceover | Motivational, uplifting, emotional video narration            |\n| `liuchang`           | 流畅女声         | Smooth Female        | female, young, smooth, polished, video-voiceover, narration    | Clean product narration and polished video voiceover          |\n| `ruyayichen`         | 儒雅逸辰         | Yichen               | male, young, elegant, premium, culture, video-voiceover        | Cultural, premium, poetic, documentary-style narration        |\n| `morgan`             | Morgan           | Morgan               | male, middle-aged, deep, knowledge, explainer                  | Deep knowledge explainer, documentary, serious narration      |\n| `qingcang`           | 擎苍             | Qingcang             | male, old-like, authoritative, audiobook, character            | Weighty narration, dramatic reads, audiobook scenes           |\n| `huiben`             | 儿童绘本         | Storybook Voice      | female, young, gentle, storybook, audiobook                    | Gentle storybook or bedtime-style narration                   |\n| `popo`               | 婆婆             | Grandma              | female, old, warm, story, character                            | Grandmother characters, folk stories, nostalgic narration     |\n| `yuanboxiaoshu`      | 渊博小叔         | Erudite Uncle        | male, middle-aged, knowledge, calm, explainer                  | Calm explainers, cultural commentary, educational narration   |\n| `baqiqingshu`        | 霸气青叔         | Confident Uncle      | male, middle-aged, confident, audiobook, narrative             | Audiobook narration, long-form stories, dramatic reads        |\n| `shuanglangshaonian` | 爽朗少年         | Cheerful Teen        | male, young, cheerful, youthful, roleplay, character           | Bright roleplay, teen/creator dialogue, youthful scenes       |\n| `tangseng`           | 唐僧             | Tang Seng            | male, old-like, calm, roleplay, character                      | Monk-like dialogue, traditional stories, steady narration     |\n\nImportant caveat: the current Doubao seed-tts-2.0 resource does not expose an\nexplicit general-purpose old-male voice. `qingcang` and `tangseng` are\nold-like approximations, not guaranteed old-male controls.\n\n### Doubao Control Support\n\nBase controls for curated Doubao voices: `speedRatio`, `loudnessRatio`, and\n`pitch`.\n\nExpressive controls:\n\n- Supports `emotion`, `emotionScale`, `performancePrompt`, and ASMR-style prompt\n  directions: `vivi`, `xiaohe`, `yunzhou`, `xiaotian`, `naiqimengwa`,\n  `yingtaowanzi`, `wenroumama`, `zhixingnv`, `dayi`, `jitangnv`, `liuchang`,\n  `ruyayichen`, `morgan`, `qingcang`, `huiben`, `popo`, `yuanboxiaoshu`,\n  `baqiqingshu`, `tangseng`.\n- `shuanglangshaonian` supports `performancePrompt` and COT/QA-style\n  instruction following only. Do not use `emotion`, `emotionScale`, or\n  ASMR-style prompt directions with this voice.\n- `explicitDialect` is only supported by `vivi`; allowed values are `dongbei`,\n  `shaanxi`, and `sichuan`.\n\n## ElevenLabs English / Multilingual Voices\n\nUse ElevenLabs for English or multilingual narration. Official accent labels\nare English-source voice cues, not target-language accent controls.\n\n| Preset      | Tags                                                       | Selection hint                                             |\n| ----------- | ---------------------------------------------------------- | ---------------------------------------------------------- |\n| `amelia`    | female, young, upbeat, narrative-story, social-media       | Story reads, podcast intros, reels, enthusiastic ads       |\n| `brittney`  | female, young, upbeat, social-media, fun                   | Creator videos, recaps, hot-topic commentary, how-to clips |\n| `hope`      | female, young, upbeat, clear, social-media                 | Crisp short-form narration and quick explainers            |\n| `jessica`   | female, middle-aged, calm, conversational, narrative-story | Composed narration, confident product copy, direct reads   |\n| `arabella`  | female, young, gentle, emotive, narrative-story            | Fantasy, romance, wellness, atmospheric stories            |\n| `jane`      | female, old, professional, audiobook, narrative-story      | Long-form book pacing and classic narration                |\n| `maria`     | female, old, calm, grandmother, narrative-story            | Grandmother-style narration and reflective story delivery  |\n| `mark`      | male, young, casual, conversational, natural               | Dialogue, assistant-style replies, informal scripts        |\n| `frederick` | male, middle-aged, calm, documentary, narrative-story      | History, science, mystery, factual films                   |\n| `peter`     | male, middle-aged, confident, credible, narrative-story    | Trustworthy narration, explainers, brand reads             |\n| `james`     | male, middle-aged, deep, husky, narrative-story            | Audiobooks, heavier story narration, professional VO       |\n| `jon`       | male, middle-aged, calm, grounded, narrative-story         | Clear messaging, commercials, trustworthy narration        |\n| `sully`     | male, old, deep, storyteller, narrative-story              | Deep elderly narration and warm authoritative reads        |\n| `david`     | male, old, deep, storyteller, narrative-story              | Classic audiobook passages and grounded dramatic reads     |\n| `alex`      | male, young, confident, entertainment-tv, social-media     | YouTube, shorts, entertainment clips                       |\n\n### ElevenLabs Control Support\n\nAll current curated ElevenLabs presets support the same request-level controls:\n`modelId`, `speed`, and `stability`.\n\nImportant limits:\n\n- These controls are provider/model-level controls, not per-voice capability\n  switches. No current curated ElevenLabs preset is excluded from them, but the\n  audible result varies by the source voice's natural delivery.\n- For ElevenLabs `eleven_v3`, inline audio tags are available when the user\n  asks for expressive delivery such as emotion, tone, nonverbal cues, accent\n  hints, or local pacing. Official examples fit these useful TTS categories:\n  emotion/tone tags such as `[happy]`, `[sad]`, `[angry]`, `[excited]`,\n  `[curious]`, `[sarcastic]`, `[crying]`, `[annoyed]`, `[appalled]`,\n  `[thoughtful]`, `[surprised]`, and `[mischievously]`; vocal delivery and\n  nonverbal cue tags such as `[whispers]`, `[laughs]`, `[sighs]`, `[exhales]`,\n  `[inhales deeply]`, `[clears throat]`, `[snorts]`, `[swallows]`,\n  `[wheezing]`, and `[coughs]`;\n  pacing/pause/local speed tags such as `[slowly]`, `[pause]`,\n  `[short pause]`, `[long pause]`, `[rushed]`, and `[drawn out]`; and\n  accent/special-performance tags such as\n  `[strong X accent]`, for example `[strong French accent]`, plus `[sings]`,\n  `[singing]`, `[woo]`, and `[pirate voice]`. Official examples are\n  non-exhaustive; similar auditory tags can be tried when the user explicitly\n  asks for that delivery and the tag describes how the voice should sound, not\n  a visual action. Write tags directly in `text`, close to the short phrase\n  they should affect. Treat tags as local guidance, not paragraph-wide controls.\n- For pauses and pacing in `eleven_v3`, use punctuation, text structure,\n  shorter generated segments, or local audio tags such as `[short pause]` and\n  `[slowly]` when needed.\n\n## MiniMax Chinese Voices\n\nUse MiniMax when that vendor is configured and the user wants MiniMax TTS\n(or Doubao/ElevenLabs are off). Pass `provider: \"minimax\"` and a system\n`voiceId` (or a cloned voice id from the user's MiniMax account).\n\n| Preset | Tags | Selection hint |\n| --- | --- | --- |\n| `female-yujie` | female, adult, clear, default, narration | Default MiniMax system voice; product / general narration |\n| `female-shaonv` | female, young, bright, casual | Youthful / light social reads |\n| `female-chengshu` | female, mature, calm, professional | Mature professional narration |\n| `female-tianmei` | female, sweet, soft, lifestyle | Softer lifestyle / gentle product lines |\n| `male-qn-qingse` | male, young, clear, neutral | Everyday male Chinese narration |\n| `male-qn-jingying` | male, adult, steady, business | Business / confident explainer tone |\n\nSee [minimax-tts.md](minimax-tts.md) for tool knobs (`speed`, `emotion`).\n\n### MiniMax Control Support\n\n- `speed` roughly `0.5–2` (server enforces range).\n- Optional `emotion` labels when the model accepts them: happy, sad, angry,\n  fearful, disgusted, surprised, calm, fluent, whisper.\n- Do **not** pass Doubao-only fields (`speedRatio`, `performancePrompt`,\n  `explicitDialect`, …) or ElevenLabs-only fields (`modelId`, `stability`).\n\n## Audition Samples\n\nEach curated preset has a local editor sample under:\n\n```text\n/voice-samples/<provider>-<preset>.mp3\n```\n\nExamples:\n\n- `/voice-samples/doubao-morgan.mp3`\n- `/voice-samples/doubao-zhixingnv.mp3`\n- `/voice-samples/elevenlabs-peter.mp3`\n- `/voice-samples/elevenlabs-sully.mp3`\n\nPrefer these samples when rendering a voice audition widget before calling\n`submit_voice`. MiniMax system voices may not ship local samples; offer by\nname/tags and confirm before `submit_voice`.\n",F=`---
name: widget-forms
description: Use when the agent should ask the user for structured input with an in-chat form, including single-select, multi-select, text fields, style pickers, or voice audition choices.
---

# Widget Forms

Use the form tool instead of hand-writing markup: the editor chat renders the
form as an interactive card and returns the user's structured answer.

## Runtime Rule

Call \`ask_followup_questions\`. It serializes your fields into the editor's
native form card; the user's submission comes back as their next message.

Plan the whole questionnaire before calling the tool. Send one final form, not a
trial form followed by a corrected form. The tool supports at most 12 fields; if
the user asks for more questions, merge related prompts into combined fields
before the first call.

After calling \`ask_followup_questions\`, stop the turn and wait for the submitted
answer to appear in chat. Do not apply a choice, create assets, or continue
planning from a recommendation until the user's selection is present in the
conversation.

## Supported Field Mapping

Build a \`fields\` array. Write every visible string in the user's conversation
language.

- Native \`<form-single>\` -> \`{ type: "single", variant: "default" }\`
- Native \`<form-multi>\` -> \`{ type: "multi", variant: "default" }\`
- Native \`<form-text>\` / \`<form-textarea>\` -> \`{ type: "text" }\`
- Native \`<form-visual>\` -> \`{ type: "single", variant: "visual" }\`
- Voice audition cards -> \`{ type: "single", variant: "voice" }\`
- Native start-scenario cards -> \`{ type: "single", variant: "scenario" }\`

## Form Copy Tone

For form-level text (\`title\`, \`prompt\`, \`fields[].label\`, \`submitLabel\`, and
\`messagePrefix\`), write like OpenChatCut is a capable video-making partner inviting
the user to describe what they want, not like a rigid survey.

Aim for:

- Warm, open-ended, and action-oriented. The copy should imply "choose the
  closest video need or just tell me your idea; we can figure it out together."
- Short and scannable. Use one natural sentence for \`prompt\` and concise
  question labels.
- Honest capability framing. OpenChatCut can help with many video workflows, but do
  not claim unsupported abilities or guarantee a result before inputs are known.
- The user's language and local product terms. Keep "OpenChatCut", "B-roll",
  "Motion Graphics", "MG 动画", model/product names, and platform names in their
  established forms.
- User-facing creative wording. For early planning or creative-intake forms,
  prefer natural terms such as idea, direction, plan, story, shot list, audience,
  mood, or video need over internal production-document language.

Avoid stiff labels such as "Select video type", "Please choose the video type
for this project", or "What type of video do you want to make?" for scenario
intake unless the host has no room for warmer copy.

For a scenario-intake form, prefer copy like:

\`\`\`json
{
  "title": "What do you want to make?",
  "prompt": "Choose the closest video scenario, or choose Something else and describe your idea.",
  "submitLabel": "Start creating",
  "messagePrefix": "I want to start with this video direction:",
  "fields": [
    {
      "id": "scenario",
      "label": "Which scenario fits your video best?",
      "type": "single",
      "variant": "scenario",
      "otherPlaceholder": "For example: turn my travel footage into an atmospheric vlog / make a launch video for a new product"
    }
  ]
}
\`\`\`

Do not include file-upload questions in forms. If a task actually needs
source media and the project/chat does not already have it, ask the user
separately to upload files in the editor (drag & drop or the upload button, or
paste into the chat composer). File upload is not a default prerequisite for every
questionnaire; only ask for it when the next editing step depends on missing
media.

For choice fields:

- Use \`id\` for the internal value the next tool call needs.
- Use \`label\` for what the user sees.
- For ordinary single-select and multi-select cards (\`variant: "default"\`), keep
  options label-only. Do not add per-option \`description\` unless the user cannot
  distinguish the choices from labels alone.
- Use \`description\` mainly for voice cards. Visual style cards should usually
  use only \`preview\` + \`label\`.
- When an off-list answer is acceptable, add an explicit option with
  \`id: "__other__"\` and a \`label\` in the same language as the rest of the form,
  using the word the user would expect for an off-list answer. The widget will
  turn this option into a text entry when selected. Use \`otherPlaceholder\` if
  the text entry needs a placeholder.

For visual cards:

- Use real image URLs or data image URLs in \`preview\`.
- For Design Style catalog choices, call \`manage_design_style\` with
  \`action: "list"\` first, then map each returned preset to
  \`{ id: preset.presetId, label: preset.name }\` (no thumbnails in this build).
- Never hardcode catalog preset ids unless the user already selected one.

For voice cards:

- Use \`audioUrl\` for the sample file.
- Prefer the documented sample path such as \`/voice-samples/doubao-liuchang.mp3\`
  or a public HTTPS URL. Do not pass localhost sample URLs; MCP host iframes do
  not reliably resolve editor-local media.
- Keep user-visible descriptions provider-neutral. Describe the voice the same
  way the native OpenChatCut audition UI does: gender / age range / tone / use case,
  such as \`Female / young / friendly, general\` or \`男 / 中年 / 低沉知识解说\`.
  Do not show provider names like ElevenLabs or Doubao in option descriptions.
- Keep the option \`id\` equal to the provider voice id needed by \`submit_voice\`.

For native start-scenario cards:

- Use this when the user should choose which OpenChatCut video workflow to start,
  such as talking-head editing, MG animation, long-video-to-shorts,
  product/app promo, AI short film, or explainer video.
- Present these as common video needs/scenarios, not as the only possible video
  workflows. The form must also let the user describe a different video need.
- Use exactly one single-select field with \`variant: "scenario"\`.
- Provide options using the canonical ids below and localized labels in the
  user's language. Include \`id: "__other__"\` only when you need to customize the
  off-list label; otherwise the backend appends a localized Other option.
- English, Chinese, and Spanish scenario labels/descriptions/starter prompts are
  built in. For any other user language, faithfully translate each scenario's
  English \`label\`, \`description\`, and starter prompt into the user's language
  and pass those localized values in the option objects. Preserve OpenChatCut
  product terms and workflow meaning; do not add new requirements. Use
  \`submitPrompt\` for the translated starter prompt. This override is specific to
  \`variant: "scenario"\`; ordinary option cards, voice cards, and visual style
  cards already get their visible text from the values you pass.
- Do not provide custom \`preview\` or \`audioUrl\`; the backend fills the native
  first-screen preview image.
- Canonical ids: \`talking-head\`, \`motion-graphics\`, \`long-video-to-shorts\`,
  \`app-promo\`, \`ai-cinematic-short-film\`, \`explainer\`, plus \`__other__\` for a
  free-form video need.
- Example options:
  \`{ "id": "talking-head", "label": "Talking Head Editing" }\`,
  \`{ "id": "motion-graphics", "label": "Motion Graphics" }\`,
  \`{ "id": "long-video-to-shorts", "label": "Long Video to Shorts" }\`,
  \`{ "id": "app-promo", "label": "Product / App Promo" }\`,
  \`{ "id": "ai-cinematic-short-film", "label": "AI Short Film" }\`,
  \`{ "id": "explainer", "label": "Explainer Video" }\`,
  \`{ "id": "__other__", "label": "Something else" }\`.

## Current Gaps

\`ask_followup_questions\` is for structured answers only. It does not support native
custom HTML, timeline parameter bridges, editor item selection, or file upload
fields. For files already held by the agent runtime or attached directly to the
chat outside this card, the media-import workflow is still valid: call
\`import_media\` and run the helper/direct upload path. For files the user wants
to place directly in a project, ask them to use the OpenChatCut editor upload UI.

## Example

\`\`\`json
{
  "title": "Your video idea",
  "prompt": "Choose or fill in what you have in mind so OpenChatCut can pick a good starting direction.",
  "submitLabel": "Send idea",
  "messagePrefix": "Continue with this video direction:",
  "fields": [
    {
      "id": "goal",
      "label": "What's the main goal of this video?",
      "type": "single",
      "options": [
        { "id": "product_intro", "label": "Product intro" },
        { "id": "social_ad", "label": "Social ad" },
        { "id": "__other__", "label": "Something else" }
      ]
    },
    {
      "id": "elements",
      "label": "What should it include? (Select all that apply)",
      "type": "multi",
      "options": [
        { "id": "broll", "label": "B-roll" },
        { "id": "logo", "label": "Brand logo" },
        { "id": "__other__", "label": "Something else" }
      ]
    }
  ]
}
\`\`\`
`,I=/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/;function L(e){let t=e.match(I);if(!t)return{name:``,description:``,body:e};let[,n,r]=t;return{name:R(n),description:z(n),body:r}}function R(e){let t=e.match(/^name:\s*(.*)$/m);return t?B(t[1].trim()):``}function z(e){let t=e.split(/\r?\n/),n=t.findIndex(e=>/^description:/.test(e));if(n<0)return``;let r=t[n].replace(/^description:\s*/,``);if(r.trim()===``||/^[|>][-+]?\s*$/.test(r.trim())){let e=[];for(let r=n+1;r<t.length;r+=1){let n=t[r];if(n.trim()===``){e.push(``);continue}if(!/^\s/.test(n))break;e.push(n.replace(/^\s+/,``))}return e.join(` `).replace(/\s+/g,` `).trim()}return B(r.trim())}function B(e){return e.length>=2&&(e.startsWith(`"`)&&e.endsWith(`"`)||e.startsWith(`'`)&&e.endsWith(`'`))?e.slice(1,-1):e}var V=Object.assign({"./asset-import/SKILL.md":e,"./create-motion-graphics/SKILL.md":t,"./create-motion-graphics/references/canvas-pipeline-rules.md":n,"./export/SKILL.md":r,"./image-gen/SKILL.md":i,"./image-gen/references/gpt-image-2.md":a,"./image-gen/references/image-01.md":o,"./image-gen/references/nano-banana.md":s,"./known-errors/SKILL.md":c,"./music/SKILL.md":l,"./music/references/minimax.md":u,"./music/references/mureka.md":d,"./openchatcut-plugin-basics/SKILL.md":f,"./product-help/SKILL.md":p,"./product-help/references/generation-capabilities.md":m,"./product-help/references/generation-official-docs.md":h,"./product-help/references/providers-and-keys.md":g,"./product-help/references/ui-and-features.md":_,"./shader-gen/SKILL.md":v,"./shader-gen/examples/cube-rotate.md":y,"./shader-gen/examples/door-open.md":b,"./shader-gen/examples/page-curl.md":x,"./shader-gen/references/design-principles.md":S,"./shader-gen/references/property-changes.md":C,"./talking-head-guide/SKILL.md":w,"./transcription/SKILL.md":T,"./verification/SKILL.md":E,"./video-gen/SKILL.md":D,"./video-gen/references/hailuo.md":O,"./video-gen/references/kling.md":k,"./video-gen/references/seedance2.md":A,"./voice/SKILL.md":j,"./voice/references/minimax-tts.md":M,"./voice/references/video-sync.md":N,"./voice/references/voices.md":P,"./widget-forms/SKILL.md":F}),H=e=>e.replace(/^\.\//,``).split(`/`)[0],U=Object.entries(V).filter(([e])=>e.endsWith(`/SKILL.md`)).map(([e,t])=>{let n=H(e);return{slug:n,files:Object.keys(V).filter(e=>H(e)===n&&!e.endsWith(`/SKILL.md`)).map(e=>e.replace(`./${n}/`,``)).sort(),...L(t)}}).sort((e,t)=>e.slug.localeCompare(t.slug));function W(e){return U.find(t=>t.slug===e)}function G(e,t){return t?V[`./${e}/${t.replace(/^\.\//,``)}`]:W(e)?.body}var K=[``,`# Skill library (load_skill on demand · 15 OpenChatCut SKILL.md files)`,`Each entry below describes when a skill applies. When a task matches one, call load_skill(name=…) to retrieve its full workflow before acting. For deeper material, pass file= (for example, "references/voices.md"). Load only relevant skills, not the entire library.`,`When a skill needs scripts, ffmpeg, node, or python, use run_code in the isolated sandbox: write files, run a command, then read outputs. The sandbox cannot access the timeline; use local editor tools to place resulting assets. For real media, pass a local /media/… or public https:// URL in files so the sandbox can fetch it for ffprobe/ffmpeg. Public URLs may also be passed directly to ffprobe.`,"The custom sandbox image includes ffmpeg. If an environment lacks it, install it first with: `which ffmpeg || (sudo apt-get update -qq && sudo apt-get install -y -qq ffmpeg)`.",...U.map(e=>`- **${e.slug}** — ${e.description}`)].join(`
`),q=[{name:`load_skill`,description:`Load the full verbatim guidance of one plugin skill (its SKILL.md) from the skill library listed in the system prompt. Call this when the task matches a skill's description, before doing the work. Pass file= to load a support doc under the skill instead of SKILL.md. Available skills: `+U.map(e=>e.slug).join(`, `)+`.`,input_schema:{type:`object`,properties:{name:{type:`string`,description:`Skill id, e.g. "talking-head-guide", "voice", "shader-gen".`},file:{type:`string`,description:`Optional support file under the skill (e.g. "references/voices.md"); omit to load SKILL.md.`}},required:[`name`]}}],J=new Set(q.map(e=>e.name));export{G as a,K as i,q as n,U as r,J as t};