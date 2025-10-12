# Phase 15: Integration Types Endpoint (Future)

**Status**: 📝 Deferred  
**Priority**: Low (needed for dynamic UI forms)

---

## Purpose

Provide metadata about available integration types for dynamic form generation in the UI.

---

## Endpoint Spec

### `GET /api/integrations/types`

**Auth**: Optional (public metadata)

**Response**:
```json
[
  {
    "type": "gotify",
    "name": "Gotify",
    "description": "Self-hosted notification server",
    "icon": "🔔",
    "fields": [
      {
        "name": "server_url",
        "label": "Server URL",
        "type": "url",
        "placeholder": "https://gotify.example.com",
        "required": true,
        "help": "Your Gotify server URL (include http:// or https://)"
      },
      {
        "name": "token",
        "label": "Application Token",
        "type": "password",
        "placeholder": "AbCdEf123456",
        "required": true,
        "help": "Get this from Gotify → Apps → Create Application"
      },
      {
        "name": "priority",
        "label": "Priority",
        "type": "select",
        "options": [
          {"value": "low", "label": "Low"},
          {"value": "normal", "label": "Normal"},
          {"value": "high", "label": "High"}
        ],
        "default": "normal",
        "required": false
      }
    ]
  },
  {
    "type": "email",
    "name": "Email (SMTP)",
    "description": "Send notifications via email",
    "icon": "📧",
    "fields": [...]
  }
]
```

---

## Implementation Notes

1. **Extract from Pydantic models**: Use model metadata to generate field specs
2. **Centralized registry**: Single source of truth for all integration types
3. **UI consumption**: Frontend can dynamically generate forms from this metadata
4. **Validation**: Field specs match Pydantic validation rules

---

## Example Usage

```javascript
// Frontend fetches types
const types = await fetch('/api/integrations/types').then(r => r.json());

// Render form for selected type
const gotifyType = types.find(t => t.type === 'gotify');
renderForm(gotifyType.fields);

// Submit typed config
await fetch('/api/integrations/v2', {
  method: 'POST',
  body: JSON.stringify({
    name: 'My Gotify',
    integration_type: 'gotify',
    config: formData,
    tag: 'urgent'
  })
});
```

---

## When to Implement

- After we have 3+ integration types working
- When building the web UI dashboard
- Low priority for API-only usage

---

## References

- See `docs/integrations/apprise-integration-specs.md` for field specifications
- Pydantic models in `src/api/schemas/integration_configs.py`
- Converters in `src/api/services/integration_converters.py`
