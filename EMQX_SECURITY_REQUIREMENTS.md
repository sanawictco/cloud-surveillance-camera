# EMQX Production Security Requirements

The application verifies that production MQTT and EMQX API URLs use TLS and
that the cloud MQTT client has credentials. The broker settings below must also
be verified in the deployment because this repository does not manage EMQX.

- Disable anonymous MQTT connections.
- Set unmatched authorization to deny.
- Use one authentication principal per NVR.
- Grant only exact tenant/NVR topics. Do not grant device `+` or `#` access.
- Enable TLS for MQTT listeners and the EMQX management API.
- Disable retained messages for transient command topics.
- Configure per-NVR connection, publish-rate, payload-size, and inflight limits.
- Audit authentication user and ACL changes.

Production environment values must use these forms:

```text
MQTT_HOST=mqtts://broker.example.com
MQTT_PORT=8883
MQTT_REST_API_URL=https://broker.example.com:18084/api/v5
```

Before deployment, test with an NVR credential that an allowed exact topic
succeeds and neighboring tenant/NVR topics plus wildcard subscriptions fail.
