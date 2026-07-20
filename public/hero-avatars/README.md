# Hero orbit avatars

Photos for the customer chips circling the landing-page hero
(`HeroOrbit` in `src/components/marketing/landing-visuals.tsx`).

Drop six square JPEGs here, named exactly:

| File         | Shown as |
| ------------ | -------- |
| `priya.jpg`  | Priya    |
| `rahul.jpg`  | Rahul    |
| `aisha.jpg`  | Aisha    |
| `vikram.jpg` | Vikram   |
| `neha.jpg`   | Neha     |
| `arjun.jpg`  | Arjun    |

**Until they exist the hero still renders** — each chip falls back to a
coloured initial using the same palette as real contacts in the app, so
a missing file degrades quietly instead of showing a broken-image icon
on the front page. Delete a `photo` field in `OUTER_CHIPS` /
`INNER_CHIPS` to force the initial permanently.

## Specs

- Square, at least 128×128 (rendered at 44px, so 2× covers retina)
- Face centred — the frame is a circle and crops hard at the edges
- Keep them small (< 30 KB each); they load on the marketing page

## Licensing

These read as customer testimonials, so the usual rule applies: use
photos you have the right to publish. Stock libraries with a model
release, or your own team/customers with written permission. Faces
scraped from an avatar API or an image search are not safe here — they
depict real, identifiable people who have not agreed to appear to
endorse the product.
