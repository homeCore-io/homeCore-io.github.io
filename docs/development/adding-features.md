---
id: adding-features
title: Adding Features
sidebar_label: Adding Features
sidebar_position: 4
---

# Adding Features

Step-by-step checklists for the most common extension points. Follow these in order — each step builds on the previous one.

---

## Adding a new REST endpoint

1. **Add the handler function** in `crates/hc-api/src/handlers.rs` (or a new file for a new resource type).

   ```rust
   pub async fn get_my_resource(
       State(state): State<AppState>,
       AuthUser(user): AuthUser,
       Path(id): Path<Uuid>,
   ) -> Result<Json<MyResourceResponse>, ApiError> {
       require_scope(&user, "read:my_resource")?;
       let data = state.store.get_my_resource(id).await?;
       Ok(Json(data.into()))
   }
   ```

2. **Add the route** in `crates/hc-api/src/lib.rs` inside `build_router()`.

   ```rust
   .route("/api/v1/my-resource/:id", get(handlers::get_my_resource))
   ```

3. **Add the scope** to the `require_scope` table in `hc-auth` if it's a new permission scope. Verify it in `crates/hc-auth/src/scopes.rs`.

4. **Add the `utoipa` attribute** for OpenAPI generation:

   ```rust
   #[utoipa::path(
       get,
       path = "/api/v1/my-resource/{id}",
       params(("id" = Uuid, Path, description = "Resource ID")),
       responses(
           (status = 200, description = "Resource found", body = MyResourceResponse),
           (status = 404, description = "Not found"),
       ),
       security(("bearer_auth" = [])),
       tag = "my-resource"
   )]
   pub async fn get_my_resource(...) { ... }
   ```

5. **Register the path** in `crates/hc-api/src/openapi.rs` in the `paths(...)` macro call.

6. **Write tests** in the `#[cfg(test)]` block at the bottom of `crates/hc-api/src/handlers.rs` (or in a test module for the new file). Use the existing test helpers to set up an in-memory `AppState`.

   ```bash
   cargo test -p hc-api
   ```

---

## Adding a new action type

1. **Add the variant** to the `Action` enum in `crates/hc-types/src/rule.rs`.

   ```rust
   #[serde(tag = "type", rename_all = "snake_case")]
   pub enum Action {
       // ... existing variants ...
       MyNewAction {
           device_id: String,
           value: JsonValue,
           #[serde(default)]
           enabled: bool,
       },
   }
   ```

   Use `#[serde(default)]` on optional fields so TOML/JSON without that field deserializes cleanly.

2. **Add the match arm** in `crates/hc-core/src/executor.rs` in `run_single_action()`.

   ```rust
   Action::MyNewAction { device_id, value, .. } => {
       // implement the action here
       // use ctx.publish to send MQTT commands
       // use ctx.event_bus to fire events
       // use ctx.state for state reads/writes
       Ok(ActionOutcome::Ok)
   }
   ```

3. **Add an `ActionTrace` entry** — return `Ok(ActionOutcome::Ok)` on success, `Ok(ActionOutcome::Skipped)` if the action is disabled, or propagate errors as `ActionOutcome::Error(msg)`.

4. **Write unit tests** in `crates/hc-core/src/executor.rs` or the `tests/` directory. Build a minimal `ExecutorContext` with mock state and verify the action's observable side effects.

   ```bash
   cargo test -p hc-core
   ```

5. **Update `devNotes.md`** — add the new action to the action type reference table in `docs/devNotes.md`. Document key fields, what it does, and any TOML example.

6. **Update this website** — add the new action to `docs/rules/actions.md`.

---

## Adding a new trigger type

1. **Add the variant** to the `Trigger` enum in `crates/hc-types/src/rule.rs`.

   ```rust
   pub enum Trigger {
       // ... existing variants ...
       MyNewTrigger {
           some_field: String,
       },
   }
   ```

2. **Add trigger matching** in `crates/hc-core/src/engine.rs` in the `matches_trigger()` function. This function receives the incoming `Event` and the `Trigger` from the rule and returns `Option<TriggerContext>`.

   ```rust
   Trigger::MyNewTrigger { some_field } => {
       match event {
           Event::Custom { event_type, payload } if event_type == some_field => {
               Some(TriggerContext { ... })
           }
           _ => None,
       }
   }
   ```

