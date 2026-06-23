#!/bin/sh
set -eu

CONNECT_URL="${CONNECT_URL:-http://kafka-connect:8083}"
CONNECTOR_NAME="${CONNECTOR_NAME:-collabconnect-message-outbox}"
MYSQL_HOST="${MYSQL_HOST:-db}"
MYSQL_PORT="${MYSQL_PORT:-3306}"
MYSQL_USER="${MYSQL_USER:-root}"
MYSQL_PASSWORD="${MYSQL_PASSWORD:-}"
MYSQL_DB="${MYSQL_DB:-collab_connect_db}"
KAFKA_BOOTSTRAP_SERVERS="${KAFKA_BOOTSTRAP_SERVERS:-kafka:9092}"

CONFIG=$(cat <<EOF
{
  "connector.class": "io.debezium.connector.mysql.MySqlConnector",
  "tasks.max": "1",
  "database.hostname": "${MYSQL_HOST}",
  "database.port": "${MYSQL_PORT}",
  "database.user": "${MYSQL_USER}",
  "database.password": "${MYSQL_PASSWORD}",
  "database.server.id": "184054",
  "topic.prefix": "collabconnect",
  "database.include.list": "${MYSQL_DB}",
  "table.include.list": "${MYSQL_DB}.MessageOutbox",
  "schema.history.internal.kafka.bootstrap.servers": "${KAFKA_BOOTSTRAP_SERVERS}",
  "schema.history.internal.kafka.topic": "schema-changes.collabconnect",
  "include.schema.changes": "false",
  "snapshot.mode": "schema_only",
  "tombstones.on.delete": "false",
  "transforms": "outbox",
  "transforms.outbox.type": "io.debezium.transforms.outbox.EventRouter",
  "transforms.outbox.route.by.field": "type",
  "transforms.outbox.route.topic.replacement": "collabconnect.outbox.\${routedByValue}",
  "transforms.outbox.table.field.event.id": "id",
  "transforms.outbox.table.field.event.key": "aggregateid",
  "transforms.outbox.table.field.event.payload": "payload",
  "transforms.outbox.table.fields.additional.placement": "aggregatetype:header:aggregate_type"
}
EOF
)

echo "Waiting for Kafka Connect at ${CONNECT_URL}"
until curl -sS "${CONNECT_URL}/connectors" >/dev/null; do
  sleep 2
done

echo "Registering connector ${CONNECTOR_NAME}"
HTTP_CODE=$(curl -sS -o /tmp/connector-response.json -w "%{http_code}" \
  -X PUT "${CONNECT_URL}/connectors/${CONNECTOR_NAME}/config" \
  -H "Content-Type: application/json" \
  -d "${CONFIG}")

if [ "${HTTP_CODE}" -ge 200 ] && [ "${HTTP_CODE}" -lt 300 ]; then
  echo "Connector ${CONNECTOR_NAME} configured"
  exit 0
fi

echo "Failed to configure connector (HTTP ${HTTP_CODE})"
cat /tmp/connector-response.json
exit 1
