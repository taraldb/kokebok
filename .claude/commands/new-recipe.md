# /new-recipe — Create a new Kokebok recipe

You are helping the user create a new recipe for their self-hosted cooking site at your-domain.example. Recipes are stored as JSON files in `recipes/` and must match the schema below.

## Your job

1. **Gather information**: Ask the user for the recipe name, category, and either a prose description/instructions or a full recipe. Accept natural-language input — you will convert it to structured JSON.

2. **Generate the JSON**: Produce a complete, well-structured recipe JSON file. Infer reasonable values for anything not explicitly provided (e.g. timer durations, step ordering). Use Norwegian for all user-facing text.

3. **Show the JSON**: Display the full JSON to the user for review before doing anything else.

4. **Ask before posting**: After showing the JSON, ask:
   > "Vil du at jeg skal poste denne oppskriften til admin-APIet automatisk? (http://localhost:3001/api/recipes)"

5. **If yes**: POST the JSON to `http://localhost:3001/api/recipes` using `curl`:
   ```bash
   curl -s -X POST http://localhost:3001/api/recipes \
     -H "Content-Type: application/json" \
     -d '<json>'
   ```
   Report success or failure. On success, tell the user the recipe is live at `recipe.html?id=<id>`.

6. **If no**: Write the JSON to `recipes/<id>.json` directly. Remind the user to run `curl -X POST http://localhost:3001/api/recipes -H 'Content-Type: application/json' -d @recipes/<id>.json` later, or use the admin UI.

## Recipe JSON schema

```json
{
  "id": "lowercase-kebab-case",
  "title": "Norsk tittel",
  "label": "Kategori · Nøkkelord",
  "description": "1–2 setninger som beskriver retten.",
  "category": "surdeig|brød|middag|dessert|suppe|kaker|frokost|fisk|vegetar|snacks",
  "tags": ["tag1", "tag2"],
  "meta": [
    { "label": "Aktiv tid",  "value": "~30 min" },
    { "label": "Steketid",   "value": "20 min"  },
    { "label": "Porsjoner",  "value": "4"        }
  ],
  "servings": {
    "base": 4,
    "unit": "porsjoner",
    "step": 1,
    "min": 1
  },
  "ingredients": [
    { "amount": 500, "unit": "g", "name": "ingrediensnavn" }
  ],
  "steps": [
    {
      "title": "Kort tittel",
      "text": "Instruksjon. HTML-formatering er tillatt (<strong>, <em>).",
      "timerSeconds": 0
    }
  ],
  "tips": [
    "Valgfrie tips til slutt."
  ]
}
```

## Rules

- `id` must be unique, lowercase, no spaces (use hyphens)
- `timerSeconds`: set to 0 if no timer is needed, otherwise the number of seconds for that step
- All user-facing strings must be in Norwegian
- `tags` should be lowercase Norwegian nouns
- Do not include `undefined` or `null` fields — omit optional fields that have no value
- `ingredients[].amount` must be a number (not a string)
