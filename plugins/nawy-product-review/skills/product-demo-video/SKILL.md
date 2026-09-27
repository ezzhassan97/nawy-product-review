---
name: product-demo-video
description: Make a feature demo video (feature announcement, go-to-market, product walkthrough) from real product screenshots or a screen recording. The screens play in a laptop in the order of the user's flow, the camera glides to what matters, a spotlight and a written label point at it, a cursor clicks, a numbered caption says each step, between a Nawy title card and an outro. Renders a 1920×1080 MP4 on the user's computer, on a Mac with Swift or on any computer with JavaScript. Use whenever someone asks for a demo video, feature video, announcement or launch video, walkthrough, or to turn screenshots or a recording into a video, and whenever the product-review skill needs a feature's demo.
---

# Product demo video

A demo video sells a feature. It walks the viewer through the real screens in the order a user meets them, and at
every step shows exactly where to look and why. It is not a slideshow of screenshots: each scene has one message
and one thing highlighted, and the camera takes the viewer there.

## 0. The renderer

Two renderers in `scripts/`, one storyboard format, the same video:

| | Swift (`demo_video.swift`) | JavaScript (`demo_video.mjs`) |
|---|---|---|
| Runs on | Mac only | Mac, Windows, Linux |
| Needs | Apple's Command Line Tools: check `swift --version`; if missing, `xcode-select --install` (an Apple download of 1-2 GB) | Node 18+ (`node --version`; from nodejs.org), and once, `npm install` in `scripts/` (two packages, ~100 MB) |
| Run with | `swift <scripts>/demo_video.swift …` | `node <scripts>/demo_video.mjs …` |

Use `video.renderer` from the user's `product-review.json` when there is one. Otherwise ask which they prefer, say
what each needs, and save the answer there. On the JavaScript renderer's first run, if it reports ffmpeg missing
(recent npm versions block its download step), run `npm approve-scripts ffmpeg-static && npm rebuild ffmpeg-static`
in `scripts/`.

## 1. The story first

Before touching an image, write the flow as steps in the user's order: where they start → what they do → what they
get. One step = one scene = one message. Aim for 3 to 6 scenes, 20 to 40 seconds with the title and the outro.

Show the scene list in the chat, one line per scene (caption, and what gets highlighted), and settle it with the
user before rendering: they know what they want to show off.

## 2. The material

Real screens only. Never draw, mock or invent UI.
- **Screenshots** of each step, in order: the full browser width, at least 1600 px wide (retina is best).
- **A screen recording** of the flow (.mov or .mp4). Trim it to the steps (`from`, `to`), speed up the slow parts
  (`speed`), then add the zoom, spotlight, label and captions, just like screenshots.
- **Product screens come from the user.** A browser pane can open the product, but it cannot save a screenshot to
  a file, so ask for screenshots or a recording.
- **Jira designs** (the story's attachments, through the Atlassian connector) suit a feature that isn't built yet.
  Designs with annotation arrows or notes on them make a messy video: frame the scene around them, or ask for clean
  ones.

## 3. The storyboard

A JSON file, kept with the video's working files (in a product review: `work/<feature>/`):

```json
{
  "intro": { "kicker": "New in IMS", "title": "Data Quality System", "text": "Wrong data reported where it's found, and tracked to a fix" },
  "scenes": [
    {
      "image": "shots/property.png",
      "caption": { "title": "Spot wrong data on any property", "text": "A price, a unit count or a photo that doesn't look right" },
      "zoom": [1450, 1050, 1170, 650],
      "highlight": [2040, 1569, 330, 70], "label": "Price looks wrong"
    },
    {
      "image": "shots/property.png",
      "caption": { "title": "Report it in one click", "text": "Right from the property: no chats, no sheets" },
      "view": [1450, 1050, 1170, 650], "zoom": [1900, 1050, 700, 520], "zoomAt": 0.3,
      "click": [2300, 1473], "highlight": [2105, 1442, 394, 63], "label": "One click"
    },
    { "video": "flow.mov", "from": 12, "to": 21, "speed": 1.5, "caption": { "title": "Tracked until it's fixed" },
      "highlight": [1210, 640, 420, 90], "highlightAt": 3.5, "label": "Resolved" }
  ],
  "outro": { "kicker": "Data Quality System", "title": "Live in IMS", "text": "Open it from the Properties page" }
}
```

| Field | What it does |
|---|---|
| `intro`, `outro` | navy cards with the logo: `kicker`, `title`, `text`, `seconds` (2.8 / 2.6). Outro wording follows the stage: "Live in <product>", "Now in testing", "Coming soon". |
| `image` / `video` | the scene's screen; a path that is absolute or relative to the storyboard. A video takes `from`, `to` (seconds) and `speed`. |
| `caption` | under the laptop: `title` (up to ~40 characters) and `text` (up to ~70). What this step does for the user. |
| `view` | where the scene starts; default: the whole screen, or the top of a long page. |
| `zoom` | where the camera glides to (at `zoomAt`, default 0.5 s): the thing the step is about, big enough to read. |
| `click` | the cursor glides there and clicks, once the camera settles (`clickAt` to set the second). |
| `highlight` + `label` | the spotlight: the screen dims except this box, a ring snaps onto it, and the label (up to ~24 characters) is written beside it. Lands just after the click (`highlightAt`). |
| `seconds` | an image scene's length; the default leaves time to read. A video scene lasts its clip divided by `speed`. |
| `accent`, `steps` | the spotlight colour (default Nawy orange `#FF7043`); `"steps": false` hides the step numbers. |

Coordinates are `[x, y, width, height]` in pixels of the image or video frame. A view takes the laptop screen's
16:10 shape, grown around the box you give; carry the last scene's `zoom` into the next scene's `view` when two
steps are on the same screen, so the camera doesn't jump.

## 4. Coordinates, then stills, then the video

With `R` = the renderer's command (`swift <scripts>/demo_video.swift` or `node <scripts>/demo_video.mjs`):

```
R --grid shot.png shot-grid.png          a labelled 100 px grid; for a recording: R --grid flow.mov grid.png 14
R story.json --stills 4,9.5 stills/      frames at those seconds; it also prints when each scene starts
R story.json out.mp4                     about 1-2 seconds of rendering per second of video
```

1. Grid every screenshot (or the recording at each step) and read the boxes off it. The labels are real pixels even
   when the image is shown to you scaled down.
2. Render a still of every scene at its spotlight moment and look at each: the spotlight sits on the right thing, the
   label hides nothing that matters, the zoom is readable, the caption fits. Fix and repeat.
3. Render the video.

## 5. Hand over

The MP4 is 1920×1080, H.264, silent: ready for Slack, email or a review page. Give its path and the scenes in one
line each, and offer changes (wording, order, timing, what is highlighted).

## How it should read

- The flow's order, never back and forth.
- One scene, one message: the caption and the spotlight say the same thing.
- Labels name the benefit, not the button ("One click", not "Report an Issue" when the button already says it).
- The Nawy logo sits on its white badge and is never recoloured (built in). Poppins comes with the skill.
- No music or voice-over; add them only if asked.
