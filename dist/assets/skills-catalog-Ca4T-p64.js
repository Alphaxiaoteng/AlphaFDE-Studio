var e=[{id:`11111111-1240-4000-8000-000000000004`,name:`Long Video to Shorts`,nameZh:`长视频转短视频`,summary:`把一条长播客、访谈、课程或直播剪成适合社媒发布的短视频和高光。`,scenarios:[`long-video-to-shorts`,`reels`,`tiktok`,`shorts`,`social-clips`,`highlight-reel`],body:`---
name: long-video-to-shorts
description: Cut one long podcast, interview, course, livestream, or other source video into social-ready shorts, reels, highlights, or clip timelines from existing project media. Use when the user asks to cut a long video into Shorts, Reels, TikToks, Xiaohongshu posts, best moments, highlights, or multiple clips.
---

# Long Video to Shorts

Use this workflow when one long source video carries the output. Supporting clips may exist, but the short-form story comes from selecting self-contained moments inside the long source.

This is a OpenChatCut-native workflow. Use the current project, assets, transcript, timeline, and OpenChatCut editing tools. Do not depend on external download, transcription, ffmpeg, or auto-crop pipelines unless the user explicitly asks for an external source that is not already in the project.

## Workflow

1. Read the project state before editing. Identify the primary long video, duration, language, speakers, current timeline, transcript readiness, visual descriptions, and aspect ratio.
2. Confirm that one long source carries the output. If the project is mainly multiple raw clips with no dominant long source, switch to the Multi Clips to Reels workflow.
3. Determine only missing constraints that would change the edit: platform, clip count, target duration, audience, style, captions/title text, music, and whether the user wants options or direct creation.
4. If more than one missing constraint remains, ask for them in one \`<widget>\` after loading \`widget-forms\`. Use text fields for open-ended fields like topic, spoken language, audience, or goals; use single/multi choice fields for bounded choices like platform, count, duration, captions, or music.
5. Use transcript ranges when available. If transcription is unavailable or unreliable, inspect visual/audio content and ask only for missing context that changes selection.
6. Scan for moments that can stand alone: clear setup, hook, claim, proof, emotional turn, lesson, conflict, demonstration, or payoff. Read [references/short-form-selection.md](references/short-form-selection.md) when scoring or comparing candidates.
7. Build a compact candidate plan before heavy editing. For each output include source range, opening hook, why it stands alone, payoff, target duration, platform treatment, and risks.
8. If the user gave enough constraints and asked to create directly, proceed after stating the plan. If the source is very long, the request is vague, or the requested count is high, create or preview the first strongest clip before batching the rest.
9. Cut on clean word, phrase, action, or beat boundaries. Tighten filler, false starts, repeated attempts, and dead time only when meaning and tone stay intact.
10. Package for the target platform: aspect ratio/crop, title text, styled captions, music, light motion graphics, zooms, speed changes, or transitions only when they support the selected moment.
11. QA before reporting done: hook in first seconds, clear payoff, standalone clarity, no misleading title, clean boundaries, platform fit, requested count/duration, timeline names, and export readiness.

## Plan Format

When presenting a plan, use this compact shape:

- Clip number/title
- Source range
- Opening hook
- Why it stands alone
- Payoff or viewer value
- Target duration/platform treatment
- Edit notes and risks

When creating clips, report timeline names, durations, packaging applied, assumptions, and what to review first.

## Rules

- Preserve claims, speaker intent, context, and causality. Do not make the speaker appear to say something they did not mean.
- Prefer the smallest range that preserves setup, meaning, and payoff.
- Do not summarize the whole long source evenly.
- Do not choose a quotable line if it needs missing context to make sense.
- Do not use misleading title text to compensate for a weak moment.
- Do not pad with weak clips just to hit the requested count.
- Do not treat a full talking-head polish request as Long Video to Shorts unless the user asks for shorts, clips, highlights, or cutdowns.
- Do not batch many shorts blindly. If the style is not established, create or preview the first strong clip before repeating it.`},{id:`11111111-1240-4000-8000-000000000012`,name:`Multi Clips to Reels`,nameZh:`多素材剪 Reels`,summary:`把产品、活动、旅行或游戏素材剪成适合社媒发布的 Reels。`,scenarios:[`multi-clips-to-reels`,`multi-clips-to-shorts`,`raw-clips`,`reels`,`tiktok`,`shorts`],body:`---
name: multi-clips-to-reels
description: Turn multiple product shots, event footage, travel clips, gameplay moments, UGC/product footage, B-roll, or mixed media into social-ready reels, highlights, recaps, or montage-style short videos from existing project media.
---

# Multi Clips to Reels

Use this workflow when multiple raw clips or assets carry the output. The task is to select, sequence, and package the strongest footage into one or more reels, highlights, recaps, or short videos.

This is a OpenChatCut-native workflow. Use the current project, source assets, asset-frame inspection, AV/script context, and OpenChatCut editing tools. Use the current timeline when it already contains relevant cuts or for final verification; do not depend on timeline screenshots as the primary way to understand raw source clips. Do not depend on external download, transcription, ffmpeg, or auto-crop pipelines unless the user explicitly asks for an external source that is not already in the project.

## Workflow

1. Read the project state before editing. Inventory usable source assets: duration, aspect ratio, visual subject, motion/energy, audio quality, duplicates, current timeline state when relevant, obvious hero shots, and fixed-role assets such as logos, QR codes, product photos, brand screenshots, or supplied audio.
2. Confirm that multiple clips carry the output. If one long source clearly defines the story and other assets are only support, switch to the Long Video to Shorts workflow.
3. Identify the user's starting point:
   - \`open_media_reel\`: uploaded clips/photos and a loose goal.
   - \`script_or_storyboard\`: supplied script, timestamps, shot list, scene notes, or exact copy.
   - \`asset_pack_promo\`: product/event/place assets with logos, screenshots, QR codes, audio, or brand constraints.
   - \`highlight_selection\`: many clips where the main work is selecting the strongest visual moments.
4. Determine only missing constraints that would change the edit: platform, output count, target duration, audience, style, captions/title text, music, and whether the user wants options or direct creation.
5. If more than one missing constraint remains, ask for them in one \`<widget>\` after loading \`widget-forms\`. Use text fields for open-ended fields like premise, audience, product/context, or goals; use single/multi choice fields for bounded choices like platform, count, duration, captions, or music.
6. Assign source assets a possible role: hook, context, proof, demonstration, emotional beat, transition, payoff, end card, logo/QR, product evidence, or audio bed. Do not assume every uploaded clip deserves screen time.
7. Match the planning style to the starting point. For \`script_or_storyboard\`, preserve the user's scene order, copy, timestamps, and claims while mapping each source asset to the requested shot. For \`asset_pack_promo\`, lock the product/place/event identity and reserve fixed-role assets for brand, proof, or CTA moments. For \`open_media_reel\` and \`highlight_selection\`, select and sequence the strongest moments instead of averaging every asset.
8. Compare possible hooks and sequences using [references/short-form-selection.md](references/short-form-selection.md). Use \`read_script\` for the speech/script overview, \`view_asset_frames\` for specific source frames and frame-block analysis to select high points or verify what happens on screen. Select for strength, variety, continuity, and fit to the requested platform.
9. Build a compact sequence plan before heavy editing. For each output include selected assets/ranges, opening hook, shot order, role of each shot, rhythm, target duration, platform treatment, and risks.
10. If the user gave enough constraints and asked to create directly, proceed after stating the plan. If the material is varied or the requested count is high, create or preview the first strongest reel before batching the rest.
11. Edit around a viewer-facing arc: hook, context, escalation or proof, payoff. For a pure highlight reel, the payoff can be the strongest final moment or a satisfying recap beat.
12. Package for the target platform: aspect ratio/crop, title text, styled captions, music/beat sync, light motion graphics, transitions, speed ramps, or zooms only when they improve rhythm or clarity.
13. QA before reporting done: strongest shot first, clear sequence purpose, distinct outputs, no unsupported claims, platform fit, requested count/duration, timeline names, and export readiness.

## Plan Format

When presenting a plan, use this compact shape:

- Clip/reel number/title
- Starting point: \`open_media_reel\`, \`script_or_storyboard\`, \`asset_pack_promo\`, or \`highlight_selection\`
- Selected source assets or ranges
- Source evidence used, such as \`read_script\`, source frames, or visual-analysis notes
- Opening hook visual or line
- Shot order and role of each shot
- Rhythm or sequence shape
- Target duration/platform treatment
- Edit notes and risks

When creating clips, report timeline names, durations, packaging applied, assumptions, and what to review first.

## Rules

- Start with the strongest visual or clearest promise. Do not slowly introduce every asset.
- Trim clips aggressively enough to maintain rhythm, but keep enough context for the sequence to make sense.
- Do not evenly sample every asset.
- Do not build a contextless montage when the user needs a clear reel, recap, or highlight.
- Do not repeat visually similar shots unless repetition creates rhythm or comparison.
- Do not use captions/title text to invent unsupported claims.
- Do not let packaging effects hide weak source selection.
- For multiple requested reels or short videos, create distinct angles instead of near-duplicate edits from the same footage.`},{id:`11111111-1240-4000-8000-000000000005`,name:`AI Cinematic Short Film`,nameZh:`AI 电影感短片`,summary:`规划并制作 AI 电影感短片，覆盖故事、镜头、提示词、连续性和最终检查。`,scenarios:[`ai-film`,`cinematic`,`seedance`,`story`,`short-film`,`video-generation`],body:`---
name: ai-cinematic-short-film
description: Plan AI short films with story, shots, prompts, and continuity.
---

# AI Cinematic Short Film

Use this workflow when the user wants OpenChatCut to create a cinematic AI-generated short film or story-led visual sequence.

This is a OpenChatCut-native workflow. If a source workflow depends on external image/video generation or manual assembly, replace that step with OpenChatCut's equivalent capability when available. Do not add unrelated OpenChatCut features just because they exist.

## When to Use

- The user starts from an idea, product, script, reference image, mood, or story premise.
- The work needs shot planning, prompt craft, visual continuity, and cinematic pacing.
- The user wants AI-generated clips assembled into a finished short.

## Workflow

1. Define the creative brief: premise, emotion, audience, platform, aspect ratio, duration, and ending.
2. Create a compact story structure: hook image, setup, escalation, reveal or payoff, final beat.
3. Build a style bible using [references/cinematic-ai-workflow.md](references/cinematic-ai-workflow.md): world, character, color, lens/camera language, motion, lighting, and continuity rules.
4. Draft a shot list. Each shot should have a purpose, duration, visual action, camera move, prompt notes, and continuity note.
5. Use existing or generated reference frames only when continuity would otherwise break, especially for characters, products, locations, or costumes.
6. Write prompts per shot with subject, action, environment, camera, lighting, mood, and negative constraints. Keep prompts specific but not brittle.
7. Generate clips, review continuity, and regenerate only shots that break story clarity or visual consistency.
8. Assemble the selected shots in the timeline. Add audio or text only when the brief or source workflow explicitly calls for it.
9. Final QA: story clarity, shot order, continuity, visual artifacts, and export readiness.

## Rules

- Story clarity beats visual novelty. Do not overproduce beautiful shots that do not serve the film.
- Keep a shared style bible so shots feel like one film.
- Do not silently change characters, products, claims, or key user references.
- Ask for confirmation when the premise, ending, product representation, or visual identity is ambiguous enough to change the result.
- Replace external generation or assembly steps with equivalent OpenChatCut capabilities when they exist. Do not introduce unrelated OpenChatCut features just because they are available.

## Output

When planning, show a concise brief and shot list. When executing, report generated clips, timeline structure, and any shots that need user review.`},{id:`11111111-1240-4000-8000-000000000006`,name:`Product Ad Video Script`,nameZh:`产品广告脚本`,summary:`把产品或页面转成广告角度、开头钩子、分镜、字幕、CTA 和视觉方向。`,scenarios:[`ad`,`e-commerce`,`landing-page`,`marketing`,`product`,`script`],body:`---
name: product-ad-video-script
description: Turn a product into ad angles, hooks, scenes, and CTA.
---

# Product Ad Video Script

Use this workflow when the user wants to turn a product, landing page, offer, screenshot, or rough idea into a short ad video plan and script.

Use this workflow to plan the ad first, then execute only the assets and edits the chosen script actually needs.

## When to Use

- The user provides a product, product page, app, feature, screenshot, or offer.
- The user asks for ad copy, hooks, UGC script, promo video, product reel, launch video, or short-form marketing video.
- The task needs angles, scene structure, captions, CTA, and visual treatment.

## Workflow

1. Read the product context: what it is, who it is for, core benefit, proof, offer, limitations, and required claims.
2. Extract or infer the customer problem, desired outcome, objections, and strongest differentiator.
3. Pick or propose 2-4 ad angles using [references/ad-script-framework.md](references/ad-script-framework.md).
4. For the chosen angle, write a concise video structure: hook, problem, demo or proof, benefit, objection handling, CTA.
5. Map each beat to required visuals using product/page assets or user-provided media. Generate new visuals only when the script needs them.
6. Create the timeline or present the script first depending on the user's intent.
7. QA claims, readability, pacing, CTA clarity, brand fit, and whether the first seconds explain why the viewer should care.

## Rules

- Ground claims in the product page, user notes, or visible assets. Do not invent prices, guarantees, medical claims, revenue claims, or endorsements.
- Prefer clear benefits over feature lists.
- Keep hooks concrete and viewer-facing.
- If required information is missing and affects truthfulness or positioning, ask or label the assumption.
- Match the visual plan to what OpenChatCut can make now; do not prescribe external-only steps unless the user asks.
- Do not add transitions, effects, music, or voiceover unless the selected script calls for them.

## Output

For planning, show angle, target viewer, hook, script beats, visual plan, captions, CTA, and assumptions. For execution, also report what was added to the timeline.`},{id:`11111111-1240-4000-8000-000000000011`,name:`Explainer Video`,nameZh:`解说视频制作`,summary:`把主题、脚本、配音、产品逻辑或数据做成完整解说视频。`,scenarios:[`concept`,`course`,`data`,`education`,`explainer`,`explainer-video`],body:'---\nname: explainer-video\ndescription: Create finished explainer videos from a topic, script, outline, voiceover, product logic, data, technical concept, course material, or reference assets. Use when the user wants narration, motion graphics, stock footage, generated visuals, or mixed visuals to explain an idea.\n---\n\n# Explainer Video\n\nUse this workflow to turn information into a clear finished video. The information is the product: topic, script, logic, data, product mechanism, or voiceover. Visuals support understanding. Explainer Video owns the section plan, narration mode, timing order, assembly, and QA; generation skills such as `motion-graphic-gen` are helpers for their specific asset type.\n\n## Workflow\n\n1. Read the project state, prompt, attached files, assets, transcript, and timeline.\n2. Identify the working labels:\n   - `explainer_start`: `topic_only`, `script_or_outline`, `voiceover_or_transcript`, `product_or_data`, `reference_assets`, or `direct_mg_animation_brief`.\n   - `source_structure`: `free_topic`, `script_sections`, `timestamped_sections`, `slides_or_pages`, `existing_voiceover`, `uploaded_assets`, `product_or_data`, or `mixed`.\n   - `narration_mode`: `generated_tts`, `existing_voiceover`, `transcript_only`, or `none`.\n   - `visual_mode`: `motion_graphics`, `stock_or_uploaded_footage`, `generated_video_or_images`, or `mixed`.\n3. Respect source structure. If the user provides structured material such as timestamps, numbered sections, slides/pages, scene labels, chapters, bullet outline, product points, transcript ranges, or voiceover sections, use that as the default planning scaffold. Merge, split, reorder, or relabel only when there is a clear production reason; explain the change and get user acceptance before treating it as the plan.\n4. Ask only for missing details that change the result: topic or script, target length, audience, platform/aspect ratio, language/voice, visual mode, tone, brand/style constraints, and whether to plan first or create directly.\n5. If more than one detail is missing, load `widget-forms` and ask in one `<widget>`. Use text fields for topic/script/context and single-choice fields for duration, platform, language/voice, and visual mode.\n6. Complete the preflight before writing visual treatments. The plan must have values for:\n   - `source_structure`\n   - `narration_mode`\n   - `visual_mode`\n   - `animation_reference`: `read` or `not_needed`\n   - `visual_direction_source`: active Design Style, chosen preset, concrete user style/reference, accepted role anchor, explicit proceed-without-alignment, or `not_needed`\n   - `voice_selection`: confirmed concrete preset, audition needed, or `not_needed`\n   - `timing_source`: actual voiceover/transcript ranges, generated TTS duration, user timestamps, planned duration, or `not_needed`\n7. Animation Reference Gate. If any section may use motion graphics, animation, animated diagrams, data animation, mechanism visualization, abstract concept visualization, or MG overlays, read [references/explainer-animation.md](references/explainer-animation.md) before writing those visual treatments. If the visual plan uses only stock footage, uploaded footage, generated live-action/video clips, or still images, mark `animation_reference: not_needed` and continue without loading it.\n8. Motion Graphic Direction Gate. If any section will generate MG/animation, load `motion-graphic-gen` before asking the user to choose visual style. Use it for Design Style preset alignment, visual-direction guidance, and MG brief writing. Explainer Video still owns narration mode, section order, timing, assembly, and QA. Before final MG generation, confirm visual direction through one of: active Design Style, catalog Design Style preset chosen from visual cards, concrete user style/reference, accepted role anchor, or explicit proceed-without-alignment. Treat broad hints such as "clean", "modern", "technical", "cinematic", or "tech style" as filters for preset selection, not as enough to generate final MGs. Do not invent text-only style choices before checking presets; assistant-written style options are fallback alignment, not a catalog preset.\n9. Build a compact explainer plan only after the relevant gates above are complete:\n   - viewer promise or thesis\n   - preserved or proposed sections\n   - narration source and timing source\n   - narration-to-visual map per section: narration text or time range, visual goal, visual treatment, source assets, and sync risk\n   - assumptions and claims that need grounding\n   - first visible result to create before batching\n10. For `topic_only`, write a short outline before drafting or generating. For `script_or_outline`, preserve the user\'s claims and meaning while tightening structure. For `product_or_data`, explain the mechanism or value without inventing unsupported claims. For `direct_mg_animation_brief`, do not force a broad explainer outline; inspect the provided script, assets, references, transcript, or style target, then create the requested MG section, intro, diagram, or overlay inside the same gates.\n11. Voice Gate. For `generated_tts`, load `voice` before recommending voices, choosing a preset, or submitting TTS. If the user has not confirmed a concrete voice preset, follow `voice` to read the curated voice list and show an audition widget first. Do not infer a `voiceId` from the content topic, language, gender, or broad style words.\n12. Create or align narration only when needed. For `generated_tts`, draft or tighten section-level narration lines first; estimate whether they fit target timing before submission, rewrite obvious mismatches, generate/place TTS by section only after the Voice Gate is complete, then read actual audio duration before any matching narration-backed MG/animation generation. Do not submit TTS and its matching MG in the same parallel batch. For `existing_voiceover`, do not regenerate narration; transcribe or read the audio and split it into section time ranges before generating matching visuals. For `transcript_only`, confirm whether the transcript should become TTS, captions, or only structure if ambiguous. For `none`, skip narration sync and plan visuals from the information structure and output rhythm.\n13. Produce visuals section by section. For MG/animation, verify the animation reference has been read, visual direction is confirmed, and `motion-graphic-gen` has been used for brief writing before final generation or batching. For generated-TTS sections, even the first representative section MG must wait until that section\'s actual TTS duration is known. For narration-backed MG/animation, duration must come from the matching narration\'s actual audio duration when available, not from script estimates. For stock, uploaded, generated-video, or mixed visual sections, inspect/select the visual source first and use it only when it supports the section. When style or correctness is uncertain, create the first representative section or shot before batching only after required narration timing exists; a pre-audio style proof requires explicit user approval and must be labeled style-only, not treated as a section MG or placed as final timeline content.\n\n14. Assemble the timeline with narration, visuals, captions when useful, background music, and section pacing. For narration-backed MG/animation sections, align narration and matching visuals to the same start time and cover the full narration section unless the visual plan intentionally changes shots within that section.\n15. Run Narration-Visual Sync QA before done. For each narration-backed section, check whether spoken content matches the visual, whether visual duration covers narration, whether visual information density supports the spoken point, and whether transitions happen too early or too late. Fix failures before delivery by tightening narration, splitting the section, extending/regenerating visuals, adjusting timing, or asking the user to choose a tradeoff.\n16. Final QA before done: topic clarity, factual grounding, visual-mode fit, narration coverage, timing, caption readability, audio mix, timeline continuity, narration-visual sync, and export readiness.\n\n## Rules\n\n- Explain the idea; do not merely decorate narration with icons or subtitles.\n- Do not invent facts, prices, medical claims, performance claims, legal claims, or product guarantees.\n- Do not use existing footage as filler when it is unrelated to the explanation.\n- Do not average every uploaded asset into the video. Use assets only when they support a beat.\n- Do not keep asking after enough information exists to make the first visible result.\n- Do not put full spoken sentences on screen. Use labels, numbers, short questions, or section titles.\n- Do not rewrite structured user inputs into a different section plan without explaining why and getting user acceptance.\n- Do not output MG/animation visual treatments before the animation reference gate has been resolved.\n- Do not generate final MG/animation before the visual-direction gate is resolved.\n- Do not satisfy the visual-direction gate with ad hoc style choices you invented before loading `motion-graphic-gen`. A `preset` means a catalog Design Style preset shown through visual cards, not a text label.\n- Do not force generated TTS when the user already has a usable voiceover or does not want narration.\n- Do not call `submit_voice` before loading `voice` and confirming a concrete voice preset.\n- Do not submit a narration-backed MG/animation in parallel with the TTS that should time it.\n- Do not submit final narration-backed MG from estimated script duration. Narration-backed MG must use the matching narration text or time range and the real audio duration when available.\n- Do not let `motion-graphic-gen` override the Explainer Video source structure, narration mode, section order, timing, assembly, or QA workflow.\n\n## Plan Format\n\nUse this compact format when planning:\n\n- `explainer_start`: starting point label\n- `source_structure`: input scaffold and whether it is preserved or changed\n- `narration_mode`: `generated_tts`, `existing_voiceover`, `transcript_only`, or `none`\n- `output`: platform, aspect ratio, target length, language, and voice when relevant\n- `viewer_promise`: what the viewer will understand by the end\n- `preflight`: animation reference status, visual-direction source, voice selection, and timing source\n- `sections`: beat, narration text or time range, visual goal, visual treatment, source assets, sync risk\n- `first_visible_result`: the first section or shot to create before batching; mark it as non-final if real narration timing is not known\n- `sync_check`: for narration-backed MG, note the timing source, narration duration, MG duration, match result, and any fix applied\n\nWhen reporting execution, include created timeline names, narration mode, visual modes used, assumptions, sync fixes applied, and what to review first.'},{id:`11111111-1240-4000-8000-000000000008`,name:`Motion Graphic Placement`,nameZh:`动效点缀指南`,summary:`在合适时机添加动效，强化表达且不遮挡内容。`,scenarios:[`creator-video`,`interview`,`lecture`,`motion-graphic-placement`,`motion-graphics`,`podcast`],body:`---
name: motion-graphic-placement
description: Add motion graphics at the right moments without blocking the story. Use when the user wants to enhance talking-head, lecture, tutorial, interview, podcast, or creator videos with motion graphics.
---

# Motion Graphic Placement

Use this skill to plan where motion graphics should appear, what type each one should be, and how to keep them readable, rhythmic, and consistent with the video.

## Goals

- Reinforce important speech moments without covering the speaker or subtitles.
- Match MG type to the semantic function of the line.
- Keep density high enough for retention but sparse enough to avoid fatigue.
- Maintain one visual language across the whole edit.

## Workflow

1. Read project state, transcript, active design style, video aspect ratio, and visible speaker layout.
2. Identify the video structure:
   - hook
   - problem or setup
   - body / proof / steps
   - summary / CTA
3. Decide motion-graphic density:
   - long-form landscape: usually one meaningful MG every 5-8 seconds, tighter in the first 15 seconds
   - short-form portrait: usually one meaningful MG every 3-5 seconds, with stronger rhythm
   - reduce density when the speaker's face, gesture, or screen recording already carries the moment
4. Pick MG types from semantic triggers.
5. Review the plan before generation:
   - no repeated form in a row unless intentionally templated
   - no overlays on face, hands, product focal point, or subtitle area
   - no unnecessary full-screen takeover when a card, strip, badge, or annotation is enough
6. Generate or reuse MGs.
7. Place each MG against the relevant transcript moment.
8. Verify screenshots at target frames and fix anything that blocks content, feels mistimed, or carries template residue.

## Semantic Triggers

| Speech pattern                        | Good MG direction                       |
| ------------------------------------- | --------------------------------------- |
| strong opinion, conclusion, key quote | highlight sentence or quote card        |
| numbers, percentages, prices          | number card, counter, chart, price card |
| steps, lists, sequence                | point list, flow steps, timeline        |
| comparison or choice                  | comparison card, split card, VS card    |
| warning or mistake                    | warning card or caution badge           |
| question, suspense, hook              | question card, hook text                |
| self-intro, guest, role               | name tag or lower-third                 |
| source, screenshot, comment, evidence | source card or annotation               |
| CTA                                   | CTA card                                |

## Placement Rules

- Always inspect the frame before placing an overlay.
- Place MGs away from the speaker's face, hands, active product area, and subtitles.
- Landscape: side cards work well when the speaker is clearly on the opposite side; bottom strips must sit above subtitles.
- Portrait: keep the bottom 15-20% clear for captions and interaction UI.
- Full-screen MGs should be reserved for hooks, chapter transitions, dense data, or moments where the original footage adds little value.
- After a full-screen MG, leave enough breathing room before the next overlay.

## Style And Reuse

- Use the active Design Style when the project has one.
- Same-role MGs should reuse a confirmed template or code structure and change only the content.
- New-role MGs can borrow style, but should not inherit irrelevant template text, charts, labels, or layout.
- After generation, inspect the visual output. If old template text or wrong structure appears, fix the asset instead of trusting props.

## Quality Checks

- Every MG has a reason tied to a speech beat.
- Text can be read at playback size.
- Adjacent MGs vary in form, position, or rhythm.
- No face/subtitle/product obstruction.
- Visual style is consistent but not repetitive.
- The final edit feels clearer, not busier.`},{id:`11111111-1240-4000-8000-000000000009`,name:`Storyboard Shot Breakdown`,nameZh:`拉片分镜图`,summary:`逐镜拆解镜头语言，并生成分镜参考图。`,scenarios:[`cinematography`,`director-logic`,`film-analysis`,`shot-analysis`,`shot-breakdown`,`storyboard`],body:`---
name: storyboard-shot-breakdown
description: Break down each shot and turn the analysis into a storyboard reference. Use when the user wants shot-by-shot film analysis, director logic, cinematography breakdown, or a storyboard-style reference from a video.
---

# Storyboard Shot Breakdown

Use this skill to analyze a video shot by shot and produce a storyboard-style reference that explains the director's visual decisions.

## Core Philosophy

Do not merely describe what is visible. Deduce why each visual choice was made.

Analyze each shot across five director-decision dimensions:

| Dimension          | Core question                                                                                                |
| ------------------ | ------------------------------------------------------------------------------------------------------------ |
| Composition        | What is the viewer forced to look at? What pressure does space, symmetry, depth, or framing create?          |
| Focal length       | What psychological distance does the lens create? Does it compress, expand, isolate, or invade?              |
| Movement           | Why does the camera move or stay still at this exact moment? What changes before and after?                  |
| Cut                | Why cut here instead of earlier or later? Is the driver emotion, story, rhythm, eye trace, action, or sound? |
| Narrative function | What new information does this shot deliver: setup, turning point, emphasis, concealment, revelation?        |

## Workflow

1. Read project state and source media.
2. Read transcript or audio context when available so narrative interpretation is grounded.
3. Detect or mark shot boundaries with available OpenChatCut/media tooling.
4. Extract representative frames for each shot in batch when possible.
5. Inspect frames before writing analysis. Do not invent details that are not visible.
6. For high shot counts, tell the user the count and offer output scope choices before spending effort.
7. Analyze each selected shot using the five dimensions.
8. Summarize the overall visual rule of the scene in 1-2 concise sentences.
9. Generate a storyboard reference image or structured analysis artifact if the user wants a visual output.

## Internal Reasoning

Use a counterfactual test: if the conventional alternative were used, what emotion or information would be lost? The answer is usually the director's motive.

Use this reasoning to improve the analysis, but do not output the counterfactual test as a separate section unless the user asks.

## Output Format

Per shot:

\`\`\`text
S{N} - {scale} · {lens/mood} · {movement} · {timecode} · {duration} · {narrative function}

Composition: [what attention is forced onto and what pressure the frame creates]
Focal Length: [psychological distance and dramatic effect]
Movement: [why it moves or stays still, and what changes]
Cut: [why the cut lands here, including rhythm/eye trace/sound when relevant]
Narrative: [what story information this shot adds]
\`\`\`

Overall:

\`\`\`text
Director's Logic: [3-5 sentences summarizing the visual strategy]
Visual Rule: [1-2 sentences the user can reuse as a shooting/editing reference]
\`\`\`

## Rules

- Write from visible evidence and available transcript/audio context.
- Do not borrow details from adjacent shots unless clearly stated as sequence-level analysis.
- Keep shot numbering stable.
- User owns scope trade-offs: if output must be reduced, propose choices.
- Prefer current OpenChatCut/media tools over hardcoded local commands. Use external scripts only when they are available and clearly help.`},{id:`11111111-1240-4000-8000-000000000010`,name:`Video Thumbnail Generator`,nameZh:`视频封面生成`,summary:`基于视频内容和真实画面生成适合平台的封面图。`,scenarios:[`bilibili-cover`,`cover-image`,`poster`,`shorts-cover`,`thumbnail`,`video-cover`],body:`---
name: video-thumbnail-generator
description: Create platform-ready thumbnails from real video frames. Use when the user wants a thumbnail, cover image, YouTube cover, Shorts cover, Bilibili cover, Xiaohongshu cover, or other video poster image.
---

# Video Thumbnail Generator

Use this skill to create a high-clarity thumbnail or cover image from the actual video content.

## Non-Negotiables

1. Use the real video as visual evidence.
   - If the thumbnail shows a person, product, UI, frame, or scene from the video, extract or inspect real frames.
   - Never invent a generic software interface, fake product screen, or unrelated person.

2. Read style references before recommending styles.
   - Use \`references/thumbnail-styles.md\` and \`references/thumbnail-style-recipes.md\`.
   - Only offer style directions supported by those references or by the user's explicit instruction.

3. Keep text short and readable.
   - Usually 2-5 words.
   - Avoid thin type, low contrast, small labels, and clutter.

## Workflow

1. Confirm platform and aspect ratio if missing.
   - YouTube / Bilibili: usually 16:9.
   - Shorts / TikTok / Douyin: usually 9:16.
   - Xiaohongshu / WeChat Channels: usually 3:4.
   - Correct ambiguous ratio language gently, especially 4:3 vs 3:4.
2. Read project state, transcript, and available media context.
3. Inspect candidate frames:
   - expressive face
   - product or UI clearly visible
   - dramatic action moment
   - clean composition
   - strong lighting or clear subject separation
4. Classify the thumbnail job:
   - talking-head / opinion / tutorial
   - product / software / demo
   - cinematic / documentary / art
   - entertainment / challenge / reaction
   - education / business / concept
5. Propose concise title text options.
6. Offer 3-6 clearly different style directions.
   - Each option should name the composition, not only a channel/style label.
   - Exclude weak options.
   - Wait for user choice when the direction is not obvious.
7. Generate thumbnail options using selected real frames and the selected style.
8. Check mobile readability, subject fidelity, product/UI truthfulness, and visual contrast.
9. Present results and offer targeted adjustments.

## Prompt Shape

\`\`\`text
[Platform] thumbnail, [aspect ratio / dimensions], [style name].

COMPOSITION: [subject position, scale, background, graphic balance]
REAL REFERENCE: [describe selected frame zone by zone]
TEXT: "[short title]" in [high-contrast style]
STYLE: [one-line style recipe from references]
CONSTRAINTS: readable at mobile size, no fake UI, no watermark, no play button.
\`\`\`

## References

- \`references/thumbnail-styles.md\`: style library from real thumbnail analysis.
- \`references/thumbnail-style-recipes.md\`: quick style recipes and prompt patterns.
- \`references/field-testing-notes.md\`: known failure modes.`}],t=[];function n(e){t=e}function r(){return[...e,...t]}var i=n=>n?e.find(e=>e.id===n)??t.find(e=>e.id===n):void 0;export{n as i,r as n,i as r,e as t};