3. **Decide which bus emits the event** — if the trigger is fired by a scheduled or internal event, emit it on `pub_bus` from the scheduler or a manager. If it responds to a raw MQTT message, it reads from `internal_bus`.

4. **Add catch-up logic** in `crates/hc-core/src/scheduler.rs` if the trigger is time-based and should fire on restart if missed.

5. **Write unit tests** covering trigger match and no-match cases.

   ```bash
   cargo test -p hc-core
   ```

6. **Update `devNotes.md`** and `docs/rules/triggers.md` with the new trigger type, required fields, and a RON example.

---

## Adding a new condition type

1. **Add the variant** to the `Condition` enum in `crates/hc-types/src/rule.rs`.

   ```rust
   pub enum Condition {
       // ... existing variants ...
       MyNewCondition {
           field: String,
           expected_value: JsonValue,
       },
   }
   ```

2. **Add the evaluation logic** in `crates/hc-core/src/engine.rs` in `evaluate_condition()`. This function is synchronous — it must not call `await`. Use the `device_cache` DashMap for device state reads.

   ```rust
   Condition::MyNewCondition { field, expected_value } => {
       let actual = /* read from cache or other in-memory source */;
       let passed = actual == *expected_value;
       ConditionTrace {
           condition_type: "MyNewCondition".into(),
           passed,
           actual: Some(actual.clone()),
           expected: Some(expected_value.clone()),
           reason: format!("{field} == {actual} (expected {expected_value}) → {}", if passed { "PASS" } else { "FAIL" }),
       }
   }
   ```

3. **Write unit tests**.

   ```bash
   cargo test -p hc-core
   ```

4. **Update `devNotes.md`** and `docs/rules/conditions.md`.

---

## Adding a new notification channel

1. **Add the provider struct** in `crates/hc-notify/src/`. Implement the `NotificationProvider` trait:

   ```rust
   #[async_trait]
   pub trait NotificationProvider: Send + Sync {
       async fn send(&self, title: &str, message: &str) -> Result<()>;
   }
   ```

2. **Register the channel** in `NotificationService::new()` when the config contains the new channel type.

3. **Add config fields** to the `[notify.channels]` section definition in `src/main.rs` or the config parser.

4. **Update** `docs/events/notifications.md` with setup instructions.

---

## Adding a new device type constant

The `device_type` field is a free-form string, but canonical values are listed in `crates/hc-types/src/device.rs` and used for scene filtering. To add a new type:

1. Add the constant string to the doc comment in `hc-types`.
2. Update `docs/plugins/developing-plugins.md` with the new device type in the table.
3. Update `docs/devices/scenes.md` if the new type affects scene filtering behavior.

---

## Testing patterns

### Unit test with mock state

```rust
#[tokio::test]
async fn test_my_action() {
    let state = StateStore::in_memory().await.unwrap();
    let (pub_tx, _) = tokio::sync::broadcast::channel(16);
    let event_bus = EventBus { tx: pub_tx };

    let ctx = ExecutorContext {
        rule_id: Uuid::new_v4(),
        state: state.clone(),
        publish: None,
        notify: None,
        event_bus: Some(event_bus),
        device_cache: Arc::new(DashMap::new()),
        // ... other fields with Arc::new(DashMap::new()) defaults
        trigger_context: TriggerContext::default(),
    };

    let action = Action::MyNewAction {
        device_id: "test_device".into(),
        value: json!({"on": true}),
        enabled: true,
    };

    let outcome = run_single_action(&action, &ctx).await.unwrap();
    assert!(matches!(outcome, ActionOutcome::Ok));
}
```

### Integration test

The full-stack integration test in `tests/integration_test.rs` starts a real HomeCore instance on a random port, connects the virtual device plugin, creates a rule via the REST API, and asserts the rule fires end-to-end. Add new integration scenarios as separate `#[tokio::test]` functions in that file.

```bash
cargo test -p homecore --test integration_test
```

### Dry-run via API

Test rule conditions without executing actions:

```bash
curl -s -X POST http://localhost:8080/api/v1/automations/{id}/test \
  -H "Authorization: Bearer $TOKEN" | jq
```

The response includes `actual`, `expected`, `elapsed_ms`, and `reason` per condition.
