# Threat Model

## Main Risks

### Lost or stolen device

Risk: a person with local browser access can read stored memories.

Mitigations:

- optional local passcode gate
- export and wipe controls
- clear documentation that browser storage is not equivalent to secure hardware keystores

### Compromised browser or device

Risk: malware, hostile extensions, or a compromised profile can exfiltrate local data.

Mitigations:

- local-first design reduces unnecessary network exposure
- minimal logging
- avoid background sync
- document storage limitations clearly

### Leakage of raw images or audio

Risk: media blobs may remain on-device longer than intended.

Mitigations:

- configurable raw-media deletion
- explicit storage model in docs
- wipe-all control

### Cloud inference leakage

Risk: if enabled, content may be sent off-device for transcription, OCR, embeddings, or reasoning.

Mitigations:

- cloud inference is opt-in
- stored data still remains local
- privacy screen explains the tradeoff clearly

### Weak secret handling

Risk: browser-stored API keys or passcodes may be recoverable from the device.

Mitigations:

- use Web Crypto hashing for passcodes
- allow session entry instead of persistent storage when extending the app
- document that browser storage is convenience, not HSM-grade security

### Hallucinated or stale retrieval

Risk: a retrieved answer may be wrong, stale, or conflict with newer memories.

Mitigations:

- provenance in answers
- supersession logic
- ambiguity warnings
- confidence notes

### Accidental over-retention

Risk: the app retains raw media or old memories longer than the user expects.

Mitigations:

- explicit-save default
- retention settings
- export and wipe controls

### Sensitive content in logs

Risk: developers later add debugging that leaks memory content.

Mitigations:

- keep logs minimal
- document the no-sensitive-logs policy

### Browser storage limitations

Risk: storage eviction, profile resets, or browser-specific IndexedDB quirks can affect reliability.

Mitigations:

- export support
- clear local-only architecture docs
- recommend periodic export for important data

