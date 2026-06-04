# /new-recipe — Create a new Kokebok recipe

You are helping the user create a new recipe for their self-hosted cooking site at your-domain.example.

## Your job

1. **Gather information**: Ask the user for the recipe. Accept natural-language input — a prose description, a list of ingredients and steps, or a full recipe. Infer anything not explicitly provided (timer durations, step structure, ingredient IDs, etc.).

2. **Generate the YAML**: Produce a complete, well-structured recipe in the YAML format shown below. Use Norwegian for all user-facing text. Ingredient `id`s must be slugified versions of the name (lowercase, Norwegian letters → ae/o/a, spaces → hyphens).

3. **Show the YAML**: Display the full YAML to the user for review.

4. **Ask before posting**:
   > "Vil du at jeg skal poste denne oppskriften til admin-APIet? (http://localhost:3001)"

5. **If yes**: Write the YAML to a temp file and POST via curl:
   ```bash
   curl -s -X PUT "http://localhost:3001/api/recipes/<id>/yaml" \
     -H "Content-Type: text/yaml" \
     --data-binary @/tmp/<id>.yaml
   ```
   Report success or failure. On success, tell the user the recipe is live at `https://your-domain.example/r/<id>`.

6. **If no**: Write the YAML to `/tmp/<id>.yaml` and show the user the curl command to run manually later.

---

## YAML schema

```yaml
id: kebab-case-id          # must be unique, lowercase, no spaces
title: "Norsk tittel"
label: "Kategori · Nøkkelord"          # optional
description: "1–2 setninger om retten."
category: middag           # surdeig|brød|middag|dessert|suppe|kaker|frokost|fisk|vegetar|snacks
tags: [tag1, tag2]         # lowercase Norwegian nouns
meta:
  - label: "Aktiv tid"
    value: "~30 min"
  - label: "Steketid"
    value: "20 min"
  - label: "Porsjoner"
    value: "4"
servings:
  base: 4
  unit: porsjoner
  step: 1
  min: 1
ingredients:
  - id: kyllingbryster      # slugified name
    amount: 600
    unit: g
    name: kyllingbryster
  - id: hvitloek
    amount: 3
    unit: fedd
    name: hvitløk
steps:
  - title: "Kort tittel"
    timer_seconds: 0        # 0 if no timer, else number of seconds
    content: |
      Varm opp **ovnen** til 200 °C. Skjær {{ing:kyllingbryster}} i biter
      og finhakk {{ing:hvitloek}}.
  - title: "Stek"
    timer_seconds: 1200
    content: Stek i **20 minutter** til gjennomstekt.
tips:
  - "Valgfrie tips her."
```

### Content format for steps

Step `content` is plain text with optional inline formatting:
- `**tekst**` → bold
- `*tekst*` → italic
- `{{ing:<ingredient-id>}}` → inline ingredient reference (use the ingredient's `id`)
- `{{ing:<id> @ <factor>}}` → ingredient ref scaled by factor (e.g. `@ 0.5` for half)
- Newlines in content are preserved as line breaks

### Rules

- `id` must be unique; derive from the title (lowercase, Norwegian chars → ae/o/a, spaces → hyphens)
- Ingredient `id`s follow the same slugify logic as recipe IDs
- `timer_seconds`: 0 for steps with no timer, otherwise seconds (e.g. 20 min = 1200)
- All user-facing strings in Norwegian
- Omit optional fields (`label`, `description`, `meta`, `tips`) if not applicable — do not include them with empty values
- `ingredients[].amount` must be a number or null (not a string)
- Prefer `{{ing:...}}` refs in step content over re-stating ingredient names